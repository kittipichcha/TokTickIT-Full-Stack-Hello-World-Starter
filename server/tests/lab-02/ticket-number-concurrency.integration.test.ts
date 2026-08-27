import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import {
  allocateTicketNumber,
  allocateTicketNumberWithClient,
  TicketSequenceExhaustedError,
} from "../../src/ticket-number.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

// Dedicated years that will never collide with real ticket creation, so we can
// exercise the allocation primitive without perturbing the current-year sequence.
const TEST_YEARS = [2090, 2091, 2092, 2093, 2094, 2095];

const SUMMARY_MARKER = "TKT-CONCURRENCY-TEST-MARKER";

// Tracks every Ticket Number created by this suite so cleanup deletes exactly
// those rows instead of relying on business-field marker strings.
const createdTicketNumbers: string[] = [];

let currentYearSnapshot: { year: number; lastSeq: number } | null = null;

/**
 * Returns the current UTC year according to the database clock,
 * matching the authoritative source used by production.
 */
async function getDatabaseUTCCurrentYear(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  return rows[0]!.now.getUTCFullYear();
}

describe("API-TKT-06: ticket-number UTC allocation, concurrency, and exhaustion", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    // Snapshot the current-year sequence so the suite leaves no side effects.
    currentYearSnapshot = await prisma.ticketSequence.findUnique({
      where: { year: await getDatabaseUTCCurrentYear() },
    });
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    // Remove tickets created by this suite.
    if (createdTicketNumbers.length > 0) {
      await prisma.ticket.deleteMany({
        where: { ticketNumber: { in: createdTicketNumbers } },
      });
    }
    // Remove the test-year sequence rows.
    await prisma.ticketSequence.deleteMany({ where: { year: { in: TEST_YEARS } } });
    // Restore the current-year sequence to its original state.
    const year = await getDatabaseUTCCurrentYear();
    await prisma.ticketSequence.deleteMany({ where: { year } });
    if (currentYearSnapshot) {
      await prisma.ticketSequence.create({ data: currentYearSnapshot });
    }
    // Assert that restoration succeeded
    const restored = await prisma.ticketSequence.findUnique({ where: { year } });
    expect(restored).toEqual(currentYearSnapshot);
    await disconnectPrisma();
  });

  itIfDb("allocates 000001 then 000002 within the same year (increment of exactly 1)", async () => {
    const first = await allocateTicketNumber(2090);
    const second = await allocateTicketNumber(2090);

    expect(first).toBe("TKT-2090-000001");
    expect(second).toBe("TKT-2090-000002");
  });

  itIfDb("resets the sequence to 000001 in a new year", async () => {
    const yearA = await allocateTicketNumber(2091);
    const yearB = await allocateTicketNumber(2092);

    expect(yearA).toBe("TKT-2091-000001");
    expect(yearB).toBe("TKT-2092-000001");
  });

  itIfDb("concurrent allocations for the same year receive distinct numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => allocateTicketNumber(2093)),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(20);

    for (const number of results) {
      expect(number).toMatch(/^TKT-2093-\d{6}$/);
    }
  });

  itIfDb("throws TicketSequenceExhaustedError when the year sequence is exhausted", async () => {
    const prisma = getPrisma();
    await prisma.ticketSequence.upsert({
      where: { year: 2094 },
      update: { lastSeq: 999999 },
      create: { year: 2094, lastSeq: 999999 },
    });

    await expect(allocateTicketNumber(2094)).rejects.toBeInstanceOf(
      TicketSequenceExhaustedError,
    );
  });

  itIfDb("createTicket produces distinct, format-valid numbers and currentStatus NEW", async () => {
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    expect(requester && category && system).toBeTruthy();

    const body = {
      categoryId: category!.id,
      relatedSystemId: system!.id,
      summary: `${SUMMARY_MARKER} first`,
      description: "A description long enough for the create ticket contract.",
      requestedPriority: "MEDIUM",
    };

    const res1 = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requester!.id))
      .send(body);

    const res2 = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requester!.id))
      .send({ ...body, summary: `${SUMMARY_MARKER} second` });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const num1 = res1.body.data.ticketNumber as string;
    const num2 = res2.body.data.ticketNumber as string;

    expect(num1).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(num2).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(num1).not.toBe(num2);

    // The {YYYY} portion derives from the UTC-authoritative clock (current UTC year).
    // Verify against the persisted createdAt, not the Node process clock.
    const persisted1 = await prisma.ticket.findUnique({
      where: { ticketNumber: num1 },
      select: { createdAt: true },
    });
    const persisted2 = await prisma.ticket.findUnique({
      where: { ticketNumber: num2 },
      select: { createdAt: true },
    });

    const yearFromCreatedAt1 = persisted1!.createdAt.getUTCFullYear();
    const yearFromCreatedAt2 = persisted2!.createdAt.getUTCFullYear();
    expect(num1.startsWith(`TKT-${yearFromCreatedAt1}-`)).toBe(true);
    expect(num2.startsWith(`TKT-${yearFromCreatedAt2}-`)).toBe(true);

    expect(res1.body.data.currentStatus).toBe("NEW");

    // Track for root-level cleanup
    createdTicketNumbers.push(num1, num2);
  });

  itIfDb("concurrent HTTP creates all receive distinct, contiguous ticket numbers with matching persisted year", async () => {
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    expect(requester && category && system).toBeTruthy();

    const CONCURRENT_COUNT = 10;
    const marker = `${SUMMARY_MARKER} concurrent-http`;

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
        request(app)
          .post("/api/tickets")
          .set("X-Dev-Requester-Id", String(requester!.id))
          .send({
            categoryId: category!.id,
            relatedSystemId: system!.id,
            summary: `${marker} ${i}`,
            description: "A description long enough for the create ticket contract.",
            requestedPriority: "MEDIUM",
          }),
      ),
    );

    // All should succeed
    for (const res of results) {
      expect(res.status).toBe(201);
      expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    }

    // All ticket numbers should be distinct
    const numbers = results.map((r) => r.body.data.ticketNumber as string);
    const unique = new Set(numbers);
    expect(unique.size).toBe(CONCURRENT_COUNT);

    // Sorted sequence numbers should be contiguous (BR-01: increment by exactly 1)
    const seqs = numbers
      .map((n) => {
        const parts = n.match(/^TKT-(\d{4})-(\d{6})$/);
        return { year: parseInt(parts![1], 10), seq: parseInt(parts![2], 10) };
      })
      .sort((a, b) => a.seq - b.seq);

    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i].seq).toBe(seqs[i - 1].seq + 1);
    }

    // Each number's year should equal its persisted createdAt UTC year
    const persistedTickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: numbers } },
      select: { ticketNumber: true, createdAt: true },
    });

    for (const t of persistedTickets) {
      const yearFromNumber = parseInt(t.ticketNumber.match(/^TKT-(\d{4})-\d{6}$/)![1], 10);
      const yearFromCreatedAt = t.createdAt.getUTCFullYear();
      expect(yearFromNumber).toBe(yearFromCreatedAt);
    }

    // Track for root-level cleanup
    for (const n of numbers) {
      createdTicketNumbers.push(n);
    }
  });

  itIfDb("returns 409 TICKET_SEQUENCE_EXHAUSTED and creates no ticket when exhausted", async () => {
    const prisma = getPrisma();
    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    expect(requester && category && system).toBeTruthy();

    const currentUtcYear = await getDatabaseUTCCurrentYear();
    const before = await prisma.ticket.count();

    // Exhaust the real current-year sequence; the afterAll snapshot-restore undoes this.
    await prisma.ticketSequence.upsert({
      where: { year: currentUtcYear },
      update: { lastSeq: 999999 },
      create: { year: currentUtcYear, lastSeq: 999999 },
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requester!.id))
      .send({
        categoryId: category!.id,
        relatedSystemId: system!.id,
        summary: `${SUMMARY_MARKER} exhausted`,
        description: "A description long enough for the create ticket contract.",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_SEQUENCE_EXHAUSTED");

    const after = await prisma.ticket.count();
    expect(after).toBe(before);
  });

  itIfDb("failed post-allocation insertion leaves no sequence gap (transaction rollback)", async () => {
    const prisma = getPrisma();

    // Use a dedicated synthetic year so we can observe the sequence state directly.
    const year = 2095;

    // Record the sequence state before the failed transaction.
    const beforeSeq = await prisma.ticketSequence.findUnique({ where: { year } });
    const beforeLastSeq = beforeSeq?.lastSeq ?? 0;

    // Simulate a failed ticket insertion after allocation within a transaction.
    // We allocate the number inside a transaction, then force the transaction to
    // fail (throw) before committing. The sequence increment must be rolled back.
    await expect(
      prisma.$transaction(async (tx) => {
        const number = await allocateTicketNumberWithClient(tx, year);
        expect(number).toBe(`TKT-${year}-${String(beforeLastSeq + 1).padStart(6, "0")}`);
        // Force failure after allocation.
        throw new Error("simulated post-allocation insertion failure");
      }),
    ).rejects.toThrow("simulated post-allocation insertion failure");

    // The sequence increment must have been rolled back.
    const afterSeq = await prisma.ticketSequence.findUnique({ where: { year } });
    const afterLastSeq = afterSeq?.lastSeq ?? 0;
    expect(afterLastSeq).toBe(beforeLastSeq);

    // The next successful allocation in the same year must NOT skip a number.
    const nextNumber = await allocateTicketNumber(year);
    expect(nextNumber).toBe(`TKT-${year}-${String(beforeLastSeq + 1).padStart(6, "0")}`);
  });
});
