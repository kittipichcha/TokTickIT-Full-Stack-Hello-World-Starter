/**
 * Frozen Test-DD file: `server/tests/lab-03/staff-ticket-detail.api.test.ts`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - API-STAFF-01  Claim/reassign ownership -> active IT Staff/Admin owner (AC-11)
 *   - API-STAFF-02  Set IT Priority -> IT Priority updated; Requested Priority unchanged (AC-12)
 *   - API-STAFF-03  Permitted status change -> status changes per matrix (AC-13)
 *   - API-STAFF-04  Forbidden status transition -> 409 CONFLICT, no change (AC-13)
 *   - API-STAFF-06  Set IT Priority on nonexistent/forbidden ticket -> 403/404 per BR-31 (AC-12)
 *   - API-STAFF-07  Status change on nonexistent/forbidden ticket -> 403/404 per BR-31 (AC-13)
 *   - API-STAFF-08  Status change on unowned ticket -> 409 CONFLICT (AC-13)
 *   - API-STAFF-09  Two concurrent claims -> both succeed; last-write-wins (AC-11)
 *
 * Supplementary (never a tests.md row): the Staff Detail GET scoping assertion,
 * the invalid-status-value 400 assertion, the CSRF coverage assertion, and the
 * migrated-shape ticket assertions (M-38-5).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import {
  ensureTestUser,
  loginAs,
  withSession,
  type TestSession,
} from "./helpers/auth.js";
import { TICKET_STATUSES, type TicketStatus } from "../../src/ticket-status.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const STAFF_A_EMAIL = "sd-staff-a@example.com";
const STAFF_B_EMAIL = "sd-staff-b@example.com";
const ADMIN_EMAIL = "sd-admin@example.com";
const REQUESTER_EMAIL = "sd-requester@example.com";
const INACTIVE_STAFF_EMAIL = "sd-inactive-staff@example.com";

let staffA: TestSession;
let staffB: TestSession;
let admin: TestSession;
let requester: TestSession;

let categoryId: number;
let systemId: number;
let inactiveStaffId: number;

const FROZEN_ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED", "CANCELLED"],
  CLOSED: ["REOPENED", "CANCELLED"],
  REOPENED: ["CANCELLED"],
  CANCELLED: [],
};

function expectedTransitionAllowed(from: TicketStatus, to: TicketStatus): boolean {
  return FROZEN_ALLOWED_TRANSITIONS[from].includes(to);
}

async function createTicket(options: {
  requesterId: number;
  summary: string;
  status?: string;
  itPriority?: string | null;
  ownerId?: number | null;
}): Promise<string> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  const now = rows[0]!.now;
  const year = now.getUTCFullYear();
  const seq = await prisma.ticketSequence.upsert({
    where: { year },
    create: { year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  const ticketNumber = `TKT-${year}-${String(seq.lastSeq).padStart(6, "0")}`;
  await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId: options.requesterId,
      categoryId,
      relatedSystemId: systemId,
      summary: options.summary,
      description: "Staff detail test ticket description.",
      requestedPriority: "MEDIUM",
      itPriority: (options.itPriority ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | null,
      ticketOwnerId: options.ownerId ?? null,
      currentStatus: (options.status ?? "NEW") as never,
      createdAt: now,
      updatedAt: now,
    },
  });
  return ticketNumber;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;

  const prisma = getPrisma();

  await ensureTestUser({ email: STAFF_A_EMAIL, name: "SD Staff A", role: "IT_STAFF" });
  await ensureTestUser({ email: STAFF_B_EMAIL, name: "SD Staff B", role: "IT_STAFF" });
  await ensureTestUser({ email: ADMIN_EMAIL, name: "SD Admin", role: "ADMINISTRATOR" });
  await ensureTestUser({ email: REQUESTER_EMAIL, name: "SD Requester", role: "REQUESTER" });
  inactiveStaffId = await ensureTestUser({
    email: INACTIVE_STAFF_EMAIL,
    name: "SD Inactive Staff",
    role: "IT_STAFF",
    isActive: false,
  });

  staffA = await loginAs(STAFF_A_EMAIL);
  staffB = await loginAs(STAFF_B_EMAIL);
  admin = await loginAs(ADMIN_EMAIL);
  requester = await loginAs(REQUESTER_EMAIL);

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: `SD Cat-${Date.now()}`, isActive: true } });
  }
  categoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({ data: { name: `SD Sys-${Date.now()}`, isActive: true } });
  }
  systemId = sys.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("API-STAFF-01 — Claim/reassign ownership (AC-11)", () => {
  itIfDb("IT Staff claims an unowned ticket -> 200 with the new owner", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Claim success" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: staffA.userId });
    expect(res.status).toBe(200);
    expect(res.body.data.ticketOwnerId).toBe(staffA.userId);
  });

  itIfDb("reassign to another active Staff/Admin -> 200", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Reassign success",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: admin.userId });
    expect(res.status).toBe(200);
    expect(res.body.data.ticketOwnerId).toBe(admin.userId);
  });

  itIfDb("absent ownerId -> 400 VALIDATION_ERROR, no state change", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner absent" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.ticketOwnerId).toBeNull();
  });

  itIfDb("ownerId: null -> 400 VALIDATION_ERROR (no unassign operation)", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Owner null",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.ticketOwnerId).toBe(staffA.userId);
  });

  itIfDb("non-integer ownerId -> 400 VALIDATION_ERROR", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner non-int" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: "5" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("well-formed Requester target -> 409 CONFLICT", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner requester" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: requester.userId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  itIfDb("well-formed inactive Staff target -> 409 CONFLICT", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner inactive" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: inactiveStaffId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  itIfDb("well-formed nonexistent User -> 409 CONFLICT (api-spec §17)", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner missing user" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: 999999999 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  itIfDb("missing ticket -> 404 NOT_FOUND", async () => {
    const res = await withSession(
      request(app).post("/api/staff/tickets/TKT-2026-999999/owner"),
      staffA,
      { csrf: true },
    ).send({ ownerId: staffA.userId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("Requester caller -> 403 FORBIDDEN", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner role gate" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      requester,
      { csrf: true },
    ).send({ ownerId: staffA.userId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("missing CSRF token -> 403, owner unchanged", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Owner csrf" });
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
    ).send({ ownerId: staffA.userId });
    expect(res.status).toBe(403);
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.ticketOwnerId).toBeNull();
  });
});

describe("API-STAFF-09 — Two concurrent claims (AC-11)", () => {
  itIfDb("both concurrent claims succeed; final owner is deterministic last-write-wins", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Concurrent claim" });

    const claimAs = (session: TestSession) =>
      withSession(
        request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
        session,
        { csrf: true },
      ).send({ ownerId: session.userId });

    const [resultA, resultB] = await Promise.all([claimAs(staffA), claimAs(staffB)]);

    // Neither request is rejected merely because it raced.
    expect(resultA.status).toBe(200);
    expect(resultB.status).toBe(200);

    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect([staffA.userId, staffB.userId]).toContain(after!.ticketOwnerId);
  });
});

describe("API-STAFF-02 — Set IT Priority (AC-12)", () => {
  itIfDb("IT Priority is updated and Requested Priority is unchanged", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Priority update",
      itPriority: "LOW",
    });
    const before = await prisma.ticket.findUnique({ where: { ticketNumber } });

    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/priority`),
      staffA,
      { csrf: true },
    ).send({ itPriority: "HIGH" });

    expect(res.status).toBe(200);
    expect(res.body.data.itPriority).toBe("HIGH");

    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.itPriority).toBe("HIGH");
    expect(after!.requestedPriority).toBe(before!.requestedPriority);
  });

  itIfDb("invalid itPriority value -> 400 VALIDATION_ERROR", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Priority invalid" });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/priority`),
      staffA,
      { csrf: true },
    ).send({ itPriority: "URGENT" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-STAFF-06 — Set IT Priority on nonexistent/forbidden ticket (AC-12)", () => {
  itIfDb("nonexistent ticket -> 404 NOT_FOUND", async () => {
    const res = await withSession(
      request(app).patch("/api/staff/tickets/TKT-2026-999999/priority"),
      staffA,
      { csrf: true },
    ).send({ itPriority: "HIGH" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("Requester caller -> 403 FORBIDDEN", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Priority forbidden" });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/priority`),
      requester,
      { csrf: true },
    ).send({ itPriority: "HIGH" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("API-STAFF-03 — Permitted status changes (AC-13)", () => {
  itIfDb("every permitted transition applies per the frozen matrix", async () => {
    const prisma = getPrisma();

    // NEW -> OPEN (owned)
    const t1 = await createTicket({
      requesterId: requester.userId,
      summary: "Transition new-open",
      status: "NEW",
      ownerId: staffA.userId,
    });
    const r1 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(r1.status).toBe(200);
    expect(r1.body.data.currentStatus).toBe("OPEN");

    // OPEN -> IN_PROGRESS
    const r2 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "IN_PROGRESS" });
    expect(r2.status).toBe(200);

    // IN_PROGRESS -> WAITING_FOR_REQUESTER
    const r3 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "WAITING_FOR_REQUESTER" });
    expect(r3.status).toBe(200);

    // WAITING_FOR_REQUESTER -> IN_PROGRESS
    const r4 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "IN_PROGRESS" });
    expect(r4.status).toBe(200);

    // IN_PROGRESS -> RESOLVED
    const r5 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "RESOLVED" });
    expect(r5.status).toBe(200);

    // RESOLVED -> CLOSED
    const r6 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "CLOSED" });
    expect(r6.status).toBe(200);

    // CLOSED -> REOPENED
    const r7 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "REOPENED" });
    expect(r7.status).toBe(200);

    // REOPENED -> CANCELLED (any non-Cancelled -> Cancelled)
    const r8 = await withSession(
      request(app).patch(`/api/staff/tickets/${t1}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "CANCELLED" });
    expect(r8.status).toBe(200);

    const after = await prisma.ticket.findUnique({ where: { ticketNumber: t1 } });
    expect(after!.currentStatus).toBe("CANCELLED");
  });

  itIfDb("RESOLVED -> REOPENED is permitted", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Transition resolved-reopened",
      status: "RESOLVED",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "REOPENED" });
    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("REOPENED");
  });

  // Issue #38 review fix (B-1): the matrix's validation column reads "Ticket
  // owned" (non-null), not "owned by the acting user". specification.md §6
  // grants "Perform permitted status changes" to the whole IT Staff/Administrator
  // group, so a *different* active staff member must be able to progress a
  // claimed Ticket. This case is what the original suite never exercised.
  itIfDb("a different active IT Staff member may change status on a ticket owned by staff A", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Cross-actor status change (staff B)",
      status: "NEW",
      ownerId: staffA.userId,
    });

    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffB,
      { csrf: true },
    ).send({ status: "OPEN" });

    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("OPEN");

    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("OPEN");
    // The status change must not silently reassign ownership.
    expect(after!.ticketOwnerId).toBe(staffA.userId);
  });

  itIfDb("an Administrator may change status on a ticket owned by staff A", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Cross-actor status change (admin)",
      status: "NEW",
      ownerId: staffA.userId,
    });

    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      admin,
      { csrf: true },
    ).send({ status: "OPEN" });

    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("OPEN");

    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("OPEN");
    expect(after!.ticketOwnerId).toBe(staffA.userId);
  });
});

describe("API-STAFF-04 — Forbidden status transitions (AC-13)", () => {
  itIfDb("NEW -> CLOSED -> 409 CONFLICT, no mutation", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Forbidden new-closed",
      status: "NEW",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "CLOSED" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("NEW");
  });

  itIfDb("CANCELLED -> OPEN -> 409 CONFLICT (terminal), no mutation", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Forbidden cancelled-open",
      status: "CANCELLED",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(res.status).toBe(409);
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("CANCELLED");
  });

  itIfDb("invalid status value -> 400 VALIDATION_ERROR, no mutation (distinct from 409)", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Invalid status value",
      status: "NEW",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "NOT_A_STATUS" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("NEW");
  });
});

describe("API-STAFF-07 — Status change on nonexistent/forbidden ticket (AC-13)", () => {
  itIfDb("nonexistent ticket -> 404 NOT_FOUND", async () => {
    const res = await withSession(
      request(app).patch("/api/staff/tickets/TKT-2026-999999/status"),
      staffA,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("Requester caller -> 403 FORBIDDEN", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Status forbidden",
      ownerId: staffA.userId,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      requester,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("API-STAFF-08 — Status change on an unowned ticket (AC-13)", () => {
  itIfDb("unowned ticket -> 409 CONFLICT and never auto-claims", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Unowned status change",
      status: "NEW",
      ownerId: null,
    });
    const res = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
    expect(after!.currentStatus).toBe("NEW");
    expect(after!.ticketOwnerId).toBeNull();
  });

  itIfDb("claim then NEW -> OPEN succeeds (migrated-shape ticket, M-38-5)", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Migrated claim then open",
      status: "NEW",
      ownerId: null,
    });

    const claim = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/owner`),
      staffA,
      { csrf: true },
    ).send({ ownerId: staffA.userId });
    expect(claim.status).toBe(200);

    const transition = await withSession(
      request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
      staffA,
      { csrf: true },
    ).send({ status: "OPEN" });
    expect(transition.status).toBe(200);
    expect(transition.body.data.currentStatus).toBe("OPEN");
  });
});

describe("Supplementary — Staff Detail GET scoping (AC-11)", () => {
  itIfDb("GET staff detail returns comments and notes scoped per role", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff detail scoping",
      ownerId: staffA.userId,
    });

    await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/comments`),
      requester,
      { csrf: true },
    ).send({ content: "Public comment for detail." });
    await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/notes`),
      staffA,
      { csrf: true },
    ).send({ content: "Internal note for detail." });

    const res = await withSession(
      request(app).get(`/api/staff/tickets/${ticketNumber}`),
      staffA,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.ticketNumber).toBe(ticketNumber);
    expect(res.body.data.publicComments).toHaveLength(1);
    expect(res.body.data.internalNotes).toHaveLength(1);
  });

  itIfDb("GET staff detail on a nonexistent ticket -> 404", async () => {
    const res = await withSession(
      request(app).get("/api/staff/tickets/TKT-2026-999999"),
      staffA,
    );
    expect(res.status).toBe(404);
  });

  itIfDb("Requester GET staff detail -> 403", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Detail role gate" });
    const res = await withSession(
      request(app).get(`/api/staff/tickets/${ticketNumber}`),
      requester,
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Issue #38 review fix (49-B2) — Existing Attachments on the Staff Detail
// (ui-spec §5.7). The Staff surface is read-only: it consumes the existing
// shared attachment read routes and never exposes upload/remove.
// ---------------------------------------------------------------------------

/** Creates an Attachment row directly for a Ticket. */
async function createAttachment(options: {
  ticketNumber: string;
  uploaderUserId: number;
  filename: string;
  mimeType?: string;
  isRemoved?: boolean;
  removalReason?: string | null;
}): Promise<number> {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: options.ticketNumber } });
  const row = await prisma.attachment.create({
    data: {
      ticketId: ticket!.id,
      originalFilename: options.filename,
      storedFilename: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      mimeType: options.mimeType ?? "image/jpeg",
      fileSizeBytes: 12345,
      uploaderUserId: options.uploaderUserId,
      isRemoved: options.isRemoved ?? false,
      removedAt: options.isRemoved ? new Date() : null,
      removalReason: options.isRemoved ? (options.removalReason ?? null) : null,
      removedByUserId: options.isRemoved ? options.uploaderUserId : null,
    },
  });
  return row.id;
}

