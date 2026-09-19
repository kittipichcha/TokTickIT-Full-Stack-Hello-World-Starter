import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

/**
 * TKT-PRIO-01..03: IT Priority initialization on ticket creation.
 *
 * Frozen specification §9.3: `Ticket.itPriority` is required and "Initially copies
 * Requested Priority; changed only by IT Staff/Administrator (BR-16)". A requester-created
 * ticket must therefore persist `itPriority = requestedPriority`, and a client-supplied
 * `itPriority` must never be trusted.
 *
 * These are real-database integration tests: they exercise the production
 * `createTicket()` service through the HTTP surface and assert the persisted row.
 */

const TEST_MARKER = "TKT-PRIO";

// Tracks every Ticket Number created by this suite so cleanup deletes exactly those rows.
const createdTicketNumbers: string[] = [];

// Snapshot of the current-year TicketSequence to restore after all tests.
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

  const currentYear = await getDatabaseUTCCurrentYear();
  await prisma.ticketSequence.deleteMany({ where: { year: currentYear } });
  if (currentYearSequenceSnapshot) {
    await prisma.ticketSequence.create({ data: currentYearSequenceSnapshot });
  }

  await disconnectPrisma();
});

describe("TKT-PRIO: IT Priority is initialized from Requested Priority on creation", () => {
  let requesterId: number;
  let activeCategoryId: number;
  let activeSystemId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    expect(requester).toBeTruthy();
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();
    requesterId = requester!.id;
    activeCategoryId = category!.id;
    activeSystemId = system!.id;
  });

  itIfDb(
    "TKT-PRIO-01: the stored itPriority equals the submitted requestedPriority for every priority",
    async () => {
      const prisma = getPrisma();

      for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) {
        const res = await request(app)
          .post("/api/tickets")
          .set("X-Dev-Requester-Id", String(requesterId))
          .send({
            categoryId: activeCategoryId,
            relatedSystemId: activeSystemId,
            summary: `${TEST_MARKER} ${priority} summary`,
            description: `${TEST_MARKER} ${priority} description text`,
            requestedPriority: priority,
          });

        expect(res.status).toBe(201);
        createdTicketNumbers.push(res.body.data.ticketNumber);

        const ticket = await prisma.ticket.findUnique({
          where: { ticketNumber: res.body.data.ticketNumber },
        });
        expect(ticket, `ticket for priority ${priority} must exist`).toBeTruthy();
        expect(ticket!.requestedPriority).toBe(priority);
        expect(ticket!.itPriority).toBe(priority);
      }
    },
  );

  itIfDb(
    "TKT-PRIO-02: a client-supplied itPriority is ignored; the stored value follows requestedPriority",
    async () => {
      const prisma = getPrisma();

      const res = await request(app)
        .post("/api/tickets")
        .set("X-Dev-Requester-Id", String(requesterId))
        .send({
          categoryId: activeCategoryId,
          relatedSystemId: activeSystemId,
          summary: `${TEST_MARKER} spoof summary`,
          description: `${TEST_MARKER} spoof description text`,
          requestedPriority: "MEDIUM",
          // Not a documented request field (api-spec §7): must be ignored, never trusted.
          itPriority: "HIGH",
        });

      expect(res.status).toBe(201);
      createdTicketNumbers.push(res.body.data.ticketNumber);

      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: res.body.data.ticketNumber },
      });
      expect(ticket!.requestedPriority).toBe("MEDIUM");
      expect(ticket!.itPriority).toBe("MEDIUM");
    },
  );

  itIfDb(
    "TKT-PRIO-03: the Lab 2 create response shape is unchanged (no regression)",
    async () => {
      const res = await request(app)
        .post("/api/tickets")
        .set("X-Dev-Requester-Id", String(requesterId))
        .send({
          categoryId: activeCategoryId,
          relatedSystemId: activeSystemId,
          summary: `${TEST_MARKER} shape summary`,
          description: `${TEST_MARKER} shape description text`,
          requestedPriority: "MEDIUM",
        });

      expect(res.status).toBe(201);
      createdTicketNumbers.push(res.body.data.ticketNumber);

      // The Lab 2 response envelope and key set are unchanged; only the itPriority value
      // now reflects the frozen §9.3 initialization rule.
      expect(Object.keys(res.body.data).sort()).toEqual(
        [
          "id",
          "ticketNumber",
          "requesterId",
          "categoryId",
          "relatedSystemId",
          "summary",
          "description",
          "requestedPriority",
          "itPriority",
          "ticketOwnerId",
          "currentStatus",
          "createdAt",
          "updatedAt",
        ].sort(),
      );
      expect(res.body.data.itPriority).toBe("MEDIUM");
      expect(res.body.data.ticketOwnerId).toBeNull();
      expect(res.body.data.currentStatus).toBe("NEW");
    },
  );
});
