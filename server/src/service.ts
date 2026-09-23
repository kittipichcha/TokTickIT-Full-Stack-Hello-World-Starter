import { getPrisma } from "./prisma.js";
import { allocateTicketNumberWithClient, TicketSequenceExhaustedError } from "./ticket-number.js";
import { MAX_DATABASE_ID } from "./id-domain.js";
import type { Role } from "@prisma/client";
import {
  validateExtension,
  validateContentSignature,
  sanitizeOriginalFilename,
  writeAttachmentFile,
  deleteAttachmentFile,
  readAttachmentFile,
  getMimeType,
  sanitizeDownloadFilename,
} from "./attachment-storage.js";
import { openPdf } from "clawpdf";
import { testSeams } from "./test-seams.js";
import { isTransitionAllowed, type TicketStatus } from "./ticket-status.js";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

/**
 * Explicit access context for shared reads (Issue #37).
 *
 * Shared Ticket/Attachment reads are authorized for the owning Requester OR for
 * IT Staff/Administrator. Passing the caller's identity and role explicitly into
 * the service layer keeps the ownership rule at the service boundary instead of
 * relying on route middleware alone — a Staff/Admin request that passes the route
 * gate must not then be rejected by a Requester-only filter inside the service.
 */
export interface AccessContext {
  userId: number;
  role: Role;
}

/** True when the caller may read any Ticket/Attachment (view-only). */
function isStaffRole(role: Role): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

export interface TicketData {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string | null;
  ticketOwnerId: number | null;
  currentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDetailData extends TicketData {
  requesterName: string;
  requesterIsActive: boolean;
  categoryName: string;
  relatedSystemName: string;
  attachments: AttachmentData[];
  /**
   * Issue #38 — the Requester "Problem Appears Resolved" indicator (BR-19).
   * Additive to the Lab 2 detail shape; never mutates `currentStatus`.
   */
  appearsResolved: boolean;
  /**
   * Issue #38 — Public Comments only (BR-04: Internal Notes never reach a
   * Requester payload). Additive to the Lab 2 detail shape.
   */
  publicComments: CommentData[];
}

export interface AttachmentData {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: Date;
  isRemoved: boolean;
  removedAt: Date | null;
  removalReason: string | null;
  removedByUserId: number | null;
}

export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string>) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class InactiveReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InactiveReferenceError";
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: [
        { id: "asc" },
        { name: "asc" },
      ],
    });
    return categories;
  } catch (err) {
    throw new Error("Failed to fetch categories from database");
  }
}

export async function getActiveRelatedSystems(): Promise<RelatedSystem[]> {
  const prisma = getPrisma();
  return prisma.relatedSystem.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function isActiveCategory(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const cat = await prisma.category.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return cat !== null;
}

export async function isActiveRelatedSystem(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const sys = await prisma.relatedSystem.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return sys !== null;
}

export async function categoryExists(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const cat = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });
  return cat !== null;
}

export async function relatedSystemExists(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const sys = await prisma.relatedSystem.findUnique({
    where: { id },
    select: { id: true },
  });
  return sys !== null;
}

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export interface CreateTicketInput {
  categoryId: unknown;
  relatedSystemId: unknown;
  summary: unknown;
  description: unknown;
  requestedPriority: unknown;
}

export interface ValidatedCreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
}

export function validateCreateTicketInput(input: CreateTicketInput): ValidatedCreateTicketInput {
  const fields: Record<string, string> = {};

  // Validate categoryId
  if (input.categoryId === undefined || input.categoryId === null) {
    fields.categoryId = "Category is required.";
  } else if (typeof input.categoryId !== "number" || !Number.isInteger(input.categoryId) || input.categoryId <= 0) {
    fields.categoryId = "Category must be a valid positive integer.";
  }

  // Validate relatedSystemId
  if (input.relatedSystemId === undefined || input.relatedSystemId === null) {
    fields.relatedSystemId = "Related system is required.";
  } else if (typeof input.relatedSystemId !== "number" || !Number.isInteger(input.relatedSystemId) || input.relatedSystemId <= 0) {
    fields.relatedSystemId = "Related system must be a valid positive integer.";
  }

  // Validate summary
  if (input.summary === undefined || input.summary === null) {
    fields.summary = "Summary is required.";
  } else if (typeof input.summary !== "string") {
    fields.summary = "Summary must be a string.";
  } else {
    const trimmed = input.summary.trim();
    if (trimmed.length === 0) {
      fields.summary = "Summary is required.";
    } else if (trimmed.length < 5) {
      fields.summary = "Summary must be at least 5 characters.";
    } else if (trimmed.length > 120) {
      fields.summary = "Summary must be at most 120 characters.";
    }
  }

  // Validate description
  if (input.description === undefined || input.description === null) {
    fields.description = "Description is required.";
  } else if (typeof input.description !== "string") {
    fields.description = "Description must be a string.";
  } else {
    const trimmed = input.description.trim();
    if (trimmed.length === 0) {
      fields.description = "Description is required.";
    } else if (trimmed.length < 10) {
      fields.description = "Description must be at least 10 characters.";
    } else if (trimmed.length > 2000) {
      fields.description = "Description must be at most 2000 characters.";
    }
  }

  // Validate requestedPriority
  if (input.requestedPriority === undefined || input.requestedPriority === null) {
    fields.requestedPriority = "Requested priority is required.";
  } else if (typeof input.requestedPriority !== "string" || !VALID_PRIORITIES.includes(input.requestedPriority)) {
    fields.requestedPriority = "Requested priority must be one of LOW, MEDIUM, HIGH.";
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError("Validation failed.", fields);
  }

  return {
    categoryId: input.categoryId as number,
    relatedSystemId: input.relatedSystemId as number,
    summary: (input.summary as string).trim(),
    description: (input.description as string).trim(),
    requestedPriority: input.requestedPriority as string,
  };
}

