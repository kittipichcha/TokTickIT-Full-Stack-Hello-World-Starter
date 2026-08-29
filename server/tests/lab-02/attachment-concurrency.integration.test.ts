import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import * as fs from "node:fs";
import * as path from "node:path";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

let testRequesterId: number;
let testCategoryId: number;
let testSystemId: number;
let testTicketNumber: string;
let otherRequesterId: number;
const cleanupTicketNumbers: string[] = [];

function getStorageDir(): string {
  return process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), "attachment-storage");
}

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

  // Create a second active requester for ownership-isolation tests.
  let otherRequester = await prisma.devRequester.findFirst({
    where: { isActive: true, id: { not: testRequesterId } },
  });
  if (!otherRequester) {
    otherRequester = await prisma.devRequester.create({
      data: { name: "Other Requester", email: `other-${Date.now()}@example.com`, isActive: true },
    });
  }
  otherRequesterId = otherRequester.id;

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

describe("API-ATT-OWN-INT: Ownership isolation before multipart validation (real DB)", () => {
  itIfDb(
    "non-owned uploads return identical 404 regardless of file payload",
    async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const oversizedBuffer = Buffer.alloc(5_000_001, 0xff);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      // Requester B (otherRequesterId) attempts uploads against Requester A's
      // ticket. Every permutation must return the SAME 404 NOT_FOUND shape —
      // the ownership check runs BEFORE multipart validation, so a malformed,
      // missing, or oversized file cannot reveal the ticket's existence.
      const cases: Array<{ name: string; req: request.Test }> = [
        {
          name: "valid file",
          req: request(app)
            .post(`/api/tickets/${testTicketNumber}/attachments`)
            .set("X-Dev-Requester-Id", String(otherRequesterId))
            .attach("file", jpegBuffer, "owned.jpg"),
        },
        {
          name: "missing file",
          req: request(app)
            .post(`/api/tickets/${testTicketNumber}/attachments`)
            .set("X-Dev-Requester-Id", String(otherRequesterId)),
        },
        {
          name: "oversized file",
          req: request(app)
            .post(`/api/tickets/${testTicketNumber}/attachments`)
            .set("X-Dev-Requester-Id", String(otherRequesterId))
            .attach("file", oversizedBuffer, "oversized.jpg"),
        },
        {
          name: "invalid media type",
          req: request(app)
            .post(`/api/tickets/${testTicketNumber}/attachments`)
            .set("X-Dev-Requester-Id", String(otherRequesterId))
            .attach("file", Buffer.from("not an image"), "bad.txt"),
        },
      ];

      for (const c of cases) {
        const res = await c.req;
        expect(res.status, `case: ${c.name}`).toBe(404);
        expect(res.body.error.code, `case: ${c.name}`).toBe("NOT_FOUND");
        expect(res.body.error.message, `case: ${c.name}`).toBe("Ticket not found.");
      }

      // Verify no attachment was created for the non-owned ticket.
      const prisma = getPrisma();
      const count = await prisma.attachment.count({
        where: { ticket: { ticketNumber: testTicketNumber } },
      });
      expect(count).toBe(5); // only the 5 from the concurrency test above
    },
  );
});