describe("API-49-ATT — Staff Detail Existing Attachments (49-B2)", () => {
  itIfDb("API-49-01 — IT Staff receives attachment metadata in the detail payload", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff detail attachments",
      ownerId: staffA.userId,
    });
    await createAttachment({ ticketNumber, uploaderUserId: requester.userId, filename: "photo.jpg" });

    const res = await withSession(request(app).get(`/api/staff/tickets/${ticketNumber}`), staffA);
    expect(res.status).toBe(200);
    expect(res.body.data.attachments).toHaveLength(1);
    const att = res.body.data.attachments[0];
    expect(att.originalFilename).toBe("photo.jpg");
    expect(att.mimeType).toBe("image/jpeg");
    expect(att.fileSizeBytes).toBe(12345);
    expect(att.isRemoved).toBe(false);
    expect(typeof att.id).toBe("number");
    expect(att.uploadedAt).toBeTruthy();
  });

  itIfDb("API-49-02 — Administrator receives attachment metadata", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Admin detail attachments",
      ownerId: staffA.userId,
    });
    await createAttachment({ ticketNumber, uploaderUserId: requester.userId, filename: "admin.pdf" });

    const res = await withSession(request(app).get(`/api/staff/tickets/${ticketNumber}`), admin);
    expect(res.status).toBe(200);
    expect(res.body.data.attachments).toHaveLength(1);
    expect(res.body.data.attachments[0].originalFilename).toBe("admin.pdf");
  });

  itIfDb("API-49-03 — Requester cannot use the Staff Detail endpoint", async () => {
    const ticketNumber = await createTicket({ requesterId: requester.userId, summary: "Requester blocked" });
    const res = await withSession(request(app).get(`/api/staff/tickets/${ticketNumber}`), requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("API-49-04 — Attachment preview works for Staff", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff preview",
      ownerId: staffA.userId,
    });
    // Upload a real file as the owning Requester so the stored bytes exist.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const upload = await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/attachments`),
      requester,
      { csrf: true },
    ).attach("file", jpeg, "preview.jpg");
    expect(upload.status).toBe(201);
    const attachmentId = upload.body.data.id as number;

    const res = await withSession(
      request(app).get(`/api/attachments/${attachmentId}/preview`),
      staffA,
    );
    expect(res.status).toBe(200);
  });

  itIfDb("API-49-05 — Attachment download works for Staff", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff download",
      ownerId: staffA.userId,
    });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const upload = await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/attachments`),
      requester,
      { csrf: true },
    ).attach("file", jpeg, "download.jpg");
    expect(upload.status).toBe(201);
    const attachmentId = upload.body.data.id as number;

    const res = await withSession(
      request(app).get(`/api/attachments/${attachmentId}/download`),
      staffA,
    );
    expect(res.status).toBe(200);
  });

  itIfDb("API-49-06 — a removed attachment is represented correctly", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Removed attachment",
      ownerId: staffA.userId,
    });
    await createAttachment({
      ticketNumber,
      uploaderUserId: requester.userId,
      filename: "removed.jpg",
      isRemoved: true,
      removalReason: "Duplicate upload",
    });

    const res = await withSession(request(app).get(`/api/staff/tickets/${ticketNumber}`), staffA);
    expect(res.status).toBe(200);
    const att = res.body.data.attachments[0];
    expect(att.isRemoved).toBe(true);
    expect(att.removalReason).toBe("Duplicate upload");
    expect(att.removedAt).not.toBeNull();
  });

  itIfDb("API-49-07 — a removed attachment cannot be previewed or downloaded", async () => {
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Removed attachment read",
      ownerId: staffA.userId,
    });
    const attachmentId = await createAttachment({
      ticketNumber,
      uploaderUserId: requester.userId,
      filename: "gone.jpg",
      isRemoved: true,
    });

    const preview = await withSession(
      request(app).get(`/api/attachments/${attachmentId}/preview`),
      staffA,
    );
    expect(preview.status).toBe(410);
    expect(preview.body.error.code).toBe("ATTACHMENT_REMOVED");

    const download = await withSession(
      request(app).get(`/api/attachments/${attachmentId}/download`),
      staffA,
    );
    expect(download.status).toBe(410);
    expect(download.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  itIfDb("API-49-08 — Staff cannot upload through the attachment surface", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff upload blocked",
      ownerId: staffA.userId,
    });
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
    const before = await prisma.attachment.count({ where: { ticketId: ticket!.id } });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/attachments`),
      staffA,
      { csrf: true },
    ).attach("file", jpeg, "staff-upload.jpg");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    const after = await prisma.attachment.count({ where: { ticketId: ticket!.id } });
    expect(after).toBe(before);
  });

  itIfDb("API-49-09 — Staff cannot remove attachments", async () => {
    const prisma = getPrisma();
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: "Staff remove blocked",
      ownerId: staffA.userId,
    });
    const attachmentId = await createAttachment({
      ticketNumber,
      uploaderUserId: requester.userId,
      filename: "keep.jpg",
    });

    const res = await withSession(
      request(app).delete(`/api/attachments/${attachmentId}`),
      staffA,
      { csrf: true },
    ).send({ removalReason: "Staff should not be able to do this" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    const after = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    expect(after!.isRemoved).toBe(false);
  });
});