export async function createTicket(
  requesterId: number,
  input: CreateTicketInput,
): Promise<TicketData> {
  const validated = validateCreateTicketInput(input);

  // Defense in depth: reject IDs that exceed the database INTEGER range
  // before they reach Prisma, preventing 500 INTERNAL_ERROR.
  if (validated.categoryId > MAX_DATABASE_ID) {
    throw new InactiveReferenceError(
      "The specified category does not exist or is inactive.",
    );
  }
  if (validated.relatedSystemId > MAX_DATABASE_ID) {
    throw new InactiveReferenceError(
      "The specified related system does not exist or is inactive.",
    );
  }

  const prisma = getPrisma();

  // Perform all creation work inside one database transaction so that:
  // 1. Ticket-number allocation and Ticket insertion are atomic.
  // 2. Both use the same authoritative database timestamp.
  // 3. If Ticket insertion fails, the sequence allocation is rolled back.
  return prisma.$transaction(async (tx) => {
    // Obtain one authoritative database timestamp.
    const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
    const authoritativeNow = rows[0]!.now;
    const utcYear = authoritativeNow.getUTCFullYear();

    // Validate or lock the Category and RelatedSystem records.
    const cat = await tx.category.findUnique({
      where: { id: validated.categoryId },
      select: { id: true, isActive: true },
    });
    if (!cat) {
      throw new InactiveReferenceError("The specified category does not exist or is inactive.");
    }
    if (!cat.isActive) {
      throw new InactiveReferenceError("The specified category is inactive.");
    }

    const sys = await tx.relatedSystem.findUnique({
      where: { id: validated.relatedSystemId },
      select: { id: true, isActive: true },
    });
    if (!sys) {
      throw new InactiveReferenceError("The specified related system does not exist or is inactive.");
    }
    if (!sys.isActive) {
      throw new InactiveReferenceError("The specified related system is inactive.");
    }

    // Allocate the yearly sequence using the transaction client.
    let ticketNumber: string;
    try {
      ticketNumber = await allocateTicketNumberWithClient(tx, utcYear);
    } catch (err) {
      if (err instanceof TicketSequenceExhaustedError) {
        throw err;
      }
      throw new Error("Failed to allocate ticket number");
    }

    // Insert the Ticket using the same authoritative timestamp.
    //
    // Frozen specification §9.3: `itPriority` is nullable with a default of
    // `requestedPriority` — "Initially copies Requested Priority; changed only by IT
    // Staff/Administrator (BR-16)". It is therefore initialized from the VALIDATED
    // `requestedPriority` — never read from the request body, which does not define an
    // `itPriority` field (api-spec §7).
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: validated.categoryId,
        relatedSystemId: validated.relatedSystemId,
        summary: validated.summary,
        description: validated.description,
        requestedPriority: validated.requestedPriority as "LOW" | "MEDIUM" | "HIGH",
        itPriority: validated.requestedPriority as "LOW" | "MEDIUM" | "HIGH",
        createdAt: authoritativeNow,
        updatedAt: authoritativeNow,
      },
    });

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requesterId: ticket.requesterId,
      categoryId: ticket.categoryId,
      relatedSystemId: ticket.relatedSystemId,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      ticketOwnerId: ticket.ticketOwnerId,
      currentStatus: ticket.currentStatus,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  });
}

export interface MyTicketItem {
  id: number;
  ticketNumber: string;
  categoryId: number;
  categoryName: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyTicketsResult {
  data: MyTicketItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  };
}

export interface MyTicketsParams {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  status?: string;
  sort: string;
  order: string;
  page: number;
  pageSize: number;
}

