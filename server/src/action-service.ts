/**
 * Actions Taken — service layer (Issue #51).
 *
 * Frozen authority: `docs/lab-04/api-spec.md` §2–§6 and
 * `docs/lab-04/specification.md` §5.
 *
 * This module owns the Action read/write operations. It is deliberately separate
 * from the 1,973-line `service.ts`: Actions get a focused domain with their own
 * validation (`action-validation.ts`), controller (`action-controller.ts`), and
 * idempotency cleanup (`action-idempotency.ts`).
 *
 * Concurrency protocol (api-spec.md §12): every Action POST/PATCH acquires the
 * parent Ticket row lock (`SELECT ... FOR UPDATE`) FIRST. This serializes Action
 * creation and Action status writes against each other and establishes the
 * Action side of the future resolution gate (Issue #53).
 */

import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { ConflictError, NotFoundError, ValidationError, type AccessContext } from "./service.js";
import {
  hashCreateActionInput,
  normalizeCreateActionInput,
  parseActionPatch,
  toActionSnapshot,
  validateCombinedActionState,
  validateExpectedVersion,
  isTerminalActionStatus,
  type ActionFieldSnapshot,
  type ActionStatus,
  type NormalizedActionFields,
} from "./action-validation.js";

/** Idempotency retention: exactly 24 hours (api-spec.md §4). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Equality with expiry is expired (api-spec.md §4). */
export function isIdempotencyRecordExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Ticket statuses on which a new Pending Action is forbidden (BR-27). */
const TERMINAL_TICKET_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"] as const;

/** Staff Action representation (api-spec.md §2). */
export interface StaffActionDto {
  id: number;
  ticketNumber: string;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: ActionStatus;
  performedBy: { id: number; name: string };
  assignee: { id: number; name: string; role: string } | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/** Requester Action representation (api-spec.md §2) — no IDs, role, version, or revisions. */
export interface RequesterActionDto {
  id: number;
  ticketNumber: string;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: ActionStatus;
  performedBy: { name: string };
  assignee: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionListResult {
  data: StaffActionDto[] | RequesterActionDto[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

/** True when the caller may read any Ticket (view-only). */
function isStaffRole(role: Role): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

/** The concrete Action-create route scope for idempotency (api-spec.md §4). */
export function actionCreateRoute(ticketNumber: string): string {
  return `/api/tickets/${ticketNumber}/actions`;
}

/** The Prisma include used to build a staff Action DTO. */
const ACTION_INCLUDE = {
  performedBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, role: true } },
} satisfies Prisma.ActionTakenInclude;

type ActionWithRelations = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_INCLUDE }>;

/** Builds the staff Action DTO. */
function toStaffDto(action: ActionWithRelations, ticketNumber: string): StaffActionDto {
  return {
    id: action.id,
    ticketNumber,
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    status: action.status as ActionStatus,
    performedBy: { id: action.performedBy.id, name: action.performedBy.name },
    assignee: action.assignee
      ? { id: action.assignee.id, name: action.assignee.name, role: action.assignee.role }
      : null,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    version: action.version,
  };
}

/** Builds the restricted Requester Action DTO. */
function toRequesterDto(action: ActionWithRelations, ticketNumber: string): RequesterActionDto {
  return {
    id: action.id,
    ticketNumber,
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    status: action.status as ActionStatus,
    performedBy: { name: action.performedBy.name },
    assignee: action.assignee ? { name: action.assignee.name } : null,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}

/** Projects an Action for the caller's role. */
function projectAction(
  action: ActionWithRelations,
  ticketNumber: string,
  role: Role,
): StaffActionDto | RequesterActionDto {
  return isStaffRole(role) ? toStaffDto(action, ticketNumber) : toRequesterDto(action, ticketNumber);
}

/**
 * Resolves a Ticket by number and enforces the caller's read access.
 *
 * IT Staff/Administrator may read any Ticket. A Requester may read only an owned
 * Ticket; a missing or non-owned Ticket returns the same `404 NOT_FOUND`
 * (no existence leak, BR-09).
 */
async function resolveReadableTicket(
  ticketNumber: string,
  access: AccessContext,
): Promise<{ id: number; ticketNumber: string }> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true, ticketNumber: true, requesterId: true },
  });
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  if (!isStaffRole(access.role) && ticket.requesterId !== access.userId) {
    throw new NotFoundError("Ticket not found.");
  }
  return { id: ticket.id, ticketNumber: ticket.ticketNumber };
}

/**
 * `listActions` — paginated Action list for a Ticket (api-spec.md §3).
 *
 * Fixed ascending `(createdAt, id)` order; page defaults are applied by the
 * controller. Staff receive the full representation; Requesters receive the
 * restricted projection.
 */
