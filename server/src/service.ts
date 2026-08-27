import { getPrisma } from "./prisma.js";
import { allocateTicketNumberWithClient, TicketSequenceExhaustedError } from "./ticket-number.js";
import { MAX_DATABASE_ID } from "./id-domain.js";
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
import sharp from "sharp";

export interface Category {
  id: number;
  name: string;
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
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
  removedByRequesterId: number | null;
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

export async function getActiveDevRequesters(): Promise<DevRequester[]> {
  const prisma = getPrisma();
  return prisma.devRequester.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function isActiveDevRequester(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const requester = await prisma.devRequester.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return requester !== null;
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
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId: validated.categoryId,
        relatedSystemId: validated.relatedSystemId,
        summary: validated.summary,
        description: validated.description,
        requestedPriority: validated.requestedPriority as "LOW" | "MEDIUM" | "HIGH",
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
  const orderDir = params.order === "asc" ? "ASC" : "DESC";
  let primaryOrder: string;
  switch (params.sort) {
    case "ticketNumber":
      primaryOrder = `t."ticketNumber" ${orderDir}`;
      break;
    case "summary":
      primaryOrder = `t."summary" ${orderDir}`;
      break;
    case "requestedPriority":
      primaryOrder = `CASE t."requestedPriority" WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 END ${orderDir}`;
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

export async function getTicketByNumber(
  ticketNumber: string,
  requesterId: number,
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
          removedByRequesterId: true,
        },
      },
    },
  });

  if (!ticket || ticket.requesterId !== requesterId) {
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
    attachments: ticket.attachments,
  };
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
  return prisma.$transaction(async (tx) => {
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
    const mimeType = getMimeType(ext);

    try {
      // Insert metadata
      const attachment = await tx.attachment.create({
        data: {
          ticketId: ticket.id,
          originalFilename: sanitizedFilename,
          storedFilename,
          mimeType,
          fileSizeBytes: fileBuffer.length,
          uploaderRequesterId: requesterId,
        },
      });

      return {
        id: attachment.id,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSizeBytes: attachment.fileSizeBytes,
        uploadedAt: attachment.uploadedAt,
        isRemoved: attachment.isRemoved,
        storedFilename: attachment.storedFilename,
      };
    } catch (err) {
      // Metadata insert failed — delete the physical file (compensation)
      await deleteAttachmentFile(storedFilename);
      throw err;
    }
  });
}

/**
 * Lists attachments for a ticket (both active and removed).
 * Ownership is enforced by the caller.
 */
export async function listAttachments(
  requesterId: number,
  ticketNumber: string,
): Promise<AttachmentData[]> {
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, requesterId: true },
  });

  if (!ticket || ticket.requesterId !== requesterId) {
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
      removedByRequesterId: true,
    },
  });

  return attachments;
}

/**
 * Gets attachment metadata by ID.
 * Returns null if not found or not owned.
 */
export async function getAttachmentById(
  attachmentId: number,
  requesterId: number,
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
  removedByRequesterId: number | null;
  uploadedAt: Date;
} | null> {
  const prisma = getPrisma();

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      ticket: { select: { requesterId: true } },
    },
  });

  if (!attachment || attachment.ticket.requesterId !== requesterId) {
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
    removedByRequesterId: attachment.removedByRequesterId,
    uploadedAt: attachment.uploadedAt,
  };
}

/**
 * Downloads an attachment file.
 * Returns the file buffer and MIME type, or throws AttachmentRemovedError if removed.
 */
export async function downloadAttachment(
  attachmentId: number,
  requesterId: number,
): Promise<{ buffer: Buffer; mimeType: string; originalFilename: string } | null> {
  const attachment = await getAttachmentById(attachmentId, requesterId);
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
  requesterId: number,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const attachment = await getAttachmentById(attachmentId, requesterId);
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

  // For PDFs, render the first page as a PNG image using sharp
  if (attachment.mimeType === "application/pdf") {
    try {
      const page1Buffer = await sharp(buffer, { page: 0 }).png().toBuffer();
      return { buffer: page1Buffer, mimeType: "image/png" };
    } catch {
      // If PDF rendering fails, fall back to returning the PDF bytes
      return { buffer, mimeType: attachment.mimeType };
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
 * Sets isRemoved=true, removedAt, removalReason, removedByRequesterId.
 * Returns the updated attachment data, or null if not found/not owned.
 * Throws ConflictError if already removed.
 */
export async function removeAttachment(
  attachmentId: number,
  requesterId: number,
  removalReason: string | null,
): Promise<AttachmentData | null> {
  const prisma = getPrisma();

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      ticket: { select: { requesterId: true } },
    },
  });

  if (!attachment || attachment.ticket.requesterId !== requesterId) {
    return null;
  }

  if (attachment.isRemoved) {
    throw new ConflictError("This attachment has already been removed.");
  }

  const updated = await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      isRemoved: true,
      removedAt: new Date(),
      removalReason,
      removedByRequesterId: requesterId,
    },
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
      removedAt: true,
      removalReason: true,
      removedByRequesterId: true,
    },
  });

  return updated;
}