export async function getMyTickets(
  requesterId: number,
  params: MyTicketsParams,
): Promise<MyTicketsResult> {
  const prisma = getPrisma();

  // Count unfiltered (all tickets for this requester, before any search/filter)
  const unfilteredTotalItems = await prisma.ticket.count({
    where: { requesterId },
  });

  // Build WHERE clause conditions
  const conditions: string[] = [`t."requesterId" = $1`];
  const filterValues: unknown[] = [requesterId];
  let paramIndex = 2;

  if (params.search) {
    conditions.push(`(POSITION(LOWER($${paramIndex}) IN LOWER(t."ticketNumber")) > 0 OR POSITION(LOWER($${paramIndex}) IN LOWER(t."summary")) > 0)`);
    filterValues.push(params.search);
    paramIndex++;
  }

  if (params.categoryId !== undefined) {
    conditions.push(`t."categoryId" = $${paramIndex}`);
    filterValues.push(params.categoryId);
    paramIndex++;
  }

  if (params.requestedPriority) {
    conditions.push(`t."requestedPriority" = $${paramIndex}::"Priority"`);
    filterValues.push(params.requestedPriority);
    paramIndex++;
  }

  if (params.status) {
    conditions.push(`t."currentStatus" = $${paramIndex}::"TicketStatus"`);
    filterValues.push(params.status);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Count filtered results
  const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) FROM "Ticket" t WHERE ${whereClause}`,
    ...filterValues,
  );
  const totalItems = Number(countRows[0]!.count);

  // Build ORDER BY
  // Frozen api-spec §8 sort keys: createdAt, ticketNumber, summary, status,
  // priority. `requestedPriority` is a Lab 2 compatibility alias for `priority`.
  const orderDir = params.order === "asc" ? "ASC" : "DESC";
  let primaryOrder: string;
  switch (params.sort) {
    case "ticketNumber":
      primaryOrder = `t."ticketNumber" ${orderDir}`;
      break;
    case "summary":
      primaryOrder = `t."summary" ${orderDir}`;
      break;
    case "priority":
    case "requestedPriority":
      primaryOrder = `CASE t."requestedPriority" WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 END ${orderDir}`;
      break;
    case "status":
      // Logical workflow order, not alphabetical (api-spec §8).
      primaryOrder = `CASE t."currentStatus" WHEN 'NEW' THEN 1 WHEN 'OPEN' THEN 2 WHEN 'IN_PROGRESS' THEN 3 WHEN 'WAITING_FOR_REQUESTER' THEN 4 WHEN 'RESOLVED' THEN 5 WHEN 'CLOSED' THEN 6 WHEN 'REOPENED' THEN 7 WHEN 'CANCELLED' THEN 8 END ${orderDir}`;
      break;
    default:
      primaryOrder = `t."createdAt" ${orderDir}`;
      break;
  }
  // Tie-breakers: secondary createdAt desc, tertiary id desc
  const orderClause = `${primaryOrder}, t."createdAt" DESC, t."id" DESC`;

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / params.pageSize);

  // If totalPages === 0 (no data) or the requested page is beyond the last valid page,
  // return empty data with correct pagination metadata — avoid issuing SQL with a giant OFFSET.
  if (totalPages === 0 || params.page > totalPages) {
    return {
      data: [],
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalItems,
        totalPages,
        unfilteredTotalItems,
      },
    };
  }

  const offset = (params.page - 1) * params.pageSize;

  // Fetch paginated data
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      ticketNumber: string;
      categoryId: number;
      categoryName: string;
      summary: string;
      requestedPriority: string;
      itPriority: string | null;
      currentStatus: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    `SELECT t."id", t."ticketNumber", t."categoryId",
            c."name" AS "categoryName", t."summary",
            t."requestedPriority", t."itPriority", t."currentStatus",
            t."createdAt", t."updatedAt"
     FROM "Ticket" t
     JOIN "Category" c ON c."id" = t."categoryId"
     WHERE ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ${params.pageSize} OFFSET ${offset}`,
    ...filterValues,
  );

  return {
    data: rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      summary: row.summary,
      requestedPriority: row.requestedPriority,
      itPriority: row.itPriority,
      currentStatus: row.currentStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages,
      unfilteredTotalItems,
    },
  };
}

// ---------------------------------------------------------------------------
// Issue #38 — IT Staff Ticket Queue (api-spec §15)
// ---------------------------------------------------------------------------

/** Frozen Ticket status set (specification.md §9.3 / api-spec §15). */
const QUEUE_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

/** Frozen IT Priority set (api-spec §15). */
const QUEUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

/** Frozen queue sort allow-list (api-spec §15). */
const QUEUE_SORTS = ["createdAt", "ticketNumber", "summary", "status", "priority"] as const;

export interface StaffQueueItem {
  id: number;
  ticketNumber: string;
  summary: string;
  /** Category name (ui-spec §5.6 required queue information). */
  categoryName: string;
  currentStatus: string;
  requestedPriority: string;
  itPriority: string | null;
  ticketOwnerId: number | null;
  requesterId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffQueueResult {
  data: StaffQueueItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  };
}

export interface StaffQueueParams {
  search?: string;
  status?: string;
  priority?: string;
  ownerId?: number;
  sort: string;
  order: string;
  page: number;
  pageSize: number;
}

/** First-value semantics for duplicate query keys (mirrors the controller helper). */
function firstQueryValue(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") return val[0];
  return undefined;
}

/**
 * Parses and validates the Staff Queue query string (api-spec §15).
 *
 * Frozen rule: **invalid query values fall back to safe defaults and never
 * return `400`** — they are treated as absent. This function therefore never
 * throws; every branch returns a usable value.
 *
 * - `search`: trimmed; empty/whitespace-only → absent.
 * - `status` / `priority`: applied only when the value is exactly in the enum;
 *   any other value → no filter.
 * - `ownerId`: applied only when it is a positive safe integer within the
 *   PostgreSQL `INTEGER` range; otherwise → no filter.
 * - `sort`: allow-list only; unknown → `createdAt`.
 * - `order`: `asc`/`desc` only; unknown → `desc`.
 * - `page`: positive safe integer; otherwise → `1`.
 * - `pageSize`: integer in 1–50; otherwise → `10`.
 */
export function parseQueueQuery(query: unknown): StaffQueueParams {
  const q = (query ?? {}) as Record<string, unknown>;

  const rawSearch = firstQueryValue(q.search) ?? "";
  const search = rawSearch.trim();

  const rawStatus = firstQueryValue(q.status);
  const status =
    rawStatus !== undefined && (QUEUE_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus
      : undefined;

  const rawPriority = firstQueryValue(q.priority);
  const priority =
    rawPriority !== undefined && (QUEUE_PRIORITIES as readonly string[]).includes(rawPriority)
      ? rawPriority
      : undefined;

  let ownerId: number | undefined;
  const rawOwnerId = firstQueryValue(q.ownerId);
  if (rawOwnerId !== undefined && /^(?:[1-9][0-9]*)$/.test(rawOwnerId)) {
    const parsed = Number(rawOwnerId);
    if (Number.isSafeInteger(parsed) && parsed <= MAX_DATABASE_ID) {
      ownerId = parsed;
    }
  }

  const rawSort = firstQueryValue(q.sort) ?? "";
  const sort = (QUEUE_SORTS as readonly string[]).includes(rawSort) ? rawSort : "createdAt";

  const rawOrder = firstQueryValue(q.order) ?? "";
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : "desc";

  let page = 1;
  const rawPage = firstQueryValue(q.page);
  if (rawPage !== undefined && /^(?:[1-9][0-9]*)$/.test(rawPage)) {
    const parsed = Number(rawPage);
    if (Number.isFinite(parsed) && Number.isSafeInteger(parsed)) {
      page = parsed;
    }
  }

  let pageSize = 10;
  const rawPageSize = firstQueryValue(q.pageSize);
  if (rawPageSize !== undefined && /^(?:[1-9][0-9]*)$/.test(rawPageSize)) {
    const n = Number(rawPageSize);
    if (n >= 1 && n <= 50) {
      pageSize = n;
    }
  }

  return {
    search: search.length > 0 ? search : undefined,
    status,
    priority,
    ownerId,
    sort,
    order,
    page,
    pageSize,
  };
}

/**
 * `getStaffQueue` — the IT Staff / Administrator ticket queue (api-spec §15).
 *
 * Mirrors `getMyTickets`'s raw-SQL query-building style (M-38-3): positional
 * parameters, `POSITION(LOWER($n) IN LOWER(col))` search, and an `ORDER BY`
 * string built only from the frozen allow-list (never interpolated from request
 * input). Unlike `getMyTickets` it is not scoped to one requester and it filters
 * `status` as `$n::"TicketStatus"` and `priority` (IT Priority) as
 * `$n::"Priority"`.
 *
 * Migrated Lab 2 rows (`ticketOwnerId IS NULL`, `itPriority` backfilled by #35)
 * are returned normally — the queue never hides a ticket because it is unowned.
 */
export async function getStaffQueue(params: StaffQueueParams): Promise<StaffQueueResult> {
  const prisma = getPrisma();

  // Unfiltered total: every ticket in the system (no requester scoping).
  const unfilteredTotalItems = await prisma.ticket.count();

  const conditions: string[] = [];
  const filterValues: unknown[] = [];
  let paramIndex = 1;

  if (params.search) {
    conditions.push(
      `(POSITION(LOWER($${paramIndex}) IN LOWER(t."ticketNumber")) > 0 OR POSITION(LOWER($${paramIndex}) IN LOWER(t."summary")) > 0)`,
    );
    filterValues.push(params.search);
    paramIndex++;
  }

  if (params.status) {
    conditions.push(`t."currentStatus" = $${paramIndex}::"TicketStatus"`);
    filterValues.push(params.status);
    paramIndex++;
  }

  if (params.priority) {
    conditions.push(`t."itPriority" = $${paramIndex}::"Priority"`);
    filterValues.push(params.priority);
    paramIndex++;
  }

  if (params.ownerId !== undefined) {
    conditions.push(`t."ticketOwnerId" = $${paramIndex}`);
    filterValues.push(params.ownerId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) FROM "Ticket" t ${whereClause}`,
    ...filterValues,
  );
  const totalItems = Number(countRows[0]!.count);

  // ORDER BY — frozen allow-list only; `priority` orders by IT Priority.
  const orderDir = params.order === "asc" ? "ASC" : "DESC";
  let primaryOrder: string;
  switch (params.sort) {
    case "ticketNumber":
      primaryOrder = `t."ticketNumber" ${orderDir}`;
      break;
    case "summary":
      primaryOrder = `t."summary" ${orderDir}`;
      break;
    case "priority":
      primaryOrder = `t."itPriority" ${orderDir}`;
      break;
    case "status":
      primaryOrder = `CASE t."currentStatus" WHEN 'NEW' THEN 1 WHEN 'OPEN' THEN 2 WHEN 'IN_PROGRESS' THEN 3 WHEN 'WAITING_FOR_REQUESTER' THEN 4 WHEN 'RESOLVED' THEN 5 WHEN 'CLOSED' THEN 6 WHEN 'REOPENED' THEN 7 WHEN 'CANCELLED' THEN 8 END ${orderDir}`;
      break;
    default:
      primaryOrder = `t."createdAt" ${orderDir}`;
      break;
  }
  const orderClause = `${primaryOrder}, t."createdAt" DESC, t."id" DESC`;

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / params.pageSize);

  if (totalPages === 0 || params.page > totalPages) {
    return {
      data: [],
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalItems,
        totalPages,
        unfilteredTotalItems,
      },
    };
  }

  const offset = (params.page - 1) * params.pageSize;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      ticketNumber: string;
      summary: string;
      categoryName: string;
      currentStatus: string;
      requestedPriority: string;
      itPriority: string | null;
      ticketOwnerId: number | null;
      requesterId: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    `SELECT t."id", t."ticketNumber", t."summary",
            c."name" AS "categoryName", t."currentStatus",
            t."requestedPriority", t."itPriority", t."ticketOwnerId",
            t."requesterId", t."createdAt", t."updatedAt"
     FROM "Ticket" t
     JOIN "Category" c ON c."id" = t."categoryId"
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ${params.pageSize} OFFSET ${offset}`,
    ...filterValues,
  );

  return {
    data: rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      summary: row.summary,
      categoryName: row.categoryName,
      currentStatus: row.currentStatus,
      requestedPriority: row.requestedPriority,
      itPriority: row.itPriority,
      ticketOwnerId: row.ticketOwnerId,
      requesterId: row.requesterId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages,
      unfilteredTotalItems,
    },
  };
}

