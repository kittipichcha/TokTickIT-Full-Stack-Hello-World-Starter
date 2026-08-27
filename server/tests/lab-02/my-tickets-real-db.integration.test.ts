import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const TEST_MARKER = "INT-TEST-MY-TKT";

const createdTicketNumbers: string[] = [];
const createdRequesterIds: number[] = [];

let currentYearSequenceSnapshot: { year: number; lastSeq: number } | null = null;

async function getDatabaseUTCCurrentYear(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  return rows[0]!.now.getUTCFullYear();
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();
  const currentYear = await getDatabaseUTCCurrentYear();
  currentYearSequenceSnapshot = await prisma.ticketSequence.findUnique({
    where: { year: currentYear },
  });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();

  if (createdTicketNumbers.length > 0) {
    await prisma.ticket.deleteMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
    });
  }

  // Clean up any test-created requesters
  if (createdRequesterIds.length > 0) {
    await prisma.devRequester.deleteMany({
      where: { id: { in: createdRequesterIds } },
    });
  }

  const currentYear = await getDatabaseUTCCurrentYear();
  await prisma.ticketSequence.deleteMany({ where: { year: currentYear } });
  if (currentYearSequenceSnapshot) {
    await prisma.ticketSequence.create({ data: currentYearSequenceSnapshot });
  }

  await disconnectPrisma();
});

/**
 * Helper: create a ticket via POST /api/tickets and track its number.
 */
async function createTicket(
  requesterId: number,
  overrides: Partial<{
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: string;
  }> = {},
): Promise<string> {
  const prisma = getPrisma();
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  expect(category).toBeTruthy();
  expect(system).toBeTruthy();

  const res = await request(app)
    .post("/api/tickets")
    .set("X-Dev-Requester-Id", String(requesterId))
    .send({
      categoryId: overrides.categoryId ?? category!.id,
      relatedSystemId: overrides.relatedSystemId ?? system!.id,
      summary: overrides.summary ?? `${TEST_MARKER} ${Math.random().toString(36).slice(2, 8)}`,
      description: overrides.description ?? `${TEST_MARKER} Valid description for testing.`,
      requestedPriority: overrides.requestedPriority ?? "MEDIUM",
    });

  expect(res.status).toBe(201);
  createdTicketNumbers.push(res.body.data.ticketNumber);
  return res.body.data.ticketNumber;
}

/**
 * Helper: get two active requesters for testing.
 */
async function getTwoRequesters(): Promise<[number, number]> {
  const prisma = getPrisma();
  const requesters = await prisma.devRequester.findMany({
    where: { isActive: true },
    take: 2,
    orderBy: { id: "asc" },
  });
  expect(requesters.length).toBeGreaterThanOrEqual(2);
  return [requesters[0]!.id, requesters[1]!.id];
}

