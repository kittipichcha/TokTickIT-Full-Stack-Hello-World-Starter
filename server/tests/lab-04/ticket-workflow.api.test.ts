import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { allocateTicketNumber } from "../../src/ticket-number.js";
import { ensureTestUser, loginAs, withSession, type TestSession } from "../lab-03/helpers/auth.js";
import { seedAction } from "./helpers/action-fixtures.js";
import { TICKET_STATUSES, type TicketStatus } from "../../src/ticket-status.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const emails = {
  requester: `wf-req-${suffix}@example.com`,
  staff: `wf-staff-${suffix}@example.com`,
  otherStaff: `wf-other-${suffix}@example.com`,
  admin: `wf-admin-${suffix}@example.com`,
};
let requester: TestSession;
let staff: TestSession;
let otherStaff: TestSession;
let admin: TestSession;
let requesterId = 0;
let staffId = 0;
let adminId = 0;
let categoryId = 0;
let relatedSystemId = 0;
const ticketIds: number[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  requesterId = await ensureTestUser({ email: emails.requester, name: "Workflow Requester", role: "REQUESTER" });
  staffId = await ensureTestUser({ email: emails.staff, name: "Workflow Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: emails.otherStaff, name: "Workflow Other Staff", role: "IT_STAFF" });
  adminId = await ensureTestUser({ email: emails.admin, name: "Workflow Admin", role: "ADMINISTRATOR" });
  requester = await loginAs(emails.requester);
  staff = await loginAs(emails.staff);
  otherStaff = await loginAs(emails.otherStaff);
  admin = await loginAs(emails.admin);
  const prisma = getPrisma();
  const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  if (!category || !relatedSystem) throw new Error("Workflow tests require active category and related system fixtures.");
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();
  for (const ticketId of ticketIds) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { ticketNumber: true } });
    if (!ticket) continue;
    await prisma.actionCreateIdempotency.deleteMany({ where: { route: { contains: ticket.ticketNumber } } });
    const actions = await prisma.actionTaken.findMany({ where: { ticketId }, select: { id: true } });
    const actionIds = actions.map(({ id }) => id);
    if (actionIds.length) await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actionIds } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    await prisma.ticketStatusChange.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
  }
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await disconnectPrisma();
});

async function createTicket(options: {
  status?: TicketStatus;
  ownerId?: number | null;
  resolvedAt?: Date | null;
} = {}): Promise<{ id: number; ticketNumber: string }> {
  const prisma = getPrisma();
  const ticketNumber = await allocateTicketNumber(new Date().getUTCFullYear());
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: `Workflow fixture ${suffix}`,
      description: `Workflow fixture ${suffix}`,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ticketOwnerId: options.ownerId === undefined ? staffId : options.ownerId,
      currentStatus: options.status ?? "IN_PROGRESS",
      resolvedAt: options.resolvedAt ?? null,
    },
  });
  ticketIds.push(ticket.id);
  return { id: ticket.id, ticketNumber };
}

function patchStatus(session: TestSession, ticketNumber: string, body: Record<string, unknown>) {
  return withSession(request(app).patch(`/api/staff/tickets/${ticketNumber}/status`), session, { csrf: true }).send(body);
}

