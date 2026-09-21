/**
 * Frozen Test-DD file: `server/tests/lab-03/requester.api.test.ts`
 *
 * Owned by Issue #37. Frozen rows executed here:
 *   - API-REQ-01  Requester creates Ticket (authenticated identity, itPriority, validation bounds)
 *   - API-REQ-02  Requester My Tickets (search/filter/sort/pagination preserved; role gate)
 *
 * Supplementary (never a tests.md row): RR-03 soft-remove invariant assertion.
 *
 * API-REQ-04 is owned by #38 and is deliberately NOT implemented here — #38 appends
 * to this file later.
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

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const REQ_A_EMAIL = "req-api-a@example.com";
const REQ_B_EMAIL = "req-api-b@example.com";
const STAFF_EMAIL = "req-api-staff@example.com";
const ADMIN_EMAIL = "req-api-admin@example.com";

let requesterA: TestSession;
let requesterB: TestSession;
let staff: TestSession;
let admin: TestSession;

let categoryId: number;
let systemId: number;

const createdTicketNumbers: string[] = [];

/** Creates a Ticket directly for a requester and tracks it for cleanup. */
async function seedTicket(
  requesterId: number,
  overrides: {
    summary?: string;
    requestedPriority?: "LOW" | "MEDIUM" | "HIGH";
    currentStatus?:
      | "NEW"
      | "OPEN"
      | "IN_PROGRESS"
      | "WAITING_FOR_REQUESTER"
      | "RESOLVED"
      | "CLOSED"
      | "REOPENED"
      | "CANCELLED";
    createdAt?: Date;
  } = {},
): Promise<string> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  const now = overrides.createdAt ?? rows[0]!.now;
  const year = now.getUTCFullYear();
  const seq = await prisma.ticketSequence.upsert({
    where: { year },
    create: { year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  const ticketNumber = `TKT-${year}-${String(seq.lastSeq).padStart(6, "0")}`;
  createdTicketNumbers.push(ticketNumber);
  await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      summary: overrides.summary ?? `Seeded ticket ${ticketNumber}`,
      description: "Seeded ticket description for My Tickets tests.",
      requestedPriority: overrides.requestedPriority ?? "MEDIUM",
      itPriority: overrides.requestedPriority ?? "MEDIUM",
      currentStatus: overrides.currentStatus ?? "NEW",
      createdAt: now,
      updatedAt: now,
    },
  });
  return ticketNumber;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;

  const prisma = getPrisma();

  await ensureTestUser({ email: REQ_A_EMAIL, name: "Req Api A", role: "REQUESTER" });
  await ensureTestUser({ email: REQ_B_EMAIL, name: "Req Api B", role: "REQUESTER" });
  await ensureTestUser({ email: STAFF_EMAIL, name: "Req Api Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: ADMIN_EMAIL, name: "Req Api Admin", role: "ADMINISTRATOR" });

  requesterA = await loginAs(REQ_A_EMAIL);
  requesterB = await loginAs(REQ_B_EMAIL);
  staff = await loginAs(STAFF_EMAIL);
  admin = await loginAs(ADMIN_EMAIL);

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: `Req Api Cat-${Date.now()}`, isActive: true } });
  }
  categoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({ data: { name: `Req Api Sys-${Date.now()}`, isActive: true } });
  }
  systemId = sys.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();
  for (const tn of createdTicketNumbers) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: tn } });
    if (ticket) {
      await prisma.attachment.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  }
  await disconnectPrisma();
});

