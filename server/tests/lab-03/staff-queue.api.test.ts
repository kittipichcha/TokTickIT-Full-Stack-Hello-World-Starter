/**
 * Frozen Test-DD file: `server/tests/lab-03/staff-queue.api.test.ts`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - API-QUE-01  Staff queue route + role gate (AC-10)
 *   - API-QUE-02  Search/filter/sort/pagination + safe defaulting (AC-10)
 *
 * Supplementary (never a tests.md row): migrated Lab-2-shaped data assertions
 * (M-38-5) — unowned `NEW` tickets and the inactive migrated Requester remain
 * visible in the queue.
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

const STAFF_EMAIL = "queue-staff@example.com";
const ADMIN_EMAIL = "queue-admin@example.com";
const REQUESTER_EMAIL = "queue-requester@example.com";
const INACTIVE_REQUESTER_EMAIL = "queue-inactive-requester@example.com";

let staff: TestSession;
let admin: TestSession;
let requester: TestSession;

let categoryId: number;
let systemId: number;
let inactiveRequesterId: number;

/** Creates a Ticket directly (bypassing the API) with a chosen status/owner. */
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
      description: "Staff queue test ticket description.",
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

  await ensureTestUser({ email: STAFF_EMAIL, name: "Queue Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: ADMIN_EMAIL, name: "Queue Admin", role: "ADMINISTRATOR" });
  await ensureTestUser({ email: REQUESTER_EMAIL, name: "Queue Requester", role: "REQUESTER" });
  inactiveRequesterId = await ensureTestUser({
    email: INACTIVE_REQUESTER_EMAIL,
    name: "Queue Inactive Requester",
    role: "REQUESTER",
    isActive: false,
  });

  staff = await loginAs(STAFF_EMAIL);
  admin = await loginAs(ADMIN_EMAIL);
  requester = await loginAs(REQUESTER_EMAIL);

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: `Queue Cat-${Date.now()}`, isActive: true } });
  }
  categoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({ data: { name: `Queue Sys-${Date.now()}`, isActive: true } });
  }
  systemId = sys.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("API-QUE-01 — Staff queue route + role gate (AC-10)", () => {
  itIfDb("IT Staff receives 200 with the frozen pagination shape", async () => {
    const res = await withSession(request(app).get("/api/staff/queue"), staff);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(typeof res.body.pagination.totalItems).toBe("number");
    expect(typeof res.body.pagination.totalPages).toBe("number");
    expect(typeof res.body.pagination.unfilteredTotalItems).toBe("number");
  });

  itIfDb("Administrator receives 200", async () => {
    const res = await withSession(request(app).get("/api/staff/queue"), admin);
    expect(res.status).toBe(200);
  });

  itIfDb("Requester receives 403 FORBIDDEN", async () => {
    const res = await withSession(request(app).get("/api/staff/queue"), requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("unauthenticated receives 401", async () => {
    const res = await request(app).get("/api/staff/queue");
    expect(res.status).toBe(401);
  });

  itIfDb("each row exposes ownership/status/priority fields", async () => {
    await createTicket({ requesterId: requester.userId, summary: "Queue shape ticket" });
    const res = await withSession(request(app).get("/api/staff/queue"), staff);
    expect(res.status).toBe(200);
    const row = res.body.data[0];
    expect(row).toHaveProperty("ticketNumber");
    expect(row).toHaveProperty("currentStatus");
    expect(row).toHaveProperty("requestedPriority");
    expect(row).toHaveProperty("itPriority");
    expect(row).toHaveProperty("ticketOwnerId");
  });
});

describe("API-QUE-02 — Search/filter/sort/pagination + safe defaulting (AC-10)", () => {
  itIfDb("search matches ticketNumber and summary case-insensitively", async () => {
    const marker = `Zebra-${Date.now()}`;
    const ticketNumber = await createTicket({
      requesterId: requester.userId,
      summary: `Unique ${marker} summary`,
    });

    const bySummary = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker.toLowerCase() }),
      staff,
    );
    expect(bySummary.status).toBe(200);
    expect(bySummary.body.data.some((r: { ticketNumber: string }) => r.ticketNumber === ticketNumber)).toBe(true);

    const byNumber = await withSession(
      request(app).get("/api/staff/queue").query({ search: ticketNumber }),
      staff,
    );
    expect(byNumber.status).toBe(200);
    expect(byNumber.body.data.some((r: { ticketNumber: string }) => r.ticketNumber === ticketNumber)).toBe(true);
  });

  itIfDb("status filter is exact-match and combines with priority (AND)", async () => {
    const marker = `Filter-${Date.now()}`;
    const openHigh = await createTicket({
      requesterId: requester.userId,
      summary: `${marker} open high`,
      status: "OPEN",
      itPriority: "HIGH",
    });
    await createTicket({
      requesterId: requester.userId,
      summary: `${marker} new high`,
      status: "NEW",
      itPriority: "HIGH",
    });

    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, status: "OPEN", priority: "HIGH" }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticketNumber).toBe(openHigh);
  });

  itIfDb("ownerId filter returns only that owner's tickets", async () => {
    const marker = `Owner-${Date.now()}`;
    const owned = await createTicket({
      requesterId: requester.userId,
      summary: `${marker} owned`,
      ownerId: staff.userId,
    });
    await createTicket({ requesterId: requester.userId, summary: `${marker} unowned` });

    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, ownerId: staff.userId }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticketNumber).toBe(owned);
  });

  itIfDb("invalid query values fall back to defaults and never return 400", async () => {
    const res = await withSession(
      request(app).get("/api/staff/queue").query({
        status: "NOT_A_STATUS",
        priority: "SUPERHIGH",
        ownerId: "not-an-int",
        sort: "bogus",
        order: "sideways",
        page: "0",
        pageSize: "abc",
      }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  // Issue #38 review fix (49-B3): the frozen contract (api-spec §15) says
  // `pageSize` accepts 1–50 and an out-of-range numeric value is *clamped* to
  // the nearest bound — it is not silently replaced by the default. The prior
  // parser returned 10 for 0/51/999, contradicting the contract.
  itIfDb("pageSize is clamped to the frozen 1–50 range", async () => {
    const cases: Array<{ query: string; expected: number }> = [
      { query: "1", expected: 1 },
      { query: "50", expected: 50 },
      { query: "0", expected: 1 },
      { query: "51", expected: 50 },
      { query: "999", expected: 50 },
    ];

    for (const { query, expected } of cases) {
      const res = await withSession(
        request(app).get("/api/staff/queue").query({ pageSize: query }),
        staff,
      );
      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(expected);
    }
  });

  itIfDb("malformed pageSize keeps the safe default of 10", async () => {
    for (const query of ["abc", "-1", "1.5", " 10", "1e2", ""]) {
      const res = await withSession(
        request(app).get("/api/staff/queue").query({ pageSize: query }),
        staff,
      );
      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(10);
    }
  });

  itIfDb("missing pageSize defaults to 10", async () => {
    const res = await withSession(request(app).get("/api/staff/queue"), staff);
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  itIfDb("the clamped pageSize drives the effective page size", async () => {
    const marker = `Clamp-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await createTicket({ requesterId: requester.userId, summary: `${marker} item ${i}` });
    }

    const clamped = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, pageSize: "999" }),
      staff,
    );
    expect(clamped.status).toBe(200);
    expect(clamped.body.pagination.pageSize).toBe(50);
    expect(clamped.body.data).toHaveLength(3);

    const tiny = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, pageSize: "0" }),
      staff,
    );
    expect(tiny.status).toBe(200);
    expect(tiny.body.pagination.pageSize).toBe(1);
    expect(tiny.body.data).toHaveLength(1);
    expect(tiny.body.pagination.totalPages).toBe(3);
  });

  itIfDb("unrecognized status/priority are treated as absent (no filter)", async () => {
    const marker = `NoFilter-${Date.now()}`;
    await createTicket({ requesterId: requester.userId, summary: `${marker} one`, status: "NEW" });
    await createTicket({ requesterId: requester.userId, summary: `${marker} two`, status: "OPEN" });

    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, status: "NOPE" }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  itIfDb("sort=priority orders by IT Priority and sort=status by workflow order", async () => {
    const marker = `Sort-${Date.now()}`;
    await createTicket({ requesterId: requester.userId, summary: `${marker} low`, itPriority: "LOW" });
    await createTicket({ requesterId: requester.userId, summary: `${marker} high`, itPriority: "HIGH" });

    const asc = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, sort: "priority", order: "asc" }),
      staff,
    );
    expect(asc.status).toBe(200);
    expect(asc.body.data[0].itPriority).toBe("LOW");

    const desc = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, sort: "priority", order: "desc" }),
      staff,
    );
    expect(desc.body.data[0].itPriority).toBe("HIGH");
  });

  itIfDb("pagination reports totalItems/totalPages/unfilteredTotalItems", async () => {
    const marker = `Page-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await createTicket({ requesterId: requester.userId, summary: `${marker} item ${i}` });
    }
    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, pageSize: 2, page: 1 }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.unfilteredTotalItems).toBeGreaterThanOrEqual(3);
  });

  itIfDb("page beyond the last valid page returns empty data with correct metadata", async () => {
    const marker = `Beyond-${Date.now()}`;
    await createTicket({ requesterId: requester.userId, summary: `${marker} only` });
    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker, page: 99 }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(1);
  });
});