export async function getTicketByNumber(
  ticketNumber: string,
  access: AccessContext,
): Promise<TicketDetailData | null> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    include: {
      requester: { select: { id: true, name: true, isActive: true } },
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      attachments: {
        orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          fileSizeBytes: true,
          uploadedAt: true,
          isRemoved: true,
          removedAt: true,
          removalReason: true,
          removedByUserId: true,
        },
      },
      comments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
    },
  });

  if (!ticket) {
    return null;
  }

  // Shared read: Staff/Admin may read any Ticket; a Requester only their own.
  // A non-owned Ticket is indistinguishable from a missing one (404, BR-32).
  if (!isStaffRole(access.role) && ticket.requesterId !== access.userId) {
    return null;
  }

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requesterName: ticket.requester.name,
    requesterIsActive: ticket.requester.isActive,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    ticketOwnerId: ticket.ticketOwnerId,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachments: ticket.attachments.map((a) => ({
      id: a.id,
      originalFilename: a.originalFilename,
      mimeType: a.mimeType,
      fileSizeBytes: a.fileSizeBytes,
      uploadedAt: a.uploadedAt,
      isRemoved: a.isRemoved,
      removedAt: a.removedAt,
      removalReason: a.removalReason,
      removedByUserId: a.removedByUserId,
    })),
    appearsResolved: ticket.appearsResolved,
    publicComments: ticket.comments,
  };
}

/**
 * Checks whether a ticket exists and is owned by the given requester.
 * Used by the controller as an authorization pre-check BEFORE multipart
 * validation so that malformed/missing/oversized files cannot reveal
 * information about a non-owned ticket (defense in depth — the transactional
 * ownership check inside uploadAttachment remains authoritative).
 */
export async function ticketOwnedByRequester(
  ticketNumber: string,
  requesterId: number,
): Promise<boolean> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });
  return ticket !== null && ticket.requesterId === requesterId;
}

/**
 * Checks whether an Attachment exists and belongs to a Ticket owned by the
 * given requester. Used by the shared Attachment-read authorization middleware
 * so a non-owned Attachment is indistinguishable from a missing one (404).
 */
export async function attachmentOwnedByRequester(
  attachmentId: number,
  requesterId: number,
): Promise<boolean> {
  const prisma = getPrisma();
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, ticket: { select: { requesterId: true } } },
  });
  return attachment !== null && attachment.ticket.requesterId === requesterId;
}

export class AttachmentLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentLimitError";
  }
}

export class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class AttachmentRemovedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentRemovedError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export interface AttachmentUploadResult {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: Date;
  isRemoved: boolean;
  storedFilename: string;
}