describe("API-STAFF-11 — Full status transition matrix (AC-13)", () => {
  itIfDb("matches the shared matrix for every source and target status", async () => {
    const prisma = getPrisma();

    for (const fromStatus of TICKET_STATUSES) {
      for (const targetStatus of TICKET_STATUSES) {
        const ticketNumber = await createTicket({
          requesterId: requester.userId,
          summary: `Matrix ${fromStatus} to ${targetStatus}`,
          status: fromStatus,
          ownerId: staffA.userId,
        });
        const response = await withSession(
          request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
          staffA,
          { csrf: true },
        ).send({ status: targetStatus });
        const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
        const permitted = expectedTransitionAllowed(fromStatus, targetStatus);

        if (permitted) {
          expect(response.status, `${fromStatus} -> ${targetStatus}`).toBe(200);
          expect(response.body.data.currentStatus).toBe(targetStatus);
          expect(after!.currentStatus).toBe(targetStatus);
        } else {
          expect(response.status, `${fromStatus} -> ${targetStatus}`).toBe(409);
          expect(response.body.error.code).toBe("CONFLICT");
          expect(after!.currentStatus).toBe(fromStatus);
        }
      }
    }
  });

  itIfDb("rejects every matrix target on an unowned ticket without mutation", async () => {
    const prisma = getPrisma();

    for (const fromStatus of TICKET_STATUSES) {
      const ticketNumber = await createTicket({
        requesterId: requester.userId,
        summary: `Unowned matrix ${fromStatus}`,
        status: fromStatus,
        ownerId: null,
      });
      for (const targetStatus of TICKET_STATUSES) {
        const response = await withSession(
          request(app).patch(`/api/staff/tickets/${ticketNumber}/status`),
          staffA,
          { csrf: true },
        ).send({ status: targetStatus });
        expect(response.status, `${fromStatus} -> ${targetStatus}`).toBe(409);
        const after = await prisma.ticket.findUnique({ where: { ticketNumber } });
        expect(after!.currentStatus).toBe(fromStatus);
      }
    }
  });
});