function rawPatch(session: TestSession, ticketNumber: string, body: string) {
  return withSession(
    request(app).patch(`/api/staff/tickets/${ticketNumber}/status`).set("Content-Type", "application/json"),
    session,
    { csrf: true },
  ).send(body);
}

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function runTicketLockOrderedRace(
  first: () => Promise<request.Response>,
  second: () => Promise<request.Response>,
): Promise<[request.Response, request.Response]> {
  const prisma = getPrisma();
  const firstLockAcquired = deferred();
  const secondLockAttempted = deferred();
  const releaseFirst = deferred();
  const originalTransaction = prisma.$transaction.bind(prisma) as any;
  let lockCalls = 0;
  let firstRequest: Promise<request.Response> | undefined;
  let secondRequest: Promise<request.Response> | undefined;
  const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation((async (operation: any, ...options: any[]) =>
    originalTransaction(async (tx: any) => {
      const originalQuery = tx.$queryRaw.bind(tx);
      const coordinatedQuery = async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("");
        if (!sql.includes('FROM "Ticket"') || !sql.includes("FOR UPDATE")) {
          return originalQuery(strings, ...values);
        }
        const call = ++lockCalls;
        const result = originalQuery(strings, ...values);
        if (call === 1) {
          const rows = await result;
          firstLockAcquired.resolve();
          await releaseFirst.promise;
          return rows;
        }
        if (call === 2) {
          const pending = result.then((rows: unknown) => rows);
          secondLockAttempted.resolve();
          return pending;
        }
        return result;
      };
      const txFacade = new Proxy(tx, {
        get(target, property) {
          if (property === "$queryRaw") return coordinatedQuery;
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return operation(txFacade);
    }, ...options)) as typeof prisma.$transaction);
  try {
    firstRequest = first();
    await firstLockAcquired.promise;
    secondRequest = second();
    await secondLockAttempted.promise;
    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstRequest, secondRequest]);
    expect(lockCalls).toBe(2);
    return [firstResult, secondResult];
  } finally {
    releaseFirst.resolve();
    if (firstRequest) await Promise.allSettled([firstRequest]);
    if (secondRequest) await Promise.allSettled([secondRequest]);
    transactionSpy.mockRestore();
  }
}

describe("API-WF-01: Pending Actions gate", () => {
  itIfDb("permits zero or terminal Actions and rejects every mixed set containing Pending", async () => {
    const prisma = getPrisma();
    const cases: Array<{ statuses: Array<"PENDING" | "COMPLETED" | "CANCELLED">; expected: number }> = [
      { statuses: [], expected: 200 },
      { statuses: ["PENDING"], expected: 409 },
      { statuses: ["PENDING", "PENDING"], expected: 409 },
      { statuses: ["COMPLETED", "CANCELLED"], expected: 200 },
      { statuses: ["COMPLETED", "PENDING"], expected: 409 },
    ];
    for (const item of cases) {
      const ticket = await createTicket();
      const actionIds: number[] = [];
      for (const [index, status] of item.statuses.entries()) {
        actionIds.push(await seedAction({ ticketId: ticket.id, performedByUserId: staffId, description: `gate ${index}`, status }));
      }
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const response = await patchStatus(staff, ticket.ticketNumber, { status: "RESOLVED" });
      expect(response.status).toBe(item.expected);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const history = await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } });
      const actionsAfter = await prisma.actionTaken.findMany({ where: { id: { in: actionIds } }, orderBy: { id: "asc" } });
      if (item.expected === 409) {
        expect(after).toMatchObject({ currentStatus: before.currentStatus, ticketOwnerId: before.ticketOwnerId, version: before.version, resolvedAt: before.resolvedAt });
        expect(after.updatedAt).toEqual(before.updatedAt);
        expect(history).toBe(0);
        expect(actionsAfter.map(({ status }) => status)).toEqual(item.statuses);
      } else {
        expect(after.currentStatus).toBe("RESOLVED");
        expect(after.version).toBe(before.version + 1);
        expect(after.resolvedAt).toBeInstanceOf(Date);
        expect(history).toBe(1);
      }
    }
  });
});

