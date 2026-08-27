import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { allocateTicketNumberWithClient } from "../../src/ticket-number.js";

describe("TicketSequence cleanup verification - integration test style", () => {
  let originalSequence: { year: number; lastSeq: number } | null = null;
  const currentYear = new Date().getUTCFullYear();
  const prisma = getPrisma();

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    // Snapshot the current-year TicketSequence to restore after tests
    originalSequence = await prisma.ticketSequence.findUnique({
      where: { year: currentYear },
    });
    console.log(`Before test: TicketSequence for ${currentYear} =`, originalSequence);
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    
    // Simulate what integration tests do
    await prisma.ticketSequence.deleteMany({ where: { year: currentYear } });
    if (originalSequence) {
      await prisma.ticketSequence.create({ data: originalSequence });
    }
    
    const afterSequence = await prisma.ticketSequence.findUnique({
      where: { year: currentYear },
    });
    console.log(`After cleanup: TicketSequence for ${currentYear} =`, afterSequence);
    
    // Verify cleanup worked
    if (originalSequence) {
      expect(afterSequence).toEqual(originalSequence);
    } else {
      // If there was no sequence before, there should be none after
      expect(afterSequence).toBeNull();
    }
    
    await disconnectPrisma();
  });

  it("should increment TicketSequence and verify it's restored", async () => {
    if (!process.env.DATABASE_URL) return;
    
    // Create a ticket to increment the sequence
    const ticketNumber = await allocateTicketNumberWithClient(prisma, currentYear);
    console.log(`Created ticket: ${ticketNumber}`);
    
    // Check that sequence was incremented
    const duringSequence = await prisma.ticketSequence.findUnique({
      where: { year: currentYear },
    });
    console.log(`During test: TicketSequence =`, duringSequence);
    
    if (originalSequence) {
      expect(duringSequence?.lastSeq).toBeGreaterThan(originalSequence.lastSeq);
    } else {
      expect(duringSequence?.lastSeq).toBe(1);
    }
  });
});