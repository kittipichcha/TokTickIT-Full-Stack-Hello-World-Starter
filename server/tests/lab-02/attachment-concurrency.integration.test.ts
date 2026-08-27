import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

let testRequesterId: number;
let testCategoryId: number;
let testSystemId: number;
let testTicketNumber: string;
const cleanupTicketNumbers: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();

  let requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
  if (!requester) {
    requester = await prisma.devRequester.create({
      data: { name: "Concurrency Test", email: `concurrency-${Date.now()}@example.com`, isActive: true },
    });
  }
  testRequesterId = requester.id;

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: `Concurrency Cat-${Date.now()}`, isActive: true },
    });
  }
  testCategoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({
      data: { name: `Concurrency Sys-${Date.now()}`, isActive: true },
    });
  }
  testSystemId = sys.id;

  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  const now = rows[0]!.now;

  const seq = await prisma.ticketSequence.upsert({
    where: { year: now.getUTCFullYear() },
    create: { year: now.getUTCFullYear(), lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });

  testTicketNumber = `TKT-${now.getUTCFullYear()}-${String(seq.lastSeq).padStart(6, "0")}`;
  cleanupTicketNumbers.push(testTicketNumber);

  await prisma.ticket.create({
    data: {
      ticketNumber: testTicketNumber,
      requesterId: testRequesterId,
      categoryId: testCategoryId,
      relatedSystemId: testSystemId,
      summary: "Concurrency test ticket",
      description: "Testing concurrent attachment upload limits.",
      requestedPriority: "MEDIUM",
      createdAt: now,
      updatedAt: now,
    },
  });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();
  for (const tn of cleanupTicketNumbers) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: tn } });
    if (ticket) {
      await prisma.attachment.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  }
  await disconnectPrisma();
});

describe("API-ATT-14: Concurrent attachment limit enforcement", () => {
  itIfDb(
    "populates 4 attachments, then 2 concurrent uploads — only 1 succeeds, never >5 active",
    async () => {
      const prisma = getPrisma();
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post(`/api/tickets/${testTicketNumber}/attachments`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .attach("file", jpegBuffer, `photo-${i}.jpg`);
        expect(res.status).toBe(201);
      }

      const beforeCount = await prisma.attachment.count({
        where: { ticket: { ticketNumber: testTicketNumber }, isRemoved: false },
      });
      expect(beforeCount).toBe(4);

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/tickets/${testTicketNumber}/attachments`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .attach("file", jpegBuffer, "concurrent-a.jpg"),
        request(app)
          .post(`/api/tickets/${testTicketNumber}/attachments`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .attach("file", jpegBuffer, "concurrent-b.jpg"),
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 201).length;
      const limitReachedCount = [res1, res2].filter(
        (r) => r.status === 400 && r.body?.error?.code === "ATTACHMENT_LIMIT_REACHED",
      ).length;

      expect(successCount).toBe(1);
      expect(limitReachedCount).toBe(1);

      const finalCount = await prisma.attachment.count({
        where: { ticket: { ticketNumber: testTicketNumber }, isRemoved: false },
      });
      expect(finalCount).toBe(5);
    },
  );
});