import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const createdTicketNumbers: string[] = [];
let testCategoryId: number;
let testSystemId: number;
let testRequesterId: number;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();

  let requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
  if (!requester) {
    requester = await prisma.devRequester.create({
      data: { name: "Test Requester", email: `test-persist-${Date.now()}@example.com`, isActive: true },
    });
  }
  testRequesterId = requester.id;

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: `Test Cat Persist-${Date.now()}`, isActive: true },
    });
  }
  testCategoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({
      data: { name: `Test Sys Persist-${Date.now()}`, isActive: true },
    });
  }
  testSystemId = sys.id;
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

async function createTestTicket(prisma: ReturnType<typeof getPrisma>): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  const now = rows[0]!.now;
  const seq = await prisma.ticketSequence.upsert({
    where: { year: now.getUTCFullYear() },
    create: { year: now.getUTCFullYear(), lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  const ticketNumber = `TKT-${now.getUTCFullYear()}-${String(seq.lastSeq).padStart(6, "0")}`;
  createdTicketNumbers.push(ticketNumber);
  await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId: testRequesterId,
      categoryId: testCategoryId,
      relatedSystemId: testSystemId,
      summary: "Test ticket for persistence compensation",
      description: "This is a test ticket for persistence compensation verification.",
      requestedPriority: "MEDIUM",
      createdAt: now,
      updatedAt: now,
    },
  });
  return ticketNumber;
}

describe("ATT-PERSIST-01: Attachment persistence compensation on metadata failure", () => {
  itIfDb(
    "deletes physical file when metadata insert fails after successful file write",
    async () => {
      const prisma = getPrisma();
      const ticketNumber = await createTestTicket(prisma);

      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      const successRes = await request(app)
        .post(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Dev-Requester-Id", String(testRequesterId))
        .attach("file", jpegBuffer, "photo.jpg");

      expect(successRes.status).toBe(201);
      expect(successRes.body.data).toBeDefined();
      expect(successRes.body.data.isRemoved).toBe(false);

      const attachments = await prisma.attachment.findMany({
        where: { ticket: { ticketNumber } },
      });
      expect(attachments.length).toBeGreaterThanOrEqual(1);

      expect(successRes.body.data.storedFilename).toBeUndefined();
    },
  );
});