describe("API-WF-02: status matrix, ownership and resolvedAt", () => {
  const allowed: Record<TicketStatus, readonly TicketStatus[]> = {
    NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED", "CANCELLED"], CLOSED: ["REOPENED", "CANCELLED"],
    REOPENED: ["IN_PROGRESS", "CANCELLED"], CANCELLED: [],
  };

  itIfDb("applies every permitted pair, records one actor/version history row, and maintains resolvedAt", async () => {
    const prisma = getPrisma();
    for (const from of TICKET_STATUSES) {
      for (const to of allowed[from]) {
        const priorResolvedAt = from === "RESOLVED" || from === "CLOSED" ? new Date("2025-01-01T00:00:00.000Z") : null;
        const ticket = await createTicket({ status: from, resolvedAt: priorResolvedAt });
        const response = await patchStatus(otherStaff, ticket.ticketNumber, { status: to });
        expect(response.status, `${from} -> ${to}`).toBe(200);
        expect(response.body).toEqual({ data: { currentStatus: to, version: 2 } });
        const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(row.version).toBe(2);
        if (to === "RESOLVED") expect(row.resolvedAt).toBeInstanceOf(Date);
        else if (from === "RESOLVED" && to === "CLOSED") expect(row.resolvedAt).toEqual(priorResolvedAt);
        else if (to === "REOPENED" || to === "CANCELLED") expect(row.resolvedAt).toBeNull();
        const historyRows = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
        expect(historyRows).toHaveLength(1);
        const [history] = historyRows;
        expect(history).toMatchObject({ ticketId: ticket.id, changedByUserId: otherStaff.userId, fromStatus: from, toStatus: to, versionBefore: 1, versionAfter: 2 });
      }
    }
  });

  itIfDb("rejects all unlisted pairs and unowned Tickets without changing state", async () => {
    const prisma = getPrisma();
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES.filter((candidate) => !allowed[from].includes(candidate))) {
        const ticket = await createTicket({ status: from, ownerId: staffId, resolvedAt: from === "RESOLVED" || from === "CLOSED" ? new Date("2025-01-01T00:00:00.000Z") : null });
        const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        const response = await patchStatus(staff, ticket.ticketNumber, { status: to });
        expect(response.status, `${from} -> ${to}`).toBe(409);
        const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(after).toEqual(before);
        expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(0);
      }
    }
    const unowned = await createTicket({ status: "NEW", ownerId: null });
    const unownedBefore = await prisma.ticket.findUniqueOrThrow({ where: { id: unowned.id } });
    const unownedResponse = await patchStatus(staff, unowned.ticketNumber, { status: "OPEN" });
    expect(unownedResponse.status).toBe(409);
    const unownedAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: unowned.id } });
    expect(unownedAfter).toEqual(unownedBefore);
    expect(unownedAfter.ticketOwnerId).toBeNull();
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: unowned.id } })).toBe(0);
  });

  itIfDb("retains every earlier audit row across a multi-step workflow and failed retry", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const transitions: Array<[TicketStatus, TicketStatus]> = [
      ["NEW", "OPEN"], ["OPEN", "IN_PROGRESS"], ["IN_PROGRESS", "RESOLVED"],
      ["RESOLVED", "CLOSED"], ["CLOSED", "REOPENED"], ["REOPENED", "IN_PROGRESS"],
    ];
    let priorRows: unknown[] = [];
    for (const [index, [from, to]] of transitions.entries()) {
      const response = await patchStatus(staff, ticket.ticketNumber, { status: to, expectedVersion: index + 1 });
      expect(response.status).toBe(200);
      const rows = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });
      expect(rows).toHaveLength(index + 1);
      expect(rows.slice(0, index)).toEqual(priorRows);
      expect(rows[index]).toMatchObject({
        changedByUserId: staff.userId,
        fromStatus: from,
        toStatus: to,
        versionBefore: index + 1,
        versionAfter: index + 2,
      });
      priorRows = rows;
    }
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const failed = await patchStatus(staff, ticket.ticketNumber, { status: "IN_PROGRESS", expectedVersion: before.version });
    expect(failed.status).toBe(409);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const rowsAfter = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });
    expect(after).toEqual(before);
    expect(rowsAfter).toEqual(priorRows);
  });
});

describe("API-WF-03: Requester appears-resolved remains advisory", () => {
  itIfDb("changes only the advisory flag", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "IN_PROGRESS" });
    const response = await withSession(request(app).post(`/api/tickets/${ticket.ticketNumber}/appears-resolved`), requester, { csrf: true }).send({ appearsResolved: true });
    expect(response.status).toBe(200);
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.appearsResolved).toBe(true);
    expect(row.currentStatus).toBe("IN_PROGRESS");
    expect(row.version).toBe(1);
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
});