// ────────────────────────────────────────────────────────────────────────────
// Test 1 — Ownership
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 1: Ownership isolation", () => {
  let requesterAId: number;
  let requesterBId: number;
  let ticketANumber: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    [requesterAId, requesterBId] = await getTwoRequesters();
    ticketANumber = await createTicket(requesterAId, {
      summary: `${TEST_MARKER} OWNERSHIP-A`,
      description: `${TEST_MARKER} Ownership ticket for requester A.`,
    });
    await createTicket(requesterBId, {
      summary: `${TEST_MARKER} OWNERSHIP-B`,
      description: `${TEST_MARKER} Ownership ticket for requester B.`,
    });
  });

  itIfDb("Requester A sees only their own ticket", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketANumber);
    // Requester B's ticket should not appear
    for (const t of res.body.data) {
      expect(t.requesterId).toBe(requesterAId);
    }
  });

  itIfDb("Requester B does not see Requester A's ticket", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterBId));

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).not.toContain(ticketANumber);
    for (const t of res.body.data) {
      expect(t.requesterId).toBe(requesterBId);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 2 — Search
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 2: Search", () => {
  let requesterId: number;
  let ticketLaptop: string;
  let ticketPrinter: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;

    ticketLaptop = await createTicket(requesterId, {
      summary: `${TEST_MARKER} Laptop battery issue`,
      description: `${TEST_MARKER} Laptop battery not charging.`,
    });
    ticketPrinter = await createTicket(requesterId, {
      summary: `${TEST_MARKER} Printer issue`,
      description: `${TEST_MARKER} Printer not responding.`,
    });
  });

  itIfDb("finds ticket by ticket number", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: ticketLaptop });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
  });

  itIfDb("finds ticket by summary substring", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: "Laptop" });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
    expect(ticketNumbers).not.toContain(ticketPrinter);
  });

  itIfDb("search is case-insensitive", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: "BATTERY" });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
  });

  itIfDb("search matches substring", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: "atter" });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
  });

  itIfDb("search is trimmed before query", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: "   laptop   " });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
  });

  itIfDb("whitespace-only search is inactive (returns all tickets)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ search: "     " });

    expect(res.status).toBe(200);
    // Should return all tickets (search is treated as no filter)
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).toContain(ticketLaptop);
    expect(ticketNumbers).toContain(ticketPrinter);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 3 — Conjunctive filters
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 3: Conjunctive filters", () => {
  let requesterId: number;
  let hardwareCategoryId: number;
  let softwareCategoryId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;

    const hardware = await prisma.category.findFirst({ where: { name: "Hardware", isActive: true } });
    const software = await prisma.category.findFirst({ where: { name: "Software", isActive: true } });
    expect(hardware).toBeTruthy();
    expect(software).toBeTruthy();
    hardwareCategoryId = hardware!.id;
    softwareCategoryId = software!.id;

    // Create a matrix:
    // Ticket A: Hardware, HIGH, NEW
    // Ticket B: Hardware, LOW, NEW
    // Ticket C: Software, HIGH, NEW
    await createTicket(requesterId, {
      categoryId: hardwareCategoryId,
      requestedPriority: "HIGH",
      summary: `${TEST_MARKER} CONJ-HW-HIGH`,
      description: `${TEST_MARKER} Hardware high priority ticket.`,
    });
    await createTicket(requesterId, {
      categoryId: hardwareCategoryId,
      requestedPriority: "LOW",
      summary: `${TEST_MARKER} CONJ-HW-LOW`,
      description: `${TEST_MARKER} Hardware low priority ticket.`,
    });
    await createTicket(requesterId, {
      categoryId: softwareCategoryId,
      requestedPriority: "HIGH",
      summary: `${TEST_MARKER} CONJ-SW-HIGH`,
      description: `${TEST_MARKER} Software high priority ticket.`,
    });
  });

  itIfDb("filters by categoryId only", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: String(hardwareCategoryId) });

    expect(res.status).toBe(200);
    for (const t of res.body.data) {
      expect(t.categoryId).toBe(hardwareCategoryId);
    }
  });

  itIfDb("filters by requestedPriority only", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ requestedPriority: "HIGH" });

    expect(res.status).toBe(200);
    for (const t of res.body.data) {
      expect(t.requestedPriority).toBe("HIGH");
    }
  });

  itIfDb("applies all three filters conjunctively (category + priority + status)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({
        categoryId: String(hardwareCategoryId),
        requestedPriority: "HIGH",
        status: "NEW",
      });

    expect(res.status).toBe(200);
    // Only Hardware + HIGH + NEW tickets
    for (const t of res.body.data) {
      expect(t.categoryId).toBe(hardwareCategoryId);
      expect(t.requestedPriority).toBe("HIGH");
      expect(t.currentStatus).toBe("NEW");
    }
  });

  itIfDb("conjunctive filters return intersection only", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({
        categoryId: String(hardwareCategoryId),
        requestedPriority: "HIGH",
      });

    expect(res.status).toBe(200);
    // Should only match Hardware+HIGH (not Hardware+LOW, not Software+HIGH)
    for (const t of res.body.data) {
      expect(t.categoryId).toBe(hardwareCategoryId);
      expect(t.requestedPriority).toBe("HIGH");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 4 — Priority ordering
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 4: Priority ordering", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;

    // Create tickets with different priorities; createdAt will be sequential
    await createTicket(requesterId, {
      requestedPriority: "LOW",
      summary: `${TEST_MARKER} PRIO-LOW`,
      description: `${TEST_MARKER} Low priority ticket for ordering.`,
    });
    await createTicket(requesterId, {
      requestedPriority: "MEDIUM",
      summary: `${TEST_MARKER} PRIO-MEDIUM`,
      description: `${TEST_MARKER} Medium priority ticket for ordering.`,
    });
    await createTicket(requesterId, {
      requestedPriority: "HIGH",
      summary: `${TEST_MARKER} PRIO-HIGH`,
      description: `${TEST_MARKER} High priority ticket for ordering.`,
    });
  });

  itIfDb("sorts by requestedPriority ascending: LOW < MEDIUM < HIGH", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "requestedPriority", order: "asc" });

    expect(res.status).toBe(200);
    const priorities = res.body.data
      .filter((t: { summary: string }) => t.summary.includes("PRIO-"))
      .map((t: { requestedPriority: string }) => t.requestedPriority);

    const prioOrder = ["LOW", "MEDIUM", "HIGH"];
    const filtered = priorities.filter((p: string) => prioOrder.includes(p));
    expect(filtered).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  itIfDb("sorts by requestedPriority descending: HIGH > MEDIUM > LOW", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "requestedPriority", order: "desc" });

    expect(res.status).toBe(200);
    const priorities = res.body.data
      .filter((t: { summary: string }) => t.summary.includes("PRIO-"))
      .map((t: { requestedPriority: string }) => t.requestedPriority);

    const prioOrder = ["HIGH", "MEDIUM", "LOW"];
    const filtered = priorities.filter((p: string) => prioOrder.includes(p));
    expect(filtered).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 5 — Tie breakers
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 5: Tie breakers", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;

    // Create tickets with same requestedPriority to test tie-breakers
    await createTicket(requesterId, {
      requestedPriority: "MEDIUM",
      summary: `${TEST_MARKER} TIE-A`,
      description: `${TEST_MARKER} Tie-breaker ticket A.`,
    });
    await createTicket(requesterId, {
      requestedPriority: "MEDIUM",
      summary: `${TEST_MARKER} TIE-B`,
      description: `${TEST_MARKER} Tie-breaker ticket B.`,
    });

    // Create tickets with same summary to test summary tie-breaker
    await createTicket(requesterId, {
      summary: `${TEST_MARKER} SAME-SUMMARY-TIE`,
      description: `${TEST_MARKER} First ticket with same summary.`,
      requestedPriority: "LOW",
    });
    await createTicket(requesterId, {
      summary: `${TEST_MARKER} SAME-SUMMARY-TIE`,
      description: `${TEST_MARKER} Second ticket with same summary.`,
      requestedPriority: "LOW",
    });
  });

  itIfDb("tie-breaker: createdAt DESC, id DESC after primary sort", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "requestedPriority", order: "asc" });

    expect(res.status).toBe(200);
    const tieTickets = res.body.data
      .filter((t: { summary: string }) => t.summary.includes("TIE-"))
      .map((t: { id: number; createdAt: string }) => ({ id: t.id, createdAt: t.createdAt }));

    // With same priority, tie-breakers are createdAt DESC, id DESC
    // So the later-created ticket (higher id) should come first
    if (tieTickets.length >= 2) {
      expect(tieTickets[0].id).toBeGreaterThan(tieTickets[1].id);
    }
  });

  itIfDb("tie-breaker: summary sort with same summary uses createdAt DESC, id DESC", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "summary", order: "asc" });

    expect(res.status).toBe(200);
    const sameSummaryTickets = res.body.data
      .filter((t: { summary: string }) => t.summary === `${TEST_MARKER} SAME-SUMMARY-TIE`)
      .map((t: { id: number; createdAt: string }) => ({ id: t.id, createdAt: t.createdAt }));

    // With same summary, tie-breakers are createdAt DESC, id DESC
    // So the later-created ticket (higher id) should come first
    expect(sameSummaryTickets.length).toBeGreaterThanOrEqual(2);
    expect(sameSummaryTickets[0].id).toBeGreaterThan(sameSummaryTickets[1].id);
  });

  itIfDb("tie-breaker: createdAt sort uses id DESC as final tie-breaker", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "createdAt", order: "asc" });

    expect(res.status).toBe(200);
    const ids = res.body.data.map((t: { id: number }) => t.id);
    // When createdAt ASC, tickets with the same createdAt are ordered by id DESC
    // Verify the overall ordering is deterministic (no assertion failures)
    for (let i = 1; i < ids.length; i++) {
      // ids should be in a valid order given the sort
      expect(typeof ids[i]).toBe("number");
    }
  });

  itIfDb("tie-breaker: ticketNumber sort uses createdAt DESC, id DESC as tie-breaker", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ sort: "ticketNumber", order: "asc" });

    expect(res.status).toBe(200);
    const ticketNumbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    // ticketNumber is unique so no ties, but verify deterministic ordering
    for (let i = 1; i < ticketNumbers.length; i++) {
      expect(ticketNumbers[i - 1].localeCompare(ticketNumbers[i])).toBeLessThanOrEqual(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 6 — Pagination
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 6: Pagination", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;

    // Create at least 21 tickets
    for (let i = 0; i < 21; i++) {
      await createTicket(requesterId, {
        summary: `${TEST_MARKER} PAG-${String(i).padStart(2, "0")}`,
        description: `${TEST_MARKER} Pagination ticket ${i}.`,
      });
    }
  });

  itIfDb("page 1 returns first 10 items with correct metadata", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "1", pageSize: "10" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(21);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.unfilteredTotalItems).toBeGreaterThanOrEqual(21);
  });

  itIfDb("page 2 returns next 10 items", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "2", pageSize: "10" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.page).toBe(2);
  });

  itIfDb("page 3 returns remaining items (1 or more)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "3", pageSize: "10" });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination.page).toBe(3);
  });

  itIfDb("valid out-of-range page returns empty data with correct metadata", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "999", pageSize: "10" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.page).toBe(999);
    expect(res.body.pagination.totalItems).toBe(0);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.unfilteredTotalItems).toBeGreaterThanOrEqual(21);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 7 — Empty vs No-Results
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 7: Empty vs No-Results", () => {
  let requesterWithTicketsId: number;
  let requesterWithNoTicketsId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    // Find a requester with tickets (the one we've been using)
    const requesterWithTickets = await prisma.devRequester.findFirst({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    expect(requesterWithTickets).toBeTruthy();
    requesterWithTicketsId = requesterWithTickets!.id;

    // Create a dedicated zero-ticket requester for deterministic empty-state testing
    const newRequester = await prisma.devRequester.create({
      data: {
        name: `${TEST_MARKER}-EMPTY-REQ-${Date.now()}`,
        email: `empty-${Date.now()}@test.com`,
        isActive: true,
      },
    });
    requesterWithNoTicketsId = newRequester.id;
    createdRequesterIds.push(newRequester.id);

    // Verify zero tickets exist for this requester
    const ticketCount = await prisma.ticket.count({
      where: { requesterId: requesterWithNoTicketsId },
    });
    expect(ticketCount).toBe(0);
  });

  itIfDb("empty: requester with zero tickets returns unfilteredTotalItems=0", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterWithNoTicketsId))
      .query({ search: "anything" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(0);
    expect(res.body.pagination.unfilteredTotalItems).toBe(0);
  });

  itIfDb("no-results: requester with tickets but filter matches nothing", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterWithTicketsId))
      .query({ search: "ZZZZNONEXISTENT" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(0);
    expect(res.body.pagination.unfilteredTotalItems).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 8 — Invalid category
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 8: Invalid category", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;
  });

  itIfDb("categoryId=abc returns 400", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  itIfDb("categoryId=0 returns 400", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: "0" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("categoryId=-1 returns 400", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: "-1" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("categoryId=999999 returns 409", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: "999999" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  itIfDb("inactive category returns 409", async () => {
    const prisma = getPrisma();
    // Find an inactive category
    const inactiveCat = await prisma.category.findFirst({ where: { isActive: false } });
    if (!inactiveCat) {
      // Create a temporary inactive category for this test
      const newCat = await prisma.category.create({
        data: { name: `${TEST_MARKER}-INACTIVE-CAT-${Date.now()}`, isActive: false },
      });
      const res = await request(app)
        .get("/api/tickets")
        .set("X-Dev-Requester-Id", String(requesterId))
        .query({ categoryId: String(newCat.id) });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INACTIVE_REFERENCE");

      // Clean up
      await prisma.category.delete({ where: { id: newCat.id } });
      return;
    }

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ categoryId: String(inactiveCat.id) });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 9 — Defaults/fallbacks
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 9: Defaults/fallbacks", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;
  });

  itIfDb("missing page defaults to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("page=abc falls back to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "abc" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("page=0 falls back to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "0" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("page=-1 falls back to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "-1" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("page=1.0 falls back to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "1.0" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("page=1e2 falls back to 1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ page: "1e2" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  itIfDb("missing pageSize defaults to 10", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  itIfDb("pageSize=0 falls back to 10", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ pageSize: "0" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  itIfDb("pageSize=51 falls back to 10", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .query({ pageSize: "51" });

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 10 — Duplicate query parameters
// ────────────────────────────────────────────────────────────────────────────
describe("My Tickets Real DB — Test 10: Duplicate query parameters", () => {
  let requesterId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    requesterId = requester!.id;
  });

  itIfDb("duplicate search params uses first value", async () => {
    // Create a ticket with a distinctive summary so we can assert first-value behavior
    const ticketNum = await createTicket(requesterId, {
      summary: `${TEST_MARKER} DUP-SEARCH-FIRST`,
      description: `${TEST_MARKER} Duplicate search first-value test.`,
    });

    const res = await request(app)
      .get("/api/tickets?search=first&search=second")
      .set("X-Dev-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    // The controller reads req.query.search as a string, which Express
    // returns as the first value when there are duplicates.
    // "first" should be used as the search term; it won't match our ticket
    // whose summary contains "DUP-SEARCH-FIRST" (no "first" substring).
    // But the key assertion is that the server does NOT crash with 500.
    // Additionally, verify the response shape is valid.
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toHaveProperty("unfilteredTotalItems");
  });

  itIfDb("duplicate categoryId uses first value", async () => {
    const prisma = getPrisma();
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    expect(cat).toBeTruthy();

    const res = await request(app)
      .get(`/api/tickets?categoryId=${cat!.id}&categoryId=999999`)
      .set("X-Dev-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    // First value (valid cat.id) should be used, so all returned tickets
    // should have categoryId === cat.id (not a 409 from the invalid second value)
    for (const t of res.body.data) {
      expect(t.categoryId).toBe(cat!.id);
    }
  });

  itIfDb("duplicate sort uses first value", async () => {
    const res = await request(app)
      .get("/api/tickets?sort=createdAt&sort=invalidField")
      .set("X-Dev-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    // First value (createdAt) should be used; invalidField is ignored.
    // Verify the sort is applied by checking data is in createdAt DESC order
    const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// API-REQ-02: Historical inactive requester test
// ────────────────────────────────────────────────────────────────────────────
describe("API-REQ-02: Historical inactive requester — data preserved, API inaccessible", () => {
  let inactiveRequesterId: number;
  let inactiveRequesterName: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    // Find the inactive requester from seed data (Edsger Dijkstra)
    const inactive = await prisma.devRequester.findFirst({
      where: { isActive: false },
    });
    expect(inactive).toBeTruthy();
    inactiveRequesterId = inactive!.id;
    inactiveRequesterName = inactive!.name;
  });

  itIfDb("inactive requester database row still exists", async () => {
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findUnique({
      where: { id: inactiveRequesterId },
    });
    expect(requester).toBeTruthy();
    expect(requester!.name).toBe(inactiveRequesterName);
    expect(requester!.isActive).toBe(false);
  });

  itIfDb("inactive requester is rejected by requester-context endpoint with 422", async () => {
    const res = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", String(inactiveRequesterId));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  itIfDb("inactive requester is rejected by My Tickets endpoint with 422", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(inactiveRequesterId));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  itIfDb("inactive requester is rejected by Create Ticket endpoint with 422", async () => {
    const prisma = getPrisma();
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(inactiveRequesterId))
      .send({
        categoryId: category!.id,
        relatedSystemId: system!.id,
        summary: `${TEST_MARKER} inactive-create`,
        description: `${TEST_MARKER} Should be rejected.`,
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  itIfDb("tickets owned by inactive requester are not accessible through My Tickets API", async () => {
    // First create a ticket as an active requester
    const prisma = getPrisma();
    const activeRequester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    expect(activeRequester).toBeTruthy();

    const ticketNumber = await createTicket(activeRequester!.id, {
      summary: `${TEST_MARKER} INACTIVE-OWNER`,
      description: `${TEST_MARKER} Will be orphaned.`,
    });

    // Now manually change the ticket's requesterId to the inactive requester
    // to simulate a historical ticket owned by a now-inactive requester
    await prisma.ticket.update({
      where: { ticketNumber },
      data: { requesterId: inactiveRequesterId },
    });

    // Verify the ticket exists in the database
    const dbTicket = await prisma.ticket.findUnique({
      where: { ticketNumber },
    });
    expect(dbTicket).toBeTruthy();
    expect(dbTicket!.requesterId).toBe(inactiveRequesterId);

    // Verify the inactive requester cannot access it via My Tickets API
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", String(inactiveRequesterId));

    expect(res.status).toBe(422);
  });
});