export async function listActions(
  ticketNumber: string,
  access: AccessContext,
  page: number,
  pageSize: number,
): Promise<ActionListResult> {
  const prisma = getPrisma();
  const ticket = await resolveReadableTicket(ticketNumber, access);

  const totalItems = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  if (totalPages === 0 || page > totalPages) {
    return { data: [], pagination: { page, pageSize, totalItems, totalPages } };
  }

  const rows = await prisma.actionTaken.findMany({
    where: { ticketId: ticket.id },
    include: ACTION_INCLUDE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    data: rows.map((row) => projectAction(row, ticket.ticketNumber, access.role)),
    pagination: { page, pageSize, totalItems, totalPages },
  };
}

/**
 * `getActionDetail` — one Action belonging to the path Ticket (api-spec.md §5).
 *
 * A missing Ticket, a missing Action, or an Action belonging to a different
 * Ticket all return `404 NOT_FOUND`.
 */
export async function getActionDetail(
  ticketNumber: string,
  actionId: number,
  access: AccessContext,
): Promise<StaffActionDto | RequesterActionDto> {
  const prisma = getPrisma();
  const ticket = await resolveReadableTicket(ticketNumber, access);

  const action = await prisma.actionTaken.findFirst({
    where: { id: actionId, ticketId: ticket.id },
    include: ACTION_INCLUDE,
  });
  if (!action) {
    throw new NotFoundError("Action not found.");
  }
  return projectAction(action, ticket.ticketNumber, access.role);
}

/**
 * Validates that an assignee is an active IT Staff/Administrator, locking the
 * target User row so a concurrent deactivation/role change cannot race the
 * assignment commit (api-spec.md §4, BR-03).
 */
async function assertEligibleAssignee(
  tx: Prisma.TransactionClient,
  assigneeUserId: number,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: number; role: string; isActive: boolean }>>`
    SELECT id, role::text AS role, "isActive" FROM "User" WHERE id = ${assigneeUserId} FOR UPDATE
  `;
  const user = rows[0];
  if (!user || !user.isActive || (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR")) {
    throw new ConflictError("The specified assignee is not an active IT Staff or Administrator user.");
  }
}

/** Locks the parent Ticket row and returns its id/status (serialization point). */
async function lockTicket(
  tx: Prisma.TransactionClient,
  ticketNumber: string,
): Promise<{ id: number; currentStatus: string }> {
  const rows = await tx.$queryRaw<Array<{ id: number; currentStatus: string }>>`
    SELECT id, "currentStatus"::text AS "currentStatus" FROM "Ticket" WHERE "ticketNumber" = ${ticketNumber} FOR UPDATE
  `;
  const ticket = rows[0];
  if (!ticket) {
    throw new NotFoundError("Ticket not found.");
  }
  return ticket;
}

/**
 * `createAction` — idempotent Action creation (api-spec.md §4).
 *
 * The parent Ticket row is locked first. Unexpired idempotency records decide
 * retries before current Ticket state is validated for a fresh operation.
 *
 * Replay: the same actor/route/key with the same normalized hash returns the
 * original `201` body and creates no row. A different hash returns `409`. An
 * expired record is replaced by a fresh Action and record; the old Action is
 * retained.
 */
export async function createAction(
  ticketNumber: string,
  actorUserId: number,
  idempotencyKey: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: { data: StaffActionDto } }> {
  const prisma = getPrisma();
  const normalized: NormalizedActionFields = normalizeCreateActionInput(body);
  const requestHash = hashCreateActionInput(normalized);
  const route = actionCreateRoute(ticketNumber);

  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketNumber);
    const existing = await tx.actionCreateIdempotency.findUnique({
      where: { actorUserId_route_key: { actorUserId, route, key: idempotencyKey } },
    });
    const now = new Date();
    if (existing && !isIdempotencyRecordExpired(existing.expiresAt, now)) {
      if (existing.requestHash === requestHash) {
        return { status: 201, body: existing.responseBody as unknown as { data: StaffActionDto } };
      }
      throw new ConflictError("This Idempotency-Key was already used with a different request payload.");
    }

    if ((TERMINAL_TICKET_STATUSES as readonly string[]).includes(ticket.currentStatus)) {
      throw new ConflictError("A Pending Action cannot be created on a resolved, closed, or cancelled Ticket.");
    }

    if (normalized.assigneeUserId !== null) {
      await assertEligibleAssignee(tx, normalized.assigneeUserId);
    }

    if (existing) {
      await tx.actionCreateIdempotency.delete({ where: { id: existing.id } });
    }

    const created = await tx.actionTaken.create({
      data: {
        ticketId: ticket.id,
        description: normalized.description,
        result: normalized.result,
        followUpRequired: normalized.followUpRequired,
        followUpNote: normalized.followUpNote,
        attachmentNotes: normalized.attachmentNotes,
        status: "PENDING",
        performedByUserId: actorUserId,
        assigneeUserId: normalized.assigneeUserId,
        version: 1,
      },
      include: ACTION_INCLUDE,
    });

    const responseBody = { data: toStaffDto(created, ticketNumber) };

    await tx.actionCreateIdempotency.create({
      data: {
        actorUserId,
        route,
        key: idempotencyKey,
        requestHash,
        actionId: created.id,
        responseBody: responseBody as unknown as Prisma.InputJsonValue,
        createdAt: now,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      },
    });

    return { status: 201, body: responseBody };
  });
}