describe("API-WF-04: optional version contract", () => {
  itIfDb("increments same-value owner/priority writes and returns exact additive DTOs", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const owner = await withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), staff, { csrf: true }).send({ ownerId: staffId, expectedVersion: 1 });
    expect(owner.status).toBe(200);
    expect(owner.body).toEqual({ data: { ticketOwnerId: staffId, version: 2 } });
    const priority = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), staff, { csrf: true }).send({ itPriority: "MEDIUM", expectedVersion: 2 });
    expect(priority.status).toBe(200);
    expect(priority.body).toEqual({ data: { itPriority: "MEDIUM", version: 3 } });
    const status = await patchStatus(staff, ticket.ticketNumber, { status: "OPEN", expectedVersion: 3 });
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ data: { currentStatus: "OPEN", version: 4 } });
    const legacy = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), admin, { csrf: true }).send({ itPriority: "HIGH" });
    expect(legacy.status).toBe(200);
    expect(legacy.body).toEqual({ data: { itPriority: "HIGH", version: 5 } });
    const detail = await withSession(request(app).get(`/api/staff/tickets/${ticket.ticketNumber}`), staff);
    expect(detail.body.data.version).toBe(5);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(5);
  });

  itIfDb("validates, conflicts, and preserves shared state for owner and priority writes", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const ownerStale = await withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), staff, { csrf: true }).send({ ownerId: adminId, expectedVersion: 2 });
    const priorityStale = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), staff, { csrf: true }).send({ itPriority: "HIGH", expectedVersion: 2 });
    expect(ownerStale.status).toBe(409);
    expect(priorityStale.status).toBe(409);
    const ownerMalformed = await withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), staff, { csrf: true }).send({ ownerId: staffId, expectedVersion: null });
    const priorityMalformed = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), staff, { csrf: true }).send({ itPriority: "HIGH", expectedVersion: "1" });
    expect(ownerMalformed.status).toBe(400);
    expect(priorityMalformed.status).toBe(400);
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.version).toBe(1);
    expect(row.ticketOwnerId).toBe(staffId);
    expect(row.itPriority).toBe("MEDIUM");
  });

  itIfDb("rejects malformed and stale versions and same-status writes without mutation", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "OPEN", resolvedAt: null });
    const rawInputs = ["null", '"1"', "0", "-1", "1.5", "1e0"];
    for (const expectedVersion of rawInputs) {
      const response = await rawPatch(staff, ticket.ticketNumber, `{"status":"IN_PROGRESS","expectedVersion":${expectedVersion}}`);
      expect(response.status).toBe(400);
    }
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const stale = await patchStatus(staff, ticket.ticketNumber, { status: "IN_PROGRESS", expectedVersion: 99 });
    expect(stale.status).toBe(409);
    const same = await patchStatus(staff, ticket.ticketNumber, { status: "OPEN", expectedVersion: 1 });
    expect(same.status).toBe(409);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.currentStatus).toBe(before.currentStatus);
    expect(after.version).toBe(before.version);
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.resolvedAt).toEqual(before.resolvedAt);
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  itIfDb("preserves the complete Ticket and history snapshot for same-status requests in all eight states", async () => {
    const prisma = getPrisma();
    for (const status of TICKET_STATUSES) {
      const resolvedAt = status === "RESOLVED" || status === "CLOSED" ? new Date("2025-03-04T05:06:07.000Z") : null;
      const ticket = await createTicket({ status, resolvedAt });
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const historyBefore = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });
      const response = await patchStatus(staff, ticket.ticketNumber, { status, expectedVersion: before.version });
      expect(response.status, `same ${status}`).toBe(409);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const historyAfter = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });
      expect(after).toEqual(before);
      expect(historyAfter).toEqual(historyBefore);
    }
  });

  itIfDb("rejects Requester mutation and permits Administrator mutation", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const denied = await patchStatus(requester, ticket.ticketNumber, { status: "OPEN", expectedVersion: 1 });
    expect(denied.status).toBe(403);
    const allowedByAdmin = await patchStatus(admin, ticket.ticketNumber, { status: "OPEN", expectedVersion: 1 });
    expect(allowedByAdmin.status).toBe(200);
    expect(allowedByAdmin.body).toEqual({ data: { currentStatus: "OPEN", version: 2 } });
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  itIfDb("allows Administrator owner, priority, and status writes; rejects Requester writes", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const requesterOwner = await withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), requester, { csrf: true }).send({ ownerId: adminId });
    const requesterPriority = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), requester, { csrf: true }).send({ itPriority: "HIGH" });
    const requesterStatus = await patchStatus(requester, ticket.ticketNumber, { status: "OPEN" });
    expect([requesterOwner.status, requesterPriority.status, requesterStatus.status]).toEqual([403, 403, 403]);
    const owner = await withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), admin, { csrf: true }).send({ ownerId: adminId, expectedVersion: 1 });
    const priority = await withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), admin, { csrf: true }).send({ itPriority: "HIGH", expectedVersion: 2 });
    const status = await patchStatus(admin, ticket.ticketNumber, { status: "OPEN", expectedVersion: 3 });
    expect(owner.body).toEqual({ data: { ticketOwnerId: adminId, version: 2 } });
    expect(priority.body).toEqual({ data: { itPriority: "HIGH", version: 3 } });
    expect(status.body).toEqual({ data: { currentStatus: "OPEN", version: 4 } });
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.version).toBe(4);
    expect(row.ticketOwnerId).toBe(adminId);
    expect(row.itPriority).toBe("HIGH");
  });
});

