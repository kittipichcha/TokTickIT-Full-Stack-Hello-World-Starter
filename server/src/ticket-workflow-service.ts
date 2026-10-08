import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { MAX_DATABASE_ID } from "./id-domain.js";
import { ConflictError, NotFoundError, ValidationError } from "./service.js";
import { isTicketStatus, type TicketStatus } from "./ticket-status.js";
import { isWorkflowTransitionAllowed } from "./ticket-workflow-policy.js";

type LockedTicket = {
  id: number;
  currentStatus: TicketStatus;
  ticketOwnerId: number | null;
  itPriority: string | null;
  version: number;
  resolvedAt: Date | null;
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

async function lockTicket(tx: Prisma.TransactionClient, ticketNumber: string): Promise<LockedTicket> {
  const rows = await tx.$queryRaw<LockedTicket[]>`
    SELECT id, "currentStatus"::text AS "currentStatus", "ticketOwnerId",
           "itPriority"::text AS "itPriority", version, "resolvedAt"
      FROM "Ticket" WHERE "ticketNumber" = ${ticketNumber} FOR UPDATE
  `;
  if (!rows[0]) throw new NotFoundError("Ticket not found.");
  return rows[0];
}

function assertExpectedVersion(expectedVersion: unknown, currentVersion: number): void {
  if (expectedVersion === undefined) return;
  if (
    typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) ||
    expectedVersion <= 0 || expectedVersion > MAX_DATABASE_ID
  ) {
    throw new ValidationError("Validation failed.", {
      expectedVersion: "expectedVersion must be a valid positive integer.",
    });
  }
  if (expectedVersion !== currentVersion) throw new ConflictError("Ticket has changed since it was loaded.");
}

export interface SetOwnerResult {
  ticketOwnerId: number;
  version: number;
}

export async function setTicketOwner(
  ticketNumber: string,
  rawOwnerId: unknown,
  expectedVersion?: unknown,
): Promise<SetOwnerResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketNumber);
    assertExpectedVersion(expectedVersion, ticket.version);
    if (
      typeof rawOwnerId !== "number" || !Number.isInteger(rawOwnerId) ||
      rawOwnerId <= 0 || rawOwnerId > MAX_DATABASE_ID
    ) {
      throw new ValidationError("Validation failed.", {
        ownerId: "ownerId must be a valid positive integer.",
      });
    }
    const owner = await tx.user.findUnique({
      where: { id: rawOwnerId },
      select: { id: true, role: true, isActive: true },
    });
    if (!owner || !owner.isActive || (owner.role !== "IT_STAFF" && owner.role !== "ADMINISTRATOR")) {
      throw new ConflictError("The specified owner is not an active IT Staff or Administrator user.");
    }
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { ticketOwnerId: owner.id, version: { increment: 1 } },
      select: { ticketOwnerId: true, version: true },
    });
    return { ticketOwnerId: updated.ticketOwnerId as number, version: updated.version };
  });
}

export interface SetItPriorityResult {
  itPriority: string;
  version: number;
}

export async function setItPriority(
  ticketNumber: string,
  rawPriority: unknown,
  expectedVersion?: unknown,
): Promise<SetItPriorityResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketNumber);
    assertExpectedVersion(expectedVersion, ticket.version);
    if (typeof rawPriority !== "string" || !(PRIORITIES as readonly string[]).includes(rawPriority)) {
      throw new ValidationError("Validation failed.", {
        itPriority: "itPriority must be one of LOW, MEDIUM, HIGH.",
      });
    }
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { itPriority: rawPriority as (typeof PRIORITIES)[number], version: { increment: 1 } },
      select: { itPriority: true, version: true },
    });
    return { itPriority: updated.itPriority as string, version: updated.version };
  });
}

export interface ApplyStatusTransitionResult {
  currentStatus: TicketStatus;
  version: number;
}

export async function applyStatusTransition(
  ticketNumber: string,
  rawTargetStatus: unknown,
  expectedVersion: unknown,
  actorUserId: number,
): Promise<ApplyStatusTransitionResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketNumber);
    assertExpectedVersion(expectedVersion, ticket.version);
    if (!isTicketStatus(rawTargetStatus)) {
      throw new ValidationError("Validation failed.", {
        status: "status must be one of the eight Ticket statuses.",
      });
    }
    const targetStatus = rawTargetStatus;
    const hasPendingAction = targetStatus === "RESOLVED" && ticket.currentStatus === "IN_PROGRESS"
      ? (await tx.actionTaken.count({ where: { ticketId: ticket.id, status: "PENDING" } })) > 0
      : false;
    if (!isWorkflowTransitionAllowed(ticket.currentStatus, targetStatus, ticket.ticketOwnerId !== null, hasPendingAction)) {
      throw new ConflictError(
        hasPendingAction
          ? "Pending Actions must be completed or cancelled before resolving this ticket."
          : ticket.ticketOwnerId === null
            ? "The ticket must be claimed before its status can be changed."
            : "This status transition is not permitted.",
      );
    }

    const [{ changedAt }] = await tx.$queryRaw<Array<{ changedAt: Date }>>`
      SELECT clock_timestamp() AS "changedAt"
    `;
    const version = ticket.version + 1;
    const resolvedAt = targetStatus === "RESOLVED"
      ? changedAt
      : targetStatus === "REOPENED" || targetStatus === "CANCELLED"
        ? null
        : ticket.resolvedAt;
    await tx.ticket.update({
      where: { id: ticket.id },
      data: { currentStatus: targetStatus, version, resolvedAt },
    });
    await tx.ticketStatusChange.create({
      data: {
        ticketId: ticket.id,
        changedByUserId: actorUserId,
        changedAt,
        fromStatus: ticket.currentStatus,
        toStatus: targetStatus,
        versionBefore: ticket.version,
        versionAfter: version,
      },
    });
    return { currentStatus: targetStatus, version };
  });
}

export interface TicketStatusHistoryEntry {
  id: number;
  ticketNumber: string;
  changedBy: { id: number; name: string };
  changedAt: Date;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  versionBefore: number;
  versionAfter: number;
}

export interface TicketStatusHistoryPage {
  data: TicketStatusHistoryEntry[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export async function listTicketStatusHistory(
  ticketNumber: string,
  page: number,
  pageSize: number,
): Promise<TicketStatusHistoryPage> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true, ticketNumber: true } });
  if (!ticket) throw new NotFoundError("Ticket not found.");
  const totalItems = await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } });
  const rows = await prisma.ticketStatusChange.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { changedBy: { select: { id: true, name: true } } },
  });
  return {
    data: rows.map((row) => ({
      id: row.id,
      ticketNumber: ticket.ticketNumber,
      changedBy: row.changedBy,
      changedAt: row.changedAt,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      versionBefore: row.versionBefore,
      versionAfter: row.versionAfter,
    })),
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