const MAX_ACTIVE_ATTACHMENTS = 5;
const MAX_FILE_SIZE_BYTES = 5_000_000;

/**
 * Validates file size.
 */
export function validateFileSize(size: number): boolean {
  return size >= 0 && size <= MAX_FILE_SIZE_BYTES;
}

/**
 * Creates an Attachment record in the database.
 * Exported separately for testability — allows integration tests to inject
 * persistence failures at the metadata boundary without mocking Prisma globally.
 */
export async function createAttachmentMetadata(
  tx: {
    attachment: {
      create: (args: {
        data: {
          ticketId: number;
          originalFilename: string;
          storedFilename: string;
          mimeType: string;
          fileSizeBytes: number;
          uploaderUserId: number;
        };
      }) => Promise<{
        id: number;
        originalFilename: string;
        mimeType: string;
        fileSizeBytes: number;
        uploadedAt: Date;
        isRemoved: boolean;
        storedFilename: string;
      }>;
    };
  },
  data: {
    ticketId: number;
    originalFilename: string;
    storedFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    uploaderUserId: number;
  },
) {
  // Test seam: force metadata persistence failure
  if (testSeams.forceCreateAttachmentMetadataError) {
    throw testSeams.forceCreateAttachmentMetadataError;
  }
  return tx.attachment.create({ data });
}

/**
 * Uploads an attachment to a ticket.
 * Validates: requester context, ticket ownership, active count, file size, extension, content signature.
 * Uses compensating write: physical file first, then metadata; deletes file on metadata failure.
 */
export async function uploadAttachment(
  requesterId: number,
  ticketNumber: string,
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<AttachmentUploadResult> {
  const prisma = getPrisma();

  // Validate extension
  const ext = validateExtension(originalFilename);
  if (!ext) {
    throw new UnsupportedMediaTypeError("File type is not supported.");
  }

  // Validate content signature
  if (!validateContentSignature(fileBuffer, ext)) {
    throw new UnsupportedMediaTypeError("File content does not match the expected type.");
  }

  // Validate file size
  if (!validateFileSize(fileBuffer.length)) {
    throw new FileTooLargeError("File exceeds the maximum allowed size.");
  }

  // Sanitize original filename for display
  const sanitizedFilename = sanitizeOriginalFilename(originalFilename);

  // Find ticket and verify ownership — lock the parent Ticket row to serialize
  // concurrent attachment-limit checks for the same ticket.
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });

  if (!ticket || ticket.requesterId !== requesterId) {
    throw new ValidationError("Ticket not found.", {});
  }

  // Use a transaction with row lock for count check + metadata insert to prevent
  // concurrent uploads from exceeding the active attachment limit.
  //
  // Compensation boundary: every physical file written during this operation is
  // tracked and deleted if ANY part of the transaction fails — including a
  // failure AFTER the metadata insert succeeds but before the transaction
  // commits. This prevents orphaned files on commit failure.
  const writtenFiles: string[] = [];

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the parent Ticket row to serialize concurrent attachment-limit checks.
      // SELECT … FOR UPDATE prevents two transactions from both seeing count=4
      // and both inserting, which would violate the 5-active-attachment invariant.
      const lockedTicket = await tx.$queryRaw<
        Array<{ id: number }>
      >`SELECT id FROM "Ticket" WHERE id = ${ticket.id} FOR UPDATE`;

      if (lockedTicket.length === 0) {
        throw new ValidationError("Ticket not found.", {});
      }

      // Count active (non-removed) attachments
      const activeCount = await tx.attachment.count({
        where: { ticketId: ticket.id, isRemoved: false },
      });

      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        throw new AttachmentLimitError("The ticket already has the maximum number of active attachments.");
      }

      // Write physical file first (compensating strategy)
      const storedFilename = await writeAttachmentFile(fileBuffer, ext);
      writtenFiles.push(storedFilename);
      const mimeType = getMimeType(ext);

      // Insert metadata
      const attachment = await createAttachmentMetadata(tx, {
        ticketId: ticket.id,
        originalFilename: sanitizedFilename,
        storedFilename,
        mimeType,
        fileSizeBytes: fileBuffer.length,
        uploaderUserId: requesterId,
      });

      // Test seam: force a failure AFTER the metadata row is created but before
      // the transaction commits, to verify transaction-wide compensation.
      if (testSeams.forcePostInsertTransactionError) {
        throw testSeams.forcePostInsertTransactionError;
      }

      return {
        id: attachment.id,
        ticketId: ticket.id,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSizeBytes: attachment.fileSizeBytes,
        uploadedAt: attachment.uploadedAt,
        isRemoved: attachment.isRemoved,
        storedFilename: attachment.storedFilename,
      };
    });
  } catch (err) {
    // Compensate for EVERY physical file written during this operation. This
    // covers both metadata-insert failure and transaction-commit failure.
    for (const storedFilename of writtenFiles) {
      await deleteAttachmentFile(storedFilename);
    }
    throw err;
  }
}

/**
 * Lists attachments for a ticket (both active and removed).
 *
 * Shared read: Staff/Admin may list any Ticket's Attachments; a Requester only
 * those of a Ticket they own. A non-owned or missing Ticket throws
 * ValidationError, which the handler maps to 404 NOT_FOUND (BR-32).
 */
export async function listAttachments(
  access: AccessContext,
  ticketNumber: string,
): Promise<AttachmentData[]> {
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });

  if (!ticket || (!isStaffRole(access.role) && ticket.requesterId !== access.userId)) {
    throw new ValidationError("Ticket not found.", {});
  }

  const attachments = await prisma.attachment.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
      removedAt: true,
      removalReason: true,
      removedByUserId: true,
    },
  });

  return attachments.map((a) => ({
    id: a.id,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    fileSizeBytes: a.fileSizeBytes,
    uploadedAt: a.uploadedAt,
    isRemoved: a.isRemoved,
    removedAt: a.removedAt,
    removalReason: a.removalReason,
    removedByUserId: a.removedByUserId,
  }));
}

/**
 * Gets attachment metadata by ID.
 *
 * Shared read: Staff/Admin may read any Attachment; a Requester only those of a
 * Ticket they own. Returns null when not found or not accessible (404, BR-32).
 */