describe("CONC-WF-01/02: shared Ticket lock and version", () => {
  itIfDb("serializes Action creation against resolution in both lock orders", async () => {
    const prisma = getPrisma();
    const creationFirst = await createTicket();
    const beforeCreationFirst = await prisma.ticket.findUniqueOrThrow({ where: { id: creationFirst.id } });
    const [created, rejectedResolution] = await runTicketLockOrderedRace(
      () => withSession(request(app).post(`/api/tickets/${creationFirst.ticketNumber}/actions`).set("Idempotency-Key", `wf-create-first-${suffix}`), staff, { csrf: true }).send({ description: "Create before resolve" }).then((response) => response),
      () => patchStatus(staff, creationFirst.ticketNumber, { status: "RESOLVED" }).then((response) => response),
    );
    expect(created.status).toBe(201);
    expect(rejectedResolution.status).toBe(409);
    const createFirstRow = await prisma.ticket.findUniqueOrThrow({ where: { id: creationFirst.id } });
    const createFirstActions = await prisma.actionTaken.findMany({ where: { ticketId: creationFirst.id } });
    expect(createFirstRow.currentStatus).toBe("IN_PROGRESS");
    expect(createFirstRow.version).toBe(beforeCreationFirst.version);
    expect(createFirstRow.resolvedAt).toBe(beforeCreationFirst.resolvedAt);
    expect(createFirstActions).toHaveLength(1);
    expect(createFirstActions[0]!.status).toBe("PENDING");
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: creationFirst.id } })).toBe(0);
    expect(createFirstRow.currentStatus === "RESOLVED" && createFirstActions.some((action) => action.status === "PENDING")).toBe(false);

    const resolutionFirst = await createTicket();
    const beforeResolutionFirst = await prisma.ticket.findUniqueOrThrow({ where: { id: resolutionFirst.id } });
    const [resolved, rejectedCreation] = await runTicketLockOrderedRace(
      () => patchStatus(staff, resolutionFirst.ticketNumber, { status: "RESOLVED" }).then((response) => response),
      () => withSession(request(app).post(`/api/tickets/${resolutionFirst.ticketNumber}/actions`).set("Idempotency-Key", `wf-resolve-first-${suffix}`), staff, { csrf: true }).send({ description: "Create after resolve" }).then((response) => response),
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ data: { currentStatus: "RESOLVED", version: beforeResolutionFirst.version + 1 } });
    expect(rejectedCreation.status).toBe(409);
    const resolvedRow = await prisma.ticket.findUniqueOrThrow({ where: { id: resolutionFirst.id } });
    expect(resolvedRow.currentStatus).toBe("RESOLVED");
    expect(resolvedRow.version).toBe(beforeResolutionFirst.version + 1);
    expect(resolvedRow.resolvedAt).toBeInstanceOf(Date);
    expect(await prisma.actionTaken.count({ where: { ticketId: resolutionFirst.id } })).toBe(0);
    const history = await prisma.ticketStatusChange.findMany({ where: { ticketId: resolutionFirst.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ changedByUserId: staff.userId, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", versionBefore: beforeResolutionFirst.version, versionAfter: beforeResolutionFirst.version + 1 });
    expect(resolvedRow.currentStatus === "RESOLVED" && (await prisma.actionTaken.count({ where: { ticketId: resolutionFirst.id, status: "PENDING" } })) > 0).toBe(false);
  });

  itIfDb("serializes resolution against Pending Action completion and cancellation", async () => {
    const prisma = getPrisma();
    for (const terminalStatus of ["COMPLETED", "CANCELLED"] as const) {
      const ticket = await createTicket();
      const actionId = await seedAction({ ticketId: ticket.id, performedByUserId: staffId, description: `terminal race ${terminalStatus}` });
      const body = terminalStatus === "COMPLETED"
        ? { status: terminalStatus, expectedVersion: 1, result: "Completed during race" }
        : { status: terminalStatus, expectedVersion: 1 };
      const [resolution, terminalization] = await Promise.all([
        patchStatus(staff, ticket.ticketNumber, { status: "RESOLVED" }),
        withSession(request(app).patch(`/api/tickets/${ticket.ticketNumber}/actions/${actionId}`), staff, { csrf: true }).send(body),
      ]);
      expect([resolution.status, terminalization.status]).toContain(200);
      const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
      expect(row.currentStatus === "RESOLVED" && action.status === "PENDING").toBe(false);
    }
  });

  itIfDb("allows only one owner, priority, or status write with the same supplied version", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket({ status: "NEW" });
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const responses = await Promise.all([
      withSession(request(app).post(`/api/staff/tickets/${ticket.ticketNumber}/owner`), staff, { csrf: true }).send({ ownerId: adminId, expectedVersion: 1 }),
      withSession(request(app).patch(`/api/staff/tickets/${ticket.ticketNumber}/priority`), staff, { csrf: true }).send({ itPriority: "HIGH", expectedVersion: 1 }),
      patchStatus(staff, ticket.ticketNumber, { status: "OPEN", expectedVersion: 1 }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409, 409]);
    const winnerIndex = responses.findIndex(({ status }) => status === 200);
    const winner = responses[winnerIndex]!;
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.version).toBe(before.version + 1);
    expect(row.resolvedAt).toEqual(before.resolvedAt);
    if (winnerIndex === 0) {
      expect(winner.body).toEqual({ data: { ticketOwnerId: adminId, version: before.version + 1 } });
      expect(row.ticketOwnerId).toBe(adminId);
      expect(row.itPriority).toBe(before.itPriority);
      expect(row.currentStatus).toBe(before.currentStatus);
    } else if (winnerIndex === 1) {
      expect(winner.body).toEqual({ data: { itPriority: "HIGH", version: before.version + 1 } });
      expect(row.ticketOwnerId).toBe(before.ticketOwnerId);
      expect(row.itPriority).toBe("HIGH");
      expect(row.currentStatus).toBe(before.currentStatus);
    } else {
      expect(winner.body).toEqual({ data: { currentStatus: "OPEN", version: before.version + 1 } });
      expect(row.ticketOwnerId).toBe(before.ticketOwnerId);
      expect(row.itPriority).toBe(before.itPriority);
      expect(row.currentStatus).toBe("OPEN");
    }
    const history = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
    expect(history).toHaveLength(winnerIndex === 2 ? 1 : 0);
    if (winnerIndex === 2) {
      expect(history[0]).toMatchObject({ changedByUserId: staff.userId, fromStatus: "NEW", toStatus: "OPEN", versionBefore: before.version, versionAfter: before.version + 1 });
    }
  });
});

