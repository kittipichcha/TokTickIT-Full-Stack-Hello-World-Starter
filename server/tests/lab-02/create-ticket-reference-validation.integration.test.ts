import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

// Tracks every Ticket Number created by this suite so cleanup deletes exactly
// those rows instead of relying on business-field marker strings.
const createdTicketNumbers: string[] = [];

// Snapshot of the current-year TicketSequence to restore after all tests
let currentYearSequenceSnapshot: { year: number; lastSeq: number } | null = null;

/**
 * Returns the current UTC year according to the database clock,
 * matching the authoritative source used by production.
 */
async function getDatabaseUTCCurrentYear(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  return rows[0]!.now.getUTCFullYear();
}

describe("API-TKT-02-INT: Inactive/stale reference rejection (real DB)", () => {
  let requesterId: number;
  let activeCategoryId: number;
  let activeSystemId: number;
  let inactiveCategoryId: number | null = null;
  let inactiveSystemId: number | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    // Snapshot the current-year TicketSequence to restore after tests
    const currentYear = await getDatabaseUTCCurrentYear();
    currentYearSequenceSnapshot = await prisma.ticketSequence.findUnique({
      where: { year: currentYear },
    });

    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(requester).toBeTruthy();
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();

    requesterId = requester!.id;
    activeCategoryId = category!.id;
    activeSystemId = system!.id;

    // Create an inactive category for testing
    const inactiveCat = await prisma.category.create({
      data: { name: "INT-TEST-INACTIVE-CATEGORY", isActive: false },
    });
    inactiveCategoryId = inactiveCat.id;

    // Create an inactive related system for testing
    const inactiveSys = await prisma.relatedSystem.create({
      data: { name: "INT-TEST-INACTIVE-SYSTEM", isActive: false },
    });
    inactiveSystemId = inactiveSys.id;
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    if (inactiveCategoryId) {
      await prisma.category.deleteMany({ where: { id: inactiveCategoryId } });
    }
    if (inactiveSystemId) {
      await prisma.relatedSystem.deleteMany({ where: { id: inactiveSystemId } });
    }
    
    // Delete every Ticket created by this test file
    if (createdTicketNumbers.length > 0) {
      await prisma.ticket.deleteMany({
        where: { ticketNumber: { in: createdTicketNumbers } },
      });
    }
    
    // Restore the current-year TicketSequence to its original state
    const currentYear = await getDatabaseUTCCurrentYear();
    await prisma.ticketSequence.deleteMany({ where: { year: currentYear } });
    if (currentYearSequenceSnapshot) {
      await prisma.ticketSequence.create({ data: currentYearSequenceSnapshot });
    }
    
    await disconnectPrisma();
  });

  const validBody = {
    summary: "INT-TEST Valid summary text",
    description: "INT-TEST Valid description text for testing",
    requestedPriority: "MEDIUM",
  };

  itIfDb("rejects inactive category with 409 INACTIVE_REFERENCE and creates no ticket (real DB)", async () => {
    const prisma = getPrisma();
    const markerSummary = "INT-TEST REF-REJECT inactive-category";
    const before = await prisma.ticket.count({ where: { summary: markerSummary } });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        summary: markerSummary,
        categoryId: inactiveCategoryId,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");

    const after = await prisma.ticket.count({ where: { summary: markerSummary } });
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  itIfDb("rejects inactive related system with 409 INACTIVE_REFERENCE and creates no ticket (real DB)", async () => {
    const prisma = getPrisma();
    const markerSummary = "INT-TEST REF-REJECT inactive-system";
    const before = await prisma.ticket.count({ where: { summary: markerSummary } });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        summary: markerSummary,
        categoryId: activeCategoryId,
        relatedSystemId: inactiveSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");

    const after = await prisma.ticket.count({ where: { summary: markerSummary } });
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  itIfDb("rejects nonexistent categoryId with 409 INACTIVE_REFERENCE and creates no ticket (real DB)", async () => {
    const prisma = getPrisma();
    const markerSummary = "INT-TEST REF-REJECT no-category";
    const before = await prisma.ticket.count({ where: { summary: markerSummary } });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        summary: markerSummary,
        categoryId: 999999,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");

    const after = await prisma.ticket.count({ where: { summary: markerSummary } });
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  itIfDb("rejects nonexistent relatedSystemId with 409 INACTIVE_REFERENCE and creates no ticket (real DB)", async () => {
    const prisma = getPrisma();
    const markerSummary = "INT-TEST REF-REJECT no-system";
    const before = await prisma.ticket.count({ where: { summary: markerSummary } });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        summary: markerSummary,
        categoryId: activeCategoryId,
        relatedSystemId: 999999,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");

    const after = await prisma.ticket.count({ where: { summary: markerSummary } });
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  itIfDb("accepts valid create with active references (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");

    // Track the created ticket for root-level cleanup
    createdTicketNumbers.push(res.body.data.ticketNumber);
  });
});