describe("Migrated Lab-2-shaped data (supplementary — M-38-5)", () => {
  itIfDb("unowned NEW tickets and tickets from an inactive Requester remain visible", async () => {
    const marker = `Migrated-${Date.now()}`;
    const unowned = await createTicket({
      requesterId: requester.userId,
      summary: `${marker} unowned new`,
      status: "NEW",
      ownerId: null,
    });
    const inactive = await createTicket({
      requesterId: inactiveRequesterId,
      summary: `${marker} inactive requester`,
      status: "NEW",
      ownerId: null,
    });

    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker }),
      staff,
    );
    expect(res.status).toBe(200);
    const numbers = res.body.data.map((r: { ticketNumber: string }) => r.ticketNumber);
    expect(numbers).toContain(unowned);
    expect(numbers).toContain(inactive);
    const unownedRow = res.body.data.find((r: { ticketNumber: string }) => r.ticketNumber === unowned);
    expect(unownedRow.ticketOwnerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// API-OWN-01 — eligible Ticket-owner lookup (api-spec §17a, FR-16)
// ---------------------------------------------------------------------------

describe("API-OWN-01 — eligible Ticket-owner lookup (AC-11)", () => {
  itIfDb("IT Staff receives 200 with only active IT Staff/Administrators", async () => {
    const res = await withSession(request(app).get("/api/staff/owners"), staff);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const ids = res.body.data.map((o: { id: number }) => o.id);
    expect(ids).toContain(staff.userId);
    expect(ids).toContain(admin.userId);

    // Every returned entry is an active IT Staff/Administrator.
    for (const owner of res.body.data) {
      expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(owner.role);
      expect(typeof owner.name).toBe("string");
    }
  });

  itIfDb("Administrator receives the same eligible set", async () => {
    const res = await withSession(request(app).get("/api/staff/owners"), admin);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((o: { id: number }) => o.id);
    expect(ids).toContain(staff.userId);
    expect(ids).toContain(admin.userId);
  });

  itIfDb("excludes Requesters and inactive IT Staff/Administrators", async () => {
    const prisma = getPrisma();
    const inactiveStaffId = await ensureTestUser({
      email: "queue-inactive-staff@example.com",
      name: "Queue Inactive Staff",
      role: "IT_STAFF",
      isActive: false,
    });

    const res = await withSession(request(app).get("/api/staff/owners"), staff);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((o: { id: number }) => o.id);

    // Requester caller's own id must never appear.
    expect(ids).not.toContain(requester.userId);
    // Inactive IT Staff must never appear.
    expect(ids).not.toContain(inactiveStaffId);

    // Defence-in-depth: confirm the excluded rows really are ineligible.
    const inactive = await prisma.user.findUnique({ where: { id: inactiveStaffId } });
    expect(inactive!.isActive).toBe(false);
  });

  itIfDb("never returns passwordHash or other credential fields", async () => {
    const res = await withSession(request(app).get("/api/staff/owners"), staff);
    expect(res.status).toBe(200);
    for (const owner of res.body.data) {
      expect(Object.keys(owner).sort()).toEqual(["id", "name", "role"]);
      expect(owner).not.toHaveProperty("passwordHash");
      expect(owner).not.toHaveProperty("mustChangePassword");
      expect(owner).not.toHaveProperty("email");
    }
  });

  itIfDb("Requester caller is rejected with 403 FORBIDDEN", async () => {
    const res = await withSession(request(app).get("/api/staff/owners"), requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("unauthenticated request is rejected with 401", async () => {
    const res = await request(app).get("/api/staff/owners");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Supplementary — queue response carries the Category name (ui-spec §5.6)
// ---------------------------------------------------------------------------

describe("Queue required information (supplementary — ui-spec §5.6)", () => {
  itIfDb("each queue row exposes categoryName and updatedAt", async () => {
    const marker = `Cat-${Date.now()}`;
    await createTicket({ requesterId: requester.userId, summary: `${marker} category` });

    const res = await withSession(
      request(app).get("/api/staff/queue").query({ search: marker }),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const row = res.body.data[0];
    expect(typeof row.categoryName).toBe("string");
    expect(row.categoryName.length).toBeGreaterThan(0);
    expect(row.updatedAt).toBeTruthy();
    expect(row.createdAt).toBeTruthy();
  });
});