describe("API-WF-HISTORY-01: paginated status history", () => {
  itIfDb("orders history by lock acquisition when transaction starts are reversed", async () => {
    const prisma = getPrisma();
    const resolvedAt = new Date("2025-03-04T05:06:07.000Z");
    const ticket = await createTicket({ status: "RESOLVED", resolvedAt });
    const olderStarted = deferred();
    const releaseOlder = deferred();
    const originalTransaction = prisma.$transaction.bind(prisma) as any;
    let transactionCalls = 0;
    let olderStart = "";
    let olderStartMilliseconds = 0;
    let newerStartedLater = false;
    let olderRequest: Promise<request.Response> | undefined;
    const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation((async (operation: any, ...options: any[]) => {
      const call = ++transactionCalls;
      return originalTransaction(async (tx: any) => {
        if (call === 1) {
          const [start] = await tx.$queryRaw`SELECT transaction_timestamp()::text AS "startedAt",
            floor(extract(epoch FROM transaction_timestamp()) * 1000)::float8 AS milliseconds`;
          olderStart = start.startedAt;
          olderStartMilliseconds = start.milliseconds;
          olderStarted.resolve();
          await releaseOlder.promise;
        } else if (call === 2) {
          const [start] = await tx.$queryRaw`SELECT floor(extract(epoch FROM transaction_timestamp()) * 1000)
            > floor(extract(epoch FROM ${olderStart}::timestamptz) * 1000) AS later`;
          newerStartedLater = start.later;
        }
        return operation(tx);
      }, ...options);
    }) as typeof prisma.$transaction);
    try {
      olderRequest = patchStatus(staff, ticket.ticketNumber, { status: "REOPENED" }).then((response) => response);
      await Promise.race([
        olderStarted.promise,
        olderRequest.then(() => { throw new Error("Older request completed before the transaction barrier."); }),
      ]);
      let beforeNewerLock = new Date(0);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [clock] = await prisma.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`;
        beforeNewerLock = clock.time;
        if (beforeNewerLock.getTime() > olderStartMilliseconds) break;
      }
      expect(beforeNewerLock.getTime()).toBeGreaterThan(olderStartMilliseconds);
      const newer = await patchStatus(staff, ticket.ticketNumber, { status: "CLOSED" });
      expect(newer.status).toBe(200);
      expect(newer.body).toEqual({ data: { currentStatus: "CLOSED", version: 2 } });
      expect(newerStartedLater).toBe(true);
      const [beforeOlderLock] = await prisma.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`;
      releaseOlder.resolve();
      const older = await olderRequest;
      expect(older.status).toBe(200);
      expect(older.body).toEqual({ data: { currentStatus: "REOPENED", version: 3 } });
      const page = await withSession(request(app).get(`/api/staff/tickets/${ticket.ticketNumber}/status-history`), staff);
      expect(page.status).toBe(200);
      expect(page.body.data).toHaveLength(2);
      expect(page.body.data.map((row: { fromStatus: string; toStatus: string; versionBefore: number; versionAfter: number }) =>
        [row.fromStatus, row.toStatus, row.versionBefore, row.versionAfter],
      )).toEqual([["RESOLVED", "CLOSED", 1, 2], ["CLOSED", "REOPENED", 2, 3]]);
      expect(new Date(page.body.data[0].changedAt).getTime()).toBeLessThanOrEqual(new Date(page.body.data[1].changedAt).getTime());
      expect(new Date(page.body.data[0].changedAt).getTime()).toBeGreaterThanOrEqual(beforeNewerLock.getTime());
      expect(new Date(page.body.data[1].changedAt).getTime()).toBeGreaterThanOrEqual(beforeOlderLock.time.getTime());
      const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(row).toMatchObject({ currentStatus: "REOPENED", version: 3, resolvedAt: null });
    } finally {
      releaseOlder.resolve();
      if (olderRequest) await Promise.allSettled([olderRequest]);
      transactionSpy.mockRestore();
    }
  });

  itIfDb("rolls back the complete Ticket when audit insertion fails and permits a clean retry", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const historyBefore = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
    const originalTransaction = prisma.$transaction.bind(prisma) as any;
    let auditInsertAttempted = false;
    const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation((async (operation: any, ...options: any[]) =>
      originalTransaction(async (tx: any) => {
        const txFacade = new Proxy(tx, {
          get(target, property) {
            if (property === "ticketStatusChange") {
              return new Proxy(target.ticketStatusChange, {
                get(model, method) {
                  if (method === "create") return async () => {
                    auditInsertAttempted = true;
                    expect(await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ currentStatus: "RESOLVED", version: 2 });
                    await tx.$executeRaw`SELECT 1 / 0`;
                  };
                  return Reflect.get(model, method, model);
                },
              });
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        return operation(txFacade);
      }, ...options)) as typeof prisma.$transaction);
    try {
      const failed = await patchStatus(staff, ticket.ticketNumber, { status: "RESOLVED", expectedVersion: 1 });
      expect(auditInsertAttempted).toBe(true);
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    } finally {
      transactionSpy.mockRestore();
    }
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(before);
    expect(await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } })).toEqual(historyBefore);
    const retry = await patchStatus(staff, ticket.ticketNumber, { status: "RESOLVED", expectedVersion: 1 });
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ data: { currentStatus: "RESOLVED", version: 2 } });
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const history = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
    expect(row).toMatchObject({ currentStatus: "RESOLVED", version: 2 });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ changedByUserId: staffId, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", versionBefore: 1, versionAfter: 2 });
    expect(row.resolvedAt).toEqual(history[0]!.changedAt);
  });

  itIfDb("returns exact ascending pages, empty metadata, and the authorization matrix", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const changedAt = new Date("2026-01-01T00:00:00.000Z");
    const secondOffsets = [2, 0, 1] as const;
    await prisma.ticketStatusChange.createMany({ data: Array.from({ length: 21 }, (_, index) => ({
      ticketId: ticket.id, changedByUserId: staffId, changedAt: new Date(changedAt.getTime() + secondOffsets[index % 3]! * 1000), fromStatus: "IN_PROGRESS" as const,
      toStatus: "RESOLVED" as const, versionBefore: index + 1, versionAfter: index + 2,
    })) });
    const route = `/api/staff/tickets/${ticket.ticketNumber}/status-history`;
    const storedUnsorted = await prisma.ticketStatusChange.findMany({
      where: { ticketId: ticket.id },
      include: { changedBy: { select: { id: true, name: true } } },
    });
    const stored = storedUnsorted.sort((left, right) => left.changedAt.getTime() - right.changedAt.getTime() || left.id - right.id);
    const expectedData = stored.map((row) => ({
      id: row.id,
      ticketNumber: ticket.ticketNumber,
      changedBy: { id: row.changedBy.id, name: row.changedBy.name },
      changedAt: row.changedAt.toISOString(),
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      versionBefore: row.versionBefore,
      versionAfter: row.versionAfter,
    }));
    expect(new Set(stored.map((row) => row.changedAt.getTime())).size).toBeLessThan(stored.length);
    const page = await withSession(request(app).get(route).query({ page: 1, pageSize: 10 }), staff);
    expect(page.status).toBe(200);
    expect(page.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 21, totalPages: 3 });
    expect(page.body.data).toHaveLength(10);
    expect(Object.keys(page.body.data[0]).sort()).toEqual(["changedAt", "changedBy", "fromStatus", "id", "ticketNumber", "toStatus", "versionAfter", "versionBefore"]);
    expect(page.body.data[0].changedBy).toEqual({ id: staffId, name: "Workflow Staff" });
    const orderedIds = (await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }], select: { id: true } })).map(({ id }) => id);
    expect(page.body.data).toEqual(expectedData.slice(0, 10));
    expect(page.body.data.map((row: { id: number }) => row.id)).toEqual(orderedIds.slice(0, 10));
    const second = await withSession(request(app).get(route).query({ page: 2, pageSize: 10 }), staff);
    expect(second.body).toEqual({ data: expectedData.slice(10, 20), pagination: { page: 2, pageSize: 10, totalItems: 21, totalPages: 3 } });
    const third = await withSession(request(app).get(route).query({ page: 3, pageSize: 10 }), admin);
    expect(third.body).toEqual({ data: expectedData.slice(20, 30), pagination: { page: 3, pageSize: 10, totalItems: 21, totalPages: 3 } });
    expect(third.body.data).toHaveLength(1);
    const beyond = await withSession(request(app).get(route).query({ page: 4, pageSize: 10 }), staff);
    expect(beyond.body).toEqual({ data: [], pagination: { page: 4, pageSize: 10, totalItems: 21, totalPages: 3 } });
    const requesterDenied = await withSession(request(app).get(route), requester);
    expect(requesterDenied.status).toBe(403);
    expect((await request(app).get(route)).status).toBe(401);
    expect((await withSession(request(app).get("/api/staff/tickets/TKT-2026-999999/status-history"), staff)).status).toBe(404);
    for (const query of [{ page: 0 }, { pageSize: 0 }, { pageSize: 51 }, { page: "1e0" }]) {
      expect((await withSession(request(app).get(route).query(query), staff)).status).toBe(400);
    }
    const emptyTicket = await createTicket();
    const empty = await withSession(request(app).get(`/api/staff/tickets/${emptyTicket.ticketNumber}/status-history`), staff);
    expect(empty.body).toEqual({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
  });
});