describe("API-ATT-REM-CONC: Concurrent soft removal — exactly one 200, one 409", () => {
  itIfDb(
    "two simultaneous DELETEs produce exactly one 200 and one 409 with correct persisted metadata",
    async () => {
      const prisma = getPrisma();
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      // Create a fresh ticket for this test to avoid interference.
      const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
      const now = rows[0]!.now;
      const seq = await prisma.ticketSequence.upsert({
        where: { year: now.getUTCFullYear() },
        create: { year: now.getUTCFullYear(), lastSeq: 1 },
        update: { lastSeq: { increment: 1 } },
      });
      const ticketNumber = `TKT-${now.getUTCFullYear()}-${String(seq.lastSeq).padStart(6, "0")}`;
      cleanupTicketNumbers.push(ticketNumber);
      await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId: testRequesterId,
          categoryId: testCategoryId,
          relatedSystemId: testSystemId,
          summary: "Concurrent removal test ticket",
          description: "Testing atomic conditional soft removal.",
          requestedPriority: "MEDIUM",
          createdAt: now,
          updatedAt: now,
        },
      });

      const uploadRes = await request(app)
        .post(`/api/tickets/${ticketNumber}/attachments`)
        .set("X-Dev-Requester-Id", String(testRequesterId))
        .attach("file", jpegBuffer, "remove-me.jpg");
      expect(uploadRes.status).toBe(201);
      const attachmentId = uploadRes.body.data.id;

      const [res1, res2] = await Promise.all([
        request(app)
          .delete(`/api/attachments/${attachmentId}`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .send({ removalReason: "concurrent removal" }),
        request(app)
          .delete(`/api/attachments/${attachmentId}`)
          .set("X-Dev-Requester-Id", String(testRequesterId))
          .send({ removalReason: "concurrent removal" }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify persisted metadata: exactly one removal, correct requester/reason.
      const persisted = await prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      expect(persisted).not.toBeNull();
      expect(persisted!.isRemoved).toBe(true);
      expect(persisted!.removedAt).not.toBeNull();
      expect(persisted!.removedByRequesterId).toBe(testRequesterId);
      expect(persisted!.removalReason).toBe("concurrent removal");
    },
  );
});

describe("API-ATT-14-PDF: PDF preview returns first page as image/png (real DB)", () => {
  let pdfTicketNumber: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
    const now = rows[0]!.now;

    const seq = await prisma.ticketSequence.upsert({
      where: { year: now.getUTCFullYear() },
      create: { year: now.getUTCFullYear(), lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });

    pdfTicketNumber = `TKT-${now.getUTCFullYear()}-${String(seq.lastSeq).padStart(6, "0")}`;
    cleanupTicketNumbers.push(pdfTicketNumber);

    await prisma.ticket.create({
      data: {
        ticketNumber: pdfTicketNumber,
        requesterId: testRequesterId,
        categoryId: testCategoryId,
        relatedSystemId: testSystemId,
        summary: "PDF preview test ticket",
        description: "Testing PDF first-page preview rendering.",
        requestedPriority: "MEDIUM",
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  itIfDb("uploads a valid PDF and preview returns 200 image/png (first page rendered)", async () => {
    const fixturePath = path.join(__dirname, "..", "fixtures", "multi-page-preview.pdf");
    const pdfBuffer = fs.readFileSync(fixturePath);

    // Upload the PDF
    const uploadRes = await request(app)
      .post(`/api/tickets/${pdfTicketNumber}/attachments`)
      .set("X-Dev-Requester-Id", String(testRequesterId))
      .attach("file", pdfBuffer, "multi-page-preview.pdf");

    expect(uploadRes.status).toBe(201);
    const attachmentId = uploadRes.body.data.id;

    // Preview the PDF — AC-24 requires the first page rendered as PNG.
    // With a reproducible PDFium renderer this MUST succeed (200 image/png),
    // never return the original PDF, and never be a 500.
    const previewRes = await request(app)
      .get(`/api/attachments/${attachmentId}/preview`)
      .set("X-Dev-Requester-Id", String(testRequesterId));

    expect(previewRes.status).toBe(200);
    expect(previewRes.headers["content-type"]).toBe("image/png");
    expect(previewRes.body).toBeInstanceOf(Buffer);
    expect(previewRes.body.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(previewRes.body[0]).toBe(0x89);
    expect(previewRes.body[1]).toBe(0x50);
    expect(previewRes.body[2]).toBe(0x4e);
    expect(previewRes.body[3]).toBe(0x47);
  });

  itIfDb("preview of a corrupt PDF returns 500 INTERNAL_ERROR (never the original PDF)", async () => {
    // Upload a minimal PDF that passes the %PDF- content-signature check but
    // has no renderable pages, so the PDFium renderer fails.
    const corruptPdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n107\n%%EOF",
      "ascii",
    );

    const uploadRes = await request(app)
      .post(`/api/tickets/${pdfTicketNumber}/attachments`)
      .set("X-Dev-Requester-Id", String(testRequesterId))
      .attach("file", corruptPdfBuffer, "empty-pages.pdf");

    expect(uploadRes.status).toBe(201);
    const attachmentId = uploadRes.body.data.id;

    // Preview — rendering must fail, so it must be a 500 INTERNAL_ERROR,
    // and it must NEVER return the original PDF.
    const previewRes = await request(app)
      .get(`/api/attachments/${attachmentId}/preview`)
      .set("X-Dev-Requester-Id", String(testRequesterId));

    expect(previewRes.status).toBe(500);
    expect(previewRes.headers["content-type"]).not.toBe("application/pdf");
    expect(previewRes.body.error.code).toBe("INTERNAL_ERROR");
  });
});