describe("API-REQ-01: Requester creates Ticket", () => {
  itIfDb("creates a ticket owned by the authenticated identity with itPriority = requestedPriority", async () => {
    const res = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      categoryId,
      relatedSystemId: systemId,
      summary: "Printer not working",
      description: "The printer is offline and needs attention.",
      requestedPriority: "HIGH",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.requesterId).toBe(requesterA.userId);
    expect(res.body.data.requestedPriority).toBe("HIGH");
    expect(res.body.data.itPriority).toBe("HIGH");
    expect(res.body.data.currentStatus).toBe("NEW");
    expect(res.body.data.ticketOwnerId).toBeNull();

    createdTicketNumbers.push(res.body.data.ticketNumber);
  });

  itIfDb("ignores an unknown `title` property and still creates the ticket", async () => {
    const res = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      categoryId,
      relatedSystemId: systemId,
      summary: "Unknown property probe",
      description: "A title property is not part of the frozen contract.",
      requestedPriority: "LOW",
      title: "This field does not exist in the contract",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.requesterId).toBe(requesterA.userId);
    createdTicketNumbers.push(res.body.data.ticketNumber);
  });

  itIfDb("summary boundary: 4 chars rejected, 5 accepted, 120 accepted, 121 rejected", async () => {
    const base = {
      categoryId,
      relatedSystemId: systemId,
      description: "A valid description for boundary testing.",
      requestedPriority: "MEDIUM",
    };

    const tooShort = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      summary: "abcd",
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe("VALIDATION_ERROR");

    const min = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      summary: "abcde",
    });
    expect(min.status).toBe(201);
    createdTicketNumbers.push(min.body.data.ticketNumber);

    const max = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      summary: "a".repeat(120),
    });
    expect(max.status).toBe(201);
    createdTicketNumbers.push(max.body.data.ticketNumber);

    const tooLong = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      summary: "a".repeat(121),
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("description boundary: 9 chars rejected, 10 accepted, 2000 accepted, 2001 rejected", async () => {
    const base = {
      categoryId,
      relatedSystemId: systemId,
      summary: "Description boundary probe",
      requestedPriority: "MEDIUM",
    };

    const tooShort = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      description: "a".repeat(9),
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe("VALIDATION_ERROR");

    const min = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      description: "a".repeat(10),
    });
    expect(min.status).toBe(201);
    createdTicketNumbers.push(min.body.data.ticketNumber);

    const max = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      description: "a".repeat(2000),
    });
    expect(max.status).toBe(201);
    createdTicketNumbers.push(max.body.data.ticketNumber);

    const tooLong = await withSession(request(app).post("/api/tickets"), requesterA, { csrf: true }).send({
      ...base,
      description: "a".repeat(2001),
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-REQ-02: Requester My Tickets", () => {
  itIfDb("returns only the authenticated Requester's own tickets", async () => {
    const mine = await seedTicket(requesterA.userId, { summary: "Mine only ticket" });
    const theirs = await seedTicket(requesterB.userId, { summary: "Theirs only ticket" });

    const res = await withSession(request(app).get("/api/tickets"), requesterA);
    expect(res.status).toBe(200);

    const numbers = (res.body.data as Array<{ ticketNumber: string }>).map((t) => t.ticketNumber);
    expect(numbers).toContain(mine);
    expect(numbers).not.toContain(theirs);
  });

  itIfDb("search matches ticketNumber and summary substrings", async () => {
    const target = await seedTicket(requesterA.userId, { summary: "Unique searchable phrase" });

    const bySummary = await withSession(
      request(app).get("/api/tickets").query({ search: "searchable phrase" }),
      requesterA,
    );
    expect(bySummary.status).toBe(200);
    expect((bySummary.body.data as Array<{ ticketNumber: string }>).map((t) => t.ticketNumber)).toContain(target);

    const byNumber = await withSession(
      request(app).get("/api/tickets").query({ search: target }),
      requesterA,
    );
    expect(byNumber.status).toBe(200);
    expect((byNumber.body.data as Array<{ ticketNumber: string }>).map((t) => t.ticketNumber)).toContain(target);
  });

  itIfDb("filters by categoryId, requestedPriority, and status", async () => {
    const high = await seedTicket(requesterA.userId, { requestedPriority: "HIGH" });

    const byPriority = await withSession(
      request(app).get("/api/tickets").query({ requestedPriority: "HIGH" }),
      requesterA,
    );
    expect(byPriority.status).toBe(200);
    const priorities = (byPriority.body.data as Array<{ requestedPriority: string }>).map((t) => t.requestedPriority);
    expect(priorities.every((p) => p === "HIGH")).toBe(true);
    expect((byPriority.body.data as Array<{ ticketNumber: string }>).map((t) => t.ticketNumber)).toContain(high);

    const byCategory = await withSession(
      request(app).get("/api/tickets").query({ categoryId }),
      requesterA,
    );
    expect(byCategory.status).toBe(200);
    expect((byCategory.body.data as Array<{ categoryId: number }>).every((t) => t.categoryId === categoryId)).toBe(true);

    const byStatus = await withSession(
      request(app).get("/api/tickets").query({ status: "NEW" }),
      requesterA,
    );
    expect(byStatus.status).toBe(200);
    expect((byStatus.body.data as Array<{ currentStatus: string }>).every((t) => t.currentStatus === "NEW")).toBe(true);
  });

  itIfDb("filters by every non-NEW Ticket status in the frozen enum", async () => {
    // One seeded Ticket per non-NEW status; each filter must return only that status.
    const nonNewStatuses = [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "CANCELLED",
    ] as const;

    for (const status of nonNewStatuses) {
      const seeded = await seedTicket(requesterA.userId, {
        summary: `Status filter probe ${status}`,
        currentStatus: status,
      });

      const res = await withSession(
        request(app).get("/api/tickets").query({ status, pageSize: 50 }),
        requesterA,
      );

      expect(res.status).toBe(200);
      const items = res.body.data as Array<{ ticketNumber: string; currentStatus: string }>;
      expect(items.every((t) => t.currentStatus === status)).toBe(true);
      expect(items.map((t) => t.ticketNumber)).toContain(seeded);
    }
  });

  itIfDb("supports the documented sort keys createdAt/ticketNumber/summary/status/priority in both directions", async () => {
    await seedTicket(requesterA.userId, { summary: "Sort probe alpha" });
    await seedTicket(requesterA.userId, { summary: "Sort probe beta" });

    for (const sort of ["createdAt", "ticketNumber", "summary", "status", "priority"]) {
      for (const order of ["asc", "desc"]) {
        const res = await withSession(
          request(app).get("/api/tickets").query({ sort, order, pageSize: 50 }),
          requesterA,
        );
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    }
  });

  itIfDb("sort=status orders by the logical workflow sequence, not alphabetically", async () => {
    await seedTicket(requesterA.userId, { summary: "Status order probe NEW", currentStatus: "NEW" });
    await seedTicket(requesterA.userId, { summary: "Status order probe OPEN", currentStatus: "OPEN" });
    await seedTicket(requesterA.userId, { summary: "Status order probe CLOSED", currentStatus: "CLOSED" });

    const res = await withSession(
      request(app).get("/api/tickets").query({ sort: "status", order: "asc", search: "Status order probe", pageSize: 50 }),
      requesterA,
    );
    expect(res.status).toBe(200);

    const statuses = (res.body.data as Array<{ currentStatus: string }>).map((t) => t.currentStatus);
    // NEW (1) < OPEN (2) < CLOSED (6) — alphabetical would give CLOSED < NEW < OPEN.
    expect(statuses).toEqual(["NEW", "OPEN", "CLOSED"]);
  });

  itIfDb("sort=priority orders by the logical LOW < MEDIUM < HIGH sequence", async () => {
    await seedTicket(requesterA.userId, { summary: "Priority order probe low", requestedPriority: "LOW" });
    await seedTicket(requesterA.userId, { summary: "Priority order probe high", requestedPriority: "HIGH" });
    await seedTicket(requesterA.userId, { summary: "Priority order probe medium", requestedPriority: "MEDIUM" });

    const res = await withSession(
      request(app).get("/api/tickets").query({ sort: "priority", order: "asc", search: "Priority order probe", pageSize: 50 }),
      requesterA,
    );
    expect(res.status).toBe(200);

    const priorities = (res.body.data as Array<{ requestedPriority: string }>).map((t) => t.requestedPriority);
    expect(priorities).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  itIfDb("retains the Lab 2 `requestedPriority` sort alias", async () => {
    const res = await withSession(
      request(app).get("/api/tickets").query({ sort: "requestedPriority", order: "asc", pageSize: 50 }),
      requesterA,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  itIfDb("paginates with page/pageSize and reports pagination metadata", async () => {
    const res = await withSession(
      request(app).get("/api/tickets").query({ page: 1, pageSize: 2 }),
      requesterA,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
    expect(typeof res.body.pagination.totalItems).toBe("number");
    expect(typeof res.body.pagination.totalPages).toBe("number");
    expect(typeof res.body.pagination.unfilteredTotalItems).toBe("number");
  });

  itIfDb("invalid query values fall back to safe defaults (never 400)", async () => {
    const res = await withSession(
      request(app).get("/api/tickets").query({ sort: "bogus", order: "sideways", page: "x", pageSize: "999" }),
      requesterA,
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  itIfDb("invalid sort falls back to createdAt desc (never 400)", async () => {
    const res = await withSession(
      request(app).get("/api/tickets").query({ sort: "notAField", pageSize: 50 }),
      requesterA,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Same result set as the explicit default sort.
    const explicit = await withSession(
      request(app).get("/api/tickets").query({ sort: "createdAt", order: "desc", pageSize: 50 }),
      requesterA,
    );
    expect(res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual(
      explicit.body.data.map((t: { ticketNumber: string }) => t.ticketNumber),
    );
  });

  itIfDb("invalid status/requestedPriority enums remain 400 VALIDATION_ERROR (Lab 2 contract preserved)", async () => {
    // The frozen Lab 2 contract (docs/lab-02/api-spec.md, API-MY-07) classifies an
    // out-of-enum filter value as a validation error, not a fallback default. Lab 3
    // widens the accepted status set but does not change that rule.
    const badStatus = await withSession(
      request(app).get("/api/tickets").query({ status: "NOT_A_STATUS" }),
      requesterA,
    );
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.error.code).toBe("VALIDATION_ERROR");

    const badPriority = await withSession(
      request(app).get("/api/tickets").query({ requestedPriority: "URGENT" }),
      requesterA,
    );
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("supplementary role gate: IT Staff -> 403 FORBIDDEN (not an empty list)", async () => {
    const res = await withSession(request(app).get("/api/tickets"), staff);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("supplementary role gate: Administrator -> 403 FORBIDDEN (not an empty list)", async () => {
    const res = await withSession(request(app).get("/api/tickets"), admin);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Supplementary — RR-03: attachment soft-remove invariant", () => {
  itIfDb("soft-remove sets isRemoved/removedAt/removedByUserId and the forbidden state never occurs", async () => {
    const prisma = getPrisma();
    const ticketNumber = await seedTicket(requesterA.userId, { summary: "Soft remove invariant ticket" });
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const uploadRes = await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/attachments`),
      requesterA,
      { csrf: true },
    ).attach("file", jpeg, "invariant.jpg");
    expect(uploadRes.status).toBe(201);
    const attachmentId = uploadRes.body.data.id as number;

    const removeRes = await withSession(
      request(app).delete(`/api/attachments/${attachmentId}`),
      requesterA,
      { csrf: true },
    ).send({ removalReason: "No longer needed" });
    expect(removeRes.status).toBe(200);

    const row = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    expect(row!.isRemoved).toBe(true);
    expect(row!.removedAt).not.toBeNull();
    expect(row!.removalReason).toBe("No longer needed");
    // The remover-identity write targets the renamed column (landed by #35 DM-17).
    expect(row!.removedByUserId).toBe(requesterA.userId);

    // A second soft-remove is rejected by the atomic `WHERE isRemoved = false` guard.
    const secondRes = await withSession(
      request(app).delete(`/api/attachments/${attachmentId}`),
      requesterA,
      { csrf: true },
    );
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe("CONFLICT");

    // The forbidden state (`removedAt` set with `isRemoved = false`) must never occur.
    const forbidden = await prisma.attachment.count({
      where: { removedAt: { not: null }, isRemoved: false },
    });
    expect(forbidden).toBe(0);

    await prisma.attachment.deleteMany({ where: { ticketId: ticket!.id } });
  });
});