export async function getAttachmentById(
  attachmentId: number,
  access: AccessContext,
): Promise<{
  id: number;
  ticketId: number;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  isRemoved: boolean;
  removedAt: Date | null;
  removalReason: string | null;
  removedByUserId: number | null;
  uploadedAt: Date;
} | null> {
  const prisma = getPrisma();

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      ticket: { select: { requesterId: true } },
    },
  });

  if (!attachment) {
    return null;
  }
  if (!isStaffRole(access.role) && attachment.ticket.requesterId !== access.userId) {
    return null;
  }

  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    originalFilename: attachment.originalFilename,
    storedFilename: attachment.storedFilename,
    mimeType: attachment.mimeType,
    fileSizeBytes: attachment.fileSizeBytes,
    isRemoved: attachment.isRemoved,
    removedAt: attachment.removedAt,
    removalReason: attachment.removalReason,
    removedByUserId: attachment.removedByUserId,
    uploadedAt: attachment.uploadedAt,
  };
}

/**
 * Downloads an attachment file.
 * Returns the file buffer and MIME type, or throws AttachmentRemovedError if removed.
 */
export async function downloadAttachment(
  attachmentId: number,
  access: AccessContext,
): Promise<{ buffer: Buffer; mimeType: string; originalFilename: string } | null> {
  const attachment = await getAttachmentById(attachmentId, access);
  if (!attachment) return null;

  if (attachment.isRemoved) {
    throw new AttachmentRemovedError("This attachment has been removed.");
  }

  const buffer = await readAttachmentFile(attachment.storedFilename);
  if (!buffer) {
    // Metadata exists but physical file is missing — should not happen in normal operation
    return null;
  }

  return {
    buffer,
    mimeType: attachment.mimeType,
    originalFilename: attachment.originalFilename,
  };
}

/**
 * Previews an attachment (image inline or PDF first page as image).
 * Returns the file buffer and MIME type, or throws AttachmentRemovedError if removed.
 */
export async function previewAttachment(
  attachmentId: number,
  access: AccessContext,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const attachment = await getAttachmentById(attachmentId, access);
  if (!attachment) return null;

  if (attachment.isRemoved) {
    throw new AttachmentRemovedError("This attachment has been removed.");
  }

  const buffer = await readAttachmentFile(attachment.storedFilename);
  if (!buffer) {
    return null;
  }

  // For images, return the bytes directly
  if (attachment.mimeType.startsWith("image/")) {
    return { buffer, mimeType: attachment.mimeType };
  }

  // For PDFs, render the first page as a PNG image using a PDFium renderer.
  // clawpdf bundles a PDFium WebAssembly runtime (no native/system deps), so
  // this is reproducible across environments.
  if (attachment.mimeType === "application/pdf") {
    try {
      await using pdf = await openPdf(new Uint8Array(buffer));
      const png = await pdf.page(1).png({ dpi: 144 });
      return { buffer: Buffer.from(png), mimeType: "image/png" };
    } catch {
      throw new Error("PDF preview rendering failed");
    }
  }

  return { buffer, mimeType: attachment.mimeType };
}

/**
 * Normalizes the removal reason per BR-19 rules.
 * Returns the normalized value or throws ValidationError.
 */
export function normalizeRemovalReason(reason: unknown): string | null {
  if (reason === undefined || reason === null) {
    return null;
  }

  if (typeof reason !== "string") {
    throw new ValidationError("Validation failed.", { removalReason: "Removal reason must be a string." });
  }

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 200) {
    throw new ValidationError("Validation failed.", { removalReason: "Removal reason must be at most 200 characters." });
  }

  return trimmed;
}

/**
 * Soft-removes an attachment.
 * Sets isRemoved=true, removedAt, removalReason, removedByUserId.
 * Returns the updated attachment data, or null if not found/not owned.
 * Throws ConflictError if already removed.
 *
 * Uses a single conditional UPDATE (WHERE isRemoved = false) so that exactly
 * one concurrent removal can win — this is an atomic ACTIVE → REMOVED state
 * transition rather than a read-then-unconditional-update (TOCTOU race).
 *
 * Requester-owner-only: Staff/Admin are rejected at the route layer
 * (`requireRole(["REQUESTER"])`) and the ownership check below is the
 * authoritative service-layer boundary.
 */
export async function removeAttachment(
  attachmentId: number,
  requesterId: number,
  removalReason: string | null,
): Promise<AttachmentData | null> {
  const prisma = getPrisma();

  // First resolve ownership. This is a read, but the authoritative state
  // transition below is conditional, so a concurrent removal cannot be
  // double-applied even if this read is stale.
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      ticket: { select: { requesterId: true } },
    },
  });

  if (!attachment || attachment.ticket.requesterId !== requesterId) {
    return null;
  }

  // Atomic conditional state transition: only an ACTIVE attachment can be
  // removed. If two concurrent removals race, exactly one UPDATE matches
  // (isRemoved = false) and wins; the other matches zero rows.
  const result = await prisma.attachment.updateMany({
    where: { id: attachmentId, isRemoved: false },
    data: {
      isRemoved: true,
      removedAt: new Date(),
      removalReason,
      removedByUserId: requesterId,
    },
  });

  if (result.count === 0) {
    // No active row matched — the attachment was already removed by a
    // concurrent request (or removed between the ownership read and update).
    throw new ConflictError("This attachment has already been removed.");
  }

  // Re-read the authoritative row to return the persisted metadata.
  const updated = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
      removedAt: true,
      removalReason: true,
      removedByUserId: true,
    },
  });

  if (!updated) {
    throw new ConflictError("This attachment has already been removed.");
  }
  return {
    id: updated.id,
    originalFilename: updated.originalFilename,
    mimeType: updated.mimeType,
    fileSizeBytes: updated.fileSizeBytes,
    uploadedAt: updated.uploadedAt,
    isRemoved: updated.isRemoved,
    removedAt: updated.removedAt,
    removalReason: updated.removalReason,
    removedByUserId: updated.removedByUserId,
  };
}

// ---------------------------------------------------------------------------
// Issue #38 — Comments, Internal Notes, appears-resolved, Staff Ticket Detail
// ---------------------------------------------------------------------------

