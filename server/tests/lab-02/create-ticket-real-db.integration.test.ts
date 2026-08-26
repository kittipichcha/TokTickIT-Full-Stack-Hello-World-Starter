import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

/**
 * API-TKT-INT-02: Real database integration tests for normalization,
 * ownership, defaults, and Ticket Detail ownership enforcement.
 *
 * These tests exercise the real production createTicket() and
 * getTicketByNumber() service functions against a real database.
 */

const TEST_MARKER = "INT-TEST-REAL-DB";

// Tracks every Ticket Number created by this suite so cleanup deletes exactly
// those rows instead of relying on business-field marker strings.
const createdTicketNumbers: string[] = [];

describe("API-TKT-INT-02: Real normalization and persistence", () => {
  let requesterId: number;
  let activeCategoryId: number;
  let activeSystemId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(requester).toBeTruthy();
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();

    requesterId = requester!.id;
    activeCategoryId = category!.id;
    activeSystemId = system!.id;
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
    });
    await disconnectPrisma();
  });

  const validBody = {
    categoryId: 0, // placeholder, set per test
    relatedSystemId: 0, // placeholder, set per test
    summary: `${TEST_MARKER} Valid summary`,
    description: `${TEST_MARKER} Valid description text for testing`,
    requestedPriority: "MEDIUM",
  };

  // ── Trim-before-persistence ─────────────────────────────────────────────

  itIfDb('persists trimmed summary: "  abcde  " → "abcde"', async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `  ${TEST_MARKER} abcde  `,
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: res.body.data.ticketNumber },
    });
    expect(ticket!.summary).toBe(`${TEST_MARKER} abcde`);
  });

  itIfDb('persists trimmed description: "  1234567890  " → "1234567890"', async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} trim-desc`,
        description: `  1234567890  `,
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: res.body.data.ticketNumber },
    });
    expect(ticket!.description).toBe("1234567890");
  });

  // ── Summary boundaries ──────────────────────────────────────────────────

  itIfDb("rejects summary with 4 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: "abcd",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();
  });

  itIfDb("accepts summary with 5 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: "abcde",
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: res.body.data.ticketNumber },
    });
    expect(ticket!.summary).toBe("abcde");
  });

  itIfDb("accepts summary with 120 characters after trim", async () => {
    const summary120 = "a".repeat(120);
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: summary120,
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);
  });

  itIfDb("rejects summary with 121 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: "a".repeat(121),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();
  });

  // ── Description boundaries ──────────────────────────────────────────────

  itIfDb("rejects description with 9 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} desc-9`,
        description: "123456789",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();
  });

  itIfDb("accepts description with 10 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} desc-10`,
        description: "1234567890",
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);
  });

  itIfDb("accepts description with 2000 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} desc-2000`,
        description: "a".repeat(2000),
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);
  });

  itIfDb("rejects description with 2001 characters after trim", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} desc-2001`,
        description: "a".repeat(2001),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();
  });

  // ── Whitespace-only rejection ───────────────────────────────────────────

  itIfDb("rejects whitespace-only summary and creates no ticket", async () => {
    const prisma = getPrisma();

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: "   ",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();

    // No ticket may be persisted with a whitespace-only summary.
    const after = await prisma.ticket.count({ where: { summary: "   " } });
    expect(after).toBe(0);
  });

  itIfDb("rejects whitespace-only description and creates no ticket", async () => {
    const prisma = getPrisma();
    const markerSummary = `${TEST_MARKER} ws-desc`;

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: markerSummary,
        description: "   ",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();

    // No ticket may be persisted for the rejected request.
    const after = await prisma.ticket.count({ where: { summary: markerSummary } });
    expect(after).toBe(0);
  });
});

describe("API-TKT-INT-03: Real ownership and defaults", () => {
  let requesterId: number;
  let activeCategoryId: number;
  let activeSystemId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(requester).toBeTruthy();
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();

    requesterId = requester!.id;
    activeCategoryId = category!.id;
    activeSystemId = system!.id;
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
    });
    await disconnectPrisma();
  });

  itIfDb("persists requesterId from X-Dev-Requester-Id header, ignores client-supplied ownership fields", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} ownership`,
        description: "Valid description text for testing ownership",
        requestedPriority: "MEDIUM",
        // Client-supplied fields that should be ignored
        requesterId: 999,
        ticketOwnerId: 999,
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: res.body.data.ticketNumber },
    });

    expect(ticket!.requesterId).toBe(requesterId);
    expect(ticket!.itPriority).toBeNull();
    expect(ticket!.ticketOwnerId).toBeNull();
    expect(ticket!.currentStatus).toBe("NEW");
  });

  itIfDb("returns itPriority and ticketOwnerId as null on requester-created tickets", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} defaults`,
        description: "Valid description text for testing defaults",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(201);
    createdTicketNumbers.push(res.body.data.ticketNumber);
    expect(res.body.data.itPriority).toBeNull();
    expect(res.body.data.ticketOwnerId).toBeNull();
    expect(res.body.data.currentStatus).toBe("NEW");
  });
});

describe("API-TKT-INT-04: Real Ticket Detail ownership enforcement", () => {
  let requesterAId: number;
  let requesterBId: number;
  let activeCategoryId: number;
  let activeSystemId: number;
  let ticketNumber: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    const requesters = await prisma.devRequester.findMany({
      where: { isActive: true },
      take: 2,
      orderBy: { id: "asc" },
    });
    expect(requesters.length).toBeGreaterThanOrEqual(2);

    requesterAId = requesters[0]!.id;
    requesterBId = requesters[1]!.id;

    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();
    activeCategoryId = category!.id;
    activeSystemId = system!.id;

    // Create a ticket owned by Requester A
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterAId))
      .send({
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
        summary: `${TEST_MARKER} detail-owner`,
        description: "Valid description text for testing detail ownership",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(201);
    ticketNumber = res.body.data.ticketNumber;
    createdTicketNumbers.push(ticketNumber);
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { ticketNumber: { in: createdTicketNumbers } },
    });
    await disconnectPrisma();
  });

  itIfDb("returns 200 with full ticket detail for owner (Requester A)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketNumber}`)
      .set("X-Dev-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ticketNumber).toBe(ticketNumber);
    expect(res.body.data.requesterId).toBe(requesterAId);
    expect(res.body.data.requesterName).toBeDefined();
    expect(res.body.data.categoryName).toBeDefined();
    expect(res.body.data.relatedSystemName).toBeDefined();
    expect(res.body.data.attachments).toBeDefined();
  });

  itIfDb("returns 404 NOT_FOUND for non-owner (Requester B)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketNumber}`)
      .set("X-Dev-Requester-Id", String(requesterBId));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    // No ticket data should be exposed
    expect(res.body.data).toBeUndefined();
  });
});