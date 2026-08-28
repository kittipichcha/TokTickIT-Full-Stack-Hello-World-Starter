import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { testSeams } from "../../src/test-seams.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const createdTicketNumbers: string[] = [];
let testCategoryId: number;
let testSystemId: number;
let testRequesterId: number;

function getStorageDir(): string {
  return process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), "attachment-storage");
}

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

describe("ATT-PERSIST-01: Successful attachment metadata persistence", () => {
  itIfDb(
    "uploads a valid JPEG, persists metadata, and does not expose storedFilename",
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

      // storedFilename must not be exposed in the API response
      expect(successRes.body.data.storedFilename).toBeUndefined();
    },
  );
});

describe("ATT-PERSIST-02: Metadata persistence failure compensates physical storage", () => {
  itIfDb(
    "deletes physical file and leaves no Attachment row when metadata insert fails after successful file write",
    async () => {
      const prisma = getPrisma();
      const ticketNumber = await createTestTicket(prisma);

      // Inject a deterministic persistence failure via the shared test seam
      testSeams.forceCreateAttachmentMetadataError = new Error("Simulated metadata persistence failure");

      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      // Count files in storage directory before the request
      const storageDir = getStorageDir();
      let filesBefore: string[] = [];
      try {
        filesBefore = fs.readdirSync(storageDir);
      } catch {
        // Directory may not exist yet
      }

      let failRes: any;

      try {
        failRes = await request(app)
          .post(`/api/tickets/${ticketNumber}/attachments`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .attach("file", jpegBuffer, "photo.jpg");
      } finally {
        // Reset the test seam — critical even if assertions fail
        testSeams.forceCreateAttachmentMetadataError = null;
      }

      // Assert HTTP behavior: the error propagates as 500 INTERNAL_ERROR
      expect(failRes!.status).toBe(500);
      expect(failRes!.body.error.code).toBe("INTERNAL_ERROR");

      // Assert database state: no Attachment row for this ticket
      const attachments = await prisma.attachment.findMany({
        where: { ticket: { ticketNumber } },
      });
      expect(attachments.length).toBe(0);

      // Assert filesystem state: no new files remain in storage directory
      const filesAfter = fs.readdirSync(storageDir);
      expect(filesAfter.length).toBe(filesBefore.length);

      // Assert API exposure: list attachments returns empty
      const listRes = await request(app)
        .get(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Dev-Requester-Id", String(testRequesterId));
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBe(0);
    },
  );
});