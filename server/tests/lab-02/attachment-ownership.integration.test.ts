import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const createdTicketNumbers: string[] = [];
let testCategoryId: number;
let testSystemId: number;
let requesterAId: number;
let requesterBId: number;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();

  // Requester A owns the ticket + attachment.
  let requesterA = await prisma.devRequester.findFirst({ where: { isActive: true } });
  if (!requesterA) {
    requesterA = await prisma.devRequester.create({
      data: { name: "Ownership A", email: `ownership-a-${Date.now()}@example.com`, isActive: true },
    });
  }
  requesterAId = requesterA.id;

  // Requester B is a different active requester who must NOT access A's attachment.
  let requesterB = await prisma.devRequester.findFirst({
    where: { isActive: true, id: { not: requesterAId } },
  });
  if (!requesterB) {
    requesterB = await prisma.devRequester.create({
      data: { name: "Ownership B", email: `ownership-b-${Date.now()}@example.com`, isActive: true },
    });
  }
  requesterBId = requesterB.id;

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: `Ownership Cat-${Date.now()}`, isActive: true },
    });
  }
  testCategoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({
      data: { name: `Ownership Sys-${Date.now()}`, isActive: true },
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

async function createTicketForRequesterA(prisma: ReturnType<typeof getPrisma>): Promise<string> {
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
      requesterId: requesterAId,
      categoryId: testCategoryId,
      relatedSystemId: testSystemId,
      summary: "Ownership test ticket",
      description: "This ticket belongs to Requester A for ownership isolation tests.",
      requestedPriority: "MEDIUM",
      createdAt: now,
      updatedAt: now,
    },
  });
  return ticketNumber;
}

describe("API-ATT-OWN-MATRIX: Cross-requester ownership for list/download/preview/delete (real DB)", () => {
  itIfDb(
    "Requester B cannot list, download, preview, or delete Requester A's attachment",
    async () => {
      const prisma = getPrisma();
      const ticketNumber = await createTicketForRequesterA(prisma);

      // Requester A uploads a valid JPEG attachment.
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const uploadRes = await request(app)
        .post(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Dev-Requester-Id", String(requesterAId))
        .attach("file", jpegBuffer, "owned.jpg");

      expect(uploadRes.status).toBe(201);
      const attachmentId = uploadRes.body.data.id as number;
      expect(attachmentId).toBeGreaterThan(0);

      // 1. LIST — Requester B must receive the contractually required safe 404.
      const listRes = await request(app)
        .get(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Dev-Requester-Id", String(requesterBId));
      expect(listRes.status).toBe(404);
      expect(listRes.body.error.code).toBe("NOT_FOUND");
      expect(listRes.body.error.message).toBe("Ticket not found.");

      // 2. DOWNLOAD — Requester B must receive the same safe 404 shape, no bytes.
      const downloadRes = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("X-Dev-Requester-Id", String(requesterBId));
      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body.error.code).toBe("NOT_FOUND");
      expect(downloadRes.body.error.message).toBe("Attachment not found.");
      // No attachment bytes may be returned.
      expect(downloadRes.headers["content-type"]).not.toBe("image/jpeg");

      // 3. PREVIEW — Requester B must receive the same safe 404 shape, no bytes.
      const previewRes = await request(app)
        .get(`/api/attachments/${attachmentId}/preview`)
        .set("X-Dev-Requester-Id", String(requesterBId));
      expect(previewRes.status).toBe(404);
      expect(previewRes.body.error.code).toBe("NOT_FOUND");
      expect(previewRes.body.error.message).toBe("Attachment not found.");
      expect(previewRes.headers["content-type"]).not.toBe("image/jpeg");

      // 4. DELETE — Requester B must not be able to remove A's attachment.
      const deleteRes = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(requesterBId));
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error.code).toBe("NOT_FOUND");
      expect(deleteRes.body.error.message).toBe("Attachment not found.");

      // After all of B's attempts, the database record must remain unchanged
      // (still active, still owned by A).
      const persisted = await prisma.attachment.findUnique({ where: { id: attachmentId } });
      expect(persisted).not.toBeNull();
      expect(persisted!.isRemoved).toBe(false);
      expect(persisted!.removedAt).toBeNull();

      // Sanity: Requester A can still download the attachment (ownership intact).
      const ownerDownload = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("X-Dev-Requester-Id", String(requesterAId));
      expect(ownerDownload.status).toBe(200);
      expect(ownerDownload.headers["content-type"]).toBe("image/jpeg");
    },
  );
});