/** Thrown when a referenced resource does not exist (mapped to 404 NOT_FOUND). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Maximum comment/note content length after trim (api-spec §20/§22, BR-22/23). */
export const MAX_COMMENT_LENGTH = 2000;

/**
 * Validates and normalizes Comment/InternalNote content (BR-22/23).
 *
 * Frozen rules: content is trimmed; whitespace-only is rejected; the trimmed
 * value must be 1–2,000 characters. Returns the trimmed content. Throws
 * `ValidationError` with a field-level message otherwise.
 */
export function validateCommentContent(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("Validation failed.", {
      content: "content is required and must be a string.",
    });
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Validation failed.", {
      content: "content must not be empty or whitespace-only.",
    });
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError("Validation failed.", {
      content: `content must be at most ${MAX_COMMENT_LENGTH} characters.`,
    });
  }
  return trimmed;
}

export interface CommentData {
  id: number;
  content: string;
  authorId: number;
  createdAt: Date;
}

/**
 * Resolves a Ticket for a shared comment read/write.
 *
 * IT Staff / Administrator may access any Ticket. A Requester may access only a
 * Ticket they own; a non-owned or missing Ticket is indistinguishable from a
 * missing one (`NotFoundError` → 404, BR-32 — never 403, no existence leak).
 */
async function resolveTicketForCommentAccess(
  ticketNumber: string,
  access: AccessContext,
): Promise<{ id: number }> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  if (!isStaffRole(access.role) && ticket.requesterId !== access.userId) {
    throw new NotFoundError("Ticket not found.");
  }
  return { id: ticket.id };
}

/**
 * Creates a Public Comment (api-spec §20).
 *
 * Author is always the authenticated identity (`access.userId`) — a
 * client-supplied `authorId` is never read. Timestamp is backend-derived.
 */
export async function createComment(
  ticketNumber: string,
  access: AccessContext,
  rawContent: unknown,
): Promise<CommentData> {
  const content = validateCommentContent(rawContent);
  const ticket = await resolveTicketForCommentAccess(ticketNumber, access);
  const prisma = getPrisma();
  const comment = await prisma.comment.create({
    data: { ticketId: ticket.id, authorId: access.userId, content },
    select: { id: true, content: true, authorId: true, createdAt: true },
  });
  return comment;
}

/** Lists Public Comments for a Ticket (api-spec §21). */
export async function listComments(
  ticketNumber: string,
  access: AccessContext,
): Promise<CommentData[]> {
  const ticket = await resolveTicketForCommentAccess(ticketNumber, access);
  const prisma = getPrisma();
  return prisma.comment.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true, authorId: true, createdAt: true },
  });
}

/**
 * Creates an Internal Note (api-spec §22). Staff/Admin only — the route gate
 * enforces the role; this function assumes an authorized caller.
 */
export async function createNote(
  ticketNumber: string,
  authorId: number,
  rawContent: unknown,
): Promise<CommentData> {
  const content = validateCommentContent(rawContent);
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  return prisma.internalNote.create({
    data: { ticketId: ticket.id, authorId, content },
    select: { id: true, content: true, authorId: true, createdAt: true },
  });
}

/** Lists Internal Notes for a Ticket (api-spec §23). Staff/Admin only. */
export async function listNotes(ticketNumber: string): Promise<CommentData[]> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  return prisma.internalNote.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true, authorId: true, createdAt: true },
  });
}

export interface AppearsResolvedResult {
  ticketNumber: string;
  appearsResolved: boolean;
  currentStatus: string;
}

/**
 * Sets the Requester "Problem Appears Resolved" indicator (api-spec §20a).
 *
 * Owner-Requester only (the route gate enforces the role; ownership is enforced
 * here). This is a dedicated single-column update — it can never touch
 * `currentStatus` (BR-19, specification.md §7).
 */
export async function setAppearsResolved(
  ticketNumber: string,
  requesterId: number,
  rawValue: unknown,
): Promise<AppearsResolvedResult> {
  if (typeof rawValue !== "boolean") {
    throw new ValidationError("Validation failed.", {
      appearsResolved: "appearsResolved is required and must be a boolean.",
    });
  }
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });
  if (!ticket || ticket.requesterId !== requesterId) {
    throw new NotFoundError("Ticket not found.");
  }
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { appearsResolved: rawValue },
    select: { ticketNumber: true, appearsResolved: true, currentStatus: true },
  });
  return updated;
}

export interface StaffTicketDetailData {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  currentStatus: string;
  requestedPriority: string;
  itPriority: string | null;
  ticketOwnerId: number | null;
  requesterId: number;
  requesterName: string;
  requesterIsActive: boolean;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  appearsResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  publicComments: CommentData[];
  internalNotes: CommentData[];
}

/**
 * `getStaffTicketDetail` — the Staff/Admin Ticket Detail read (api-spec §16).
 *
 * Separate from the Requester detail function; the two HTTP handlers stay
 * independent. Comments and notes are scoped per role by the route chain, so
 * this helper returns both for the Staff surface.
 */
export async function getStaffTicketDetail(
  ticketNumber: string,
): Promise<StaffTicketDetailData | null> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    include: {
      requester: { select: { id: true, name: true, isActive: true } },
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      comments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
      internalNotes: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
    },
  });
  if (!ticket) return null;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    currentStatus: ticket.currentStatus,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    ticketOwnerId: ticket.ticketOwnerId,
    requesterId: ticket.requesterId,
    requesterName: ticket.requester.name,
    requesterIsActive: ticket.requester.isActive,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    appearsResolved: ticket.appearsResolved,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    publicComments: ticket.comments,
    internalNotes: ticket.internalNotes,
  };
}

export interface SetOwnerResult {
  ticketOwnerId: number;
}

/**
 * `setTicketOwner` — claim/reassign (api-spec §17).
 *
 * Frozen validation order and error split (Revision 7; Rev 9 §17 resolution):
 *   1. Ticket by ticketNumber → missing → `NotFoundError` (404)
 *   2. `ownerId` absent/null/non-integer/malformed → `ValidationError` (400)
 *   3. User lookup → missing → `ConflictError` (409 — a nonexistent User is not
 *      an active IT Staff/Administrator, per §17)
 *   4. Role ∉ {IT_STAFF, ADMINISTRATOR} OR inactive → `ConflictError` (409)
 *   5. Plain UPDATE — last-write-wins, no version column, no unassign operation
 */