/**
 * `updateAction` — audited Action edit (api-spec.md §6).
 *
 * The parent Ticket row is locked first. Only a `PENDING` Action may be edited;
 * `expectedVersion` must match the current version. The combined resulting state
 * is validated, an ineligible existing assignee must be explicitly repaired, and
 * the Action update plus its immutable revision are written atomically.
 */
export async function updateAction(
  ticketNumber: string,
  actionId: number,
  actorUserId: number,
  body: Record<string, unknown>,
): Promise<StaffActionDto> {
  const prisma = getPrisma();
  const expectedVersion = validateExpectedVersion(body.expectedVersion);
  const patch = parseActionPatch(body);

  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketNumber);

    const action = await tx.actionTaken.findFirst({
      where: { id: actionId, ticketId: ticket.id },
      include: ACTION_INCLUDE,
    });
    if (!action) {
      throw new NotFoundError("Action not found.");
    }

    const currentStatus = action.status as ActionStatus;
    if (isTerminalActionStatus(currentStatus)) {
      throw new ConflictError("A completed or cancelled Action cannot be edited.");
    }
    if (action.version !== expectedVersion) {
      throw new ConflictError("The Action was modified by another request. Refresh and retry.");
    }

    // Compute the combined resulting state.
    const nextStatus: ActionStatus = patch.status ?? currentStatus;
    if (nextStatus !== "PENDING" && nextStatus !== "COMPLETED" && nextStatus !== "CANCELLED") {
      throw new ValidationError("Validation failed.", { status: "status is not a valid Action status." });
    }

    const combined = {
      description: patch.description ?? action.description,
      result: patch.result !== undefined ? patch.result : action.result,
      followUpRequired: patch.followUpRequired ?? action.followUpRequired,
      followUpNote: patch.followUpNote !== undefined ? patch.followUpNote : action.followUpNote,
      attachmentNotes: patch.attachmentNotes !== undefined ? patch.attachmentNotes : action.attachmentNotes,
      status: nextStatus,
    };
    validateCombinedActionState(combined);

    // Assignee handling: an explicit value is validated; otherwise a now-ineligible
    // existing assignee must be explicitly repaired (BR-03).
    let nextAssigneeUserId: number | null = action.assigneeUserId;
    if (patch.assigneeUserId !== undefined) {
      nextAssigneeUserId = patch.assigneeUserId;
      if (nextAssigneeUserId !== null) {
        await assertEligibleAssignee(tx, nextAssigneeUserId);
      }
    } else if (action.assigneeUserId !== null) {
      const rows = await tx.$queryRaw<Array<{ role: string; isActive: boolean }>>`
        SELECT role::text AS role, "isActive" FROM "User" WHERE id = ${action.assigneeUserId} FOR UPDATE
      `;
      const current = rows[0];
      const eligible =
        current && current.isActive && (current.role === "IT_STAFF" || current.role === "ADMINISTRATOR");
      if (!eligible) {
        throw new ConflictError(
          "The current assignee is no longer an active IT Staff or Administrator. " +
            "Set assigneeUserId to an eligible user or null to continue.",
        );
      }
    }

    const beforeSnapshot = toActionSnapshot({
      description: action.description,
      result: action.result,
      followUpRequired: action.followUpRequired,
      followUpNote: action.followUpNote,
      attachmentNotes: action.attachmentNotes,
      assigneeUserId: action.assigneeUserId,
      status: currentStatus,
    });
    const afterSnapshot: ActionFieldSnapshot = toActionSnapshot({
      description: combined.description,
      result: combined.result,
      followUpRequired: combined.followUpRequired,
      followUpNote: combined.followUpNote,
      attachmentNotes: combined.attachmentNotes,
      assigneeUserId: nextAssigneeUserId,
      status: nextStatus,
    });

    const updated = await tx.actionTaken.update({
      where: { id: action.id },
      data: {
        description: combined.description,
        result: combined.result,
        followUpRequired: combined.followUpRequired,
        followUpNote: combined.followUpNote,
        attachmentNotes: combined.attachmentNotes,
        assigneeUserId: nextAssigneeUserId,
        status: nextStatus,
        version: action.version + 1,
      },
      include: ACTION_INCLUDE,
    });

    await tx.actionTakenRevision.create({
      data: {
        actionId: action.id,
        editedByUserId: actorUserId,
        versionBefore: action.version,
        versionAfter: action.version + 1,
        beforeSnapshot: beforeSnapshot as unknown as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return toStaffDto(updated, ticketNumber);
  });
}