export async function setTicketOwner(
  ticketNumber: string,
  rawOwnerId: unknown,
): Promise<SetOwnerResult> {
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }

  if (
    typeof rawOwnerId !== "number" ||
    !Number.isInteger(rawOwnerId) ||
    rawOwnerId <= 0 ||
    rawOwnerId > MAX_DATABASE_ID
  ) {
    throw new ValidationError("Validation failed.", {
      ownerId: "ownerId must be a valid positive integer.",
    });
  }

  const owner = await prisma.user.findUnique({
    where: { id: rawOwnerId },
    select: { id: true, role: true, isActive: true },
  });
  if (!owner) {
    throw new ConflictError("The specified owner is not an active IT Staff or Administrator user.");
  }
  if (!isStaffRole(owner.role) || !owner.isActive) {
    throw new ConflictError("The specified owner is not an active IT Staff or Administrator user.");
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { ticketOwnerId: owner.id },
    select: { ticketOwnerId: true },
  });
  return { ticketOwnerId: updated.ticketOwnerId as number };
}

export interface AssignableOwner {
  id: number;
  name: string;
  role: string;
}

/**
 * `listAssignableOwners` — the eligible Ticket-owner set (Issue #38, FR-16).
 *
 * Returns every **active** IT Staff / Administrator as `{ id, name, role }`.
 *
 * This is the read-only source for the Queue owner filter and the Staff Detail
 * ownership control. It exists because the frozen contract exposes no
 * staff-accessible user list: `GET /api/admin/users` (§24) is
 * Administrator-only, so IT Staff cannot call it, and `GET /api/app/context`
 * returns only the caller's own identity. The addition is recorded in
 * `specification.md` §13 and `api-spec.md` §17a per the closed-contract
 * edge-case policy.
 *
 * Security: the projection is deliberately minimal — `passwordHash` and every
 * other credential field are never selected. Requesters and inactive users are
 * excluded. This list is a **UX affordance only**; `setTicketOwner` remains the
 * final authorization boundary and independently rejects ineligible targets.
 */
export async function listAssignableOwners(): Promise<AssignableOwner[]> {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

export interface SetItPriorityResult {
  itPriority: string;
}

/**
 * `setItPriority` — set the IT Priority (api-spec §18). Staff/Admin only at the
 * route; this function validates the enum value. Requested Priority is never
 * touched.
 */
export async function setItPriority(
  ticketNumber: string,
  rawPriority: unknown,
): Promise<SetItPriorityResult> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  if (typeof rawPriority !== "string" || !QUEUE_PRIORITIES.includes(rawPriority as never)) {
    throw new ValidationError("Validation failed.", {
      itPriority: "itPriority must be one of LOW, MEDIUM, HIGH.",
    });
  }
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { itPriority: rawPriority as "LOW" | "MEDIUM" | "HIGH" },
    select: { itPriority: true },
  });
  return { itPriority: updated.itPriority as string };
}

export interface ApplyStatusTransitionResult {
  currentStatus: string;
}

/**
 * `applyStatusTransition` — the frozen Status Transition Matrix (api-spec §19,
 * specification.md §7).
 *
 * Steps 4–5 produce precise, user-actionable errors; step 6 makes the matrix
 * hold under concurrency (Revision 10 — atomic conditional UPDATE):
 *   1. Ticket by ticketNumber → missing → `NotFoundError` (404)
 *   2. targetStatus not a valid TicketStatus value → `ValidationError` (400)
 *   3. read currentStatus, ticketOwnerId
 *   4. ticketOwnerId === null → `ConflictError` (409 — must claim first)
 *   5. !isTransitionAllowed(currentStatus, targetStatus) → `ConflictError` (409)
 *   6. atomic `updateMany` guarded on the persisted from-state; `count === 0`
 *      → re-read → classify 404 / 409 (unowned) / 409 (raced)
 *
 * Ownership rule (Issue #38 review fix — B-1): the matrix's validation column
 * reads "Ticket owned", i.e. `ticketOwnerId` is non-null — NOT "owned by the
 * acting user". specification.md §6 grants "Perform permitted status changes"
 * to the whole IT Staff/Administrator group, and §13 decision 14 states only
 * that the Ticket must be claimed first (it never auto-claims). The acting user
 * is therefore not required to be the Ticket's specific owner; any active
 * IT Staff/Administrator may progress a claimed Ticket. The route-level role
 * gate (`requireRole(["IT_STAFF", "ADMINISTRATOR"])`) is the authorization
 * boundary. The atomic guard below is consequently on the persisted from-state
 * only — it must not re-introduce the same-actor restriction.
 */
export async function applyStatusTransition(
  ticketNumber: string,
  rawTargetStatus: unknown,
): Promise<ApplyStatusTransitionResult> {
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, currentStatus: true, ticketOwnerId: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }

  if (
    typeof rawTargetStatus !== "string" ||
    !(QUEUE_STATUSES as readonly string[]).includes(rawTargetStatus)
  ) {
    throw new ValidationError("Validation failed.", {
      status: `status must be one of ${QUEUE_STATUSES.join(", ")}.`,
    });
  }
  const targetStatus = rawTargetStatus as TicketStatus;

  if (ticket.ticketOwnerId === null) {
    throw new ConflictError("The ticket must be claimed before its status can be changed.");
  }

  const fromStatus = ticket.currentStatus as TicketStatus;
  if (!isTransitionAllowed(fromStatus, targetStatus)) {
    throw new ConflictError("This status transition is not permitted.");
  }

  const updated = await prisma.ticket.updateMany({
    where: {
      id: ticket.id,
      currentStatus: fromStatus,
    },
    data: { currentStatus: targetStatus },
  });

  if (updated.count === 0) {
    // The persisted from-state changed between the read and the write.
    const current = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { currentStatus: true, ticketOwnerId: true },
    });
    if (!current) {
      throw new NotFoundError("Ticket not found.");
    }
    if (current.ticketOwnerId === null) {
      throw new ConflictError("The ticket must be claimed before its status can be changed.");
    }
    throw new ConflictError("This status transition is not permitted.");
  }

  return { currentStatus: targetStatus };
}
