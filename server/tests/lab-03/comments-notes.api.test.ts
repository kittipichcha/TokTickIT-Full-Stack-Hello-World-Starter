/**
 * Frozen Test-DD file: `server/tests/lab-03/comments-notes.api.test.ts`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - API-STAFF-05  Create Internal Note (AC-14)
 *   - API-STAFF-10  Staff/Admin posts/reads notes on a nonexistent ticket -> 404 (AC-14)
 *   - API-REQ-03    Requester posts Public Comment (AC-08)
 *   - SEC-AUTHZ-02  Requester requests Internal Notes -> 403 (AC-04)
 *   - SEC-AUTHZ-08  Requester posts/reads comments on a not-owned ticket -> 404 (AC-03)
 *
 * Supplementary (never a tests.md row): Staff/Admin-posts-comment case, the
 * append-only route-table check (BR-21), backend-derived author/timestamp
 * assertions (BR-22/23), and the migrated-ticket empty-list assertions (M-38-5).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import {
  ensureTestUser,
  loginAs,
  withSession,
  type TestSession,
} from "./helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const OWNER_EMAIL = "cn-owner@example.com";
const OTHER_EMAIL = "cn-other@example.com";
const STAFF_EMAIL = "cn-staff@example.com";
const ADMIN_EMAIL = "cn-admin@example.com";

let owner: TestSession;
let other: TestSession;
let staff: TestSession;
let admin: TestSession;

let categoryId: number;
let systemId: number;
let ownedTicketNumber: string;

async function createTicketFor(requesterId: number, summary: string): Promise<string> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS "now"`;
  const now = rows[0]!.now;
  const year = now.getUTCFullYear();
  const seq = await prisma.ticketSequence.upsert({
    where: { year },
    create: { year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  const ticketNumber = `TKT-${year}-${String(seq.lastSeq).padStart(6, "0")}`;
  await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      summary,
      description: "Comments/notes test ticket description.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      createdAt: now,
      updatedAt: now,
    },
  });
  return ticketNumber;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;

  const prisma = getPrisma();

  await ensureTestUser({ email: OWNER_EMAIL, name: "CN Owner", role: "REQUESTER" });
  await ensureTestUser({ email: OTHER_EMAIL, name: "CN Other", role: "REQUESTER" });
  await ensureTestUser({ email: STAFF_EMAIL, name: "CN Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: ADMIN_EMAIL, name: "CN Admin", role: "ADMINISTRATOR" });

  owner = await loginAs(OWNER_EMAIL);
  other = await loginAs(OTHER_EMAIL);
  staff = await loginAs(STAFF_EMAIL);
  admin = await loginAs(ADMIN_EMAIL);

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: `CN Cat-${Date.now()}`, isActive: true } });
  }
  categoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({ data: { name: `CN Sys-${Date.now()}`, isActive: true } });
  }
  systemId = sys.id;

  ownedTicketNumber = await createTicketFor(owner.userId, "CN owned ticket");
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("API-REQ-03 — Requester posts Public Comment (AC-08)", () => {
  itIfDb("owner Requester posts a comment -> 201 with backend-derived author/timestamp", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
      { csrf: true },
    ).send({ content: "Please check the printer." });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Please check the printer.");
    expect(res.body.data.authorId).toBe(owner.userId);
    expect(typeof res.body.data.createdAt).toBe("string");
  });

  itIfDb("a client-supplied authorId is ignored (author is the session identity)", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
      { csrf: true },
    ).send({ content: "Spoof attempt.", authorId: other.userId });

    expect(res.status).toBe(201);
    expect(res.body.data.authorId).toBe(owner.userId);
  });

  itIfDb("owner Requester reads the comment list -> 200", async () => {
    const res = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  itIfDb("whitespace-only content -> 400 VALIDATION_ERROR", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
      { csrf: true },
    ).send({ content: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("over-length content -> 400 VALIDATION_ERROR", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
      { csrf: true },
    ).send({ content: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  itIfDb("missing CSRF token -> 403, comment not created", async () => {
    const before = await getPrisma().comment.count({ where: { ticket: { ticketNumber: ownedTicketNumber } } });
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      owner,
    ).send({ content: "No CSRF." });
    expect(res.status).toBe(403);
    const after = await getPrisma().comment.count({ where: { ticket: { ticketNumber: ownedTicketNumber } } });
    expect(after).toBe(before);
  });
});

describe("Supplementary — Staff/Admin may post Public Comments (AC-08)", () => {
  itIfDb("IT Staff posts a comment on any ticket -> 201", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      staff,
      { csrf: true },
    ).send({ content: "Staff public comment." });
    expect(res.status).toBe(201);
    expect(res.body.data.authorId).toBe(staff.userId);
  });

  itIfDb("Administrator posts a comment on any ticket -> 201", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      admin,
      { csrf: true },
    ).send({ content: "Admin public comment." });
    expect(res.status).toBe(201);
    expect(res.body.data.authorId).toBe(admin.userId);
  });
});

describe("API-STAFF-05 — Create Internal Note (AC-14)", () => {
  itIfDb("IT Staff creates a note -> 201 with backend-derived author/timestamp", async () => {
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      staff,
      { csrf: true },
    ).send({ content: "Internal note." });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Internal note.");
    expect(res.body.data.authorId).toBe(staff.userId);
    expect(typeof res.body.data.createdAt).toBe("string");
  });

  itIfDb("IT Staff reads the note list -> 200", async () => {
    const res = await withSession(
      request(app).get(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      staff,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  itIfDb("Administrator creates and reads notes -> 201/200", async () => {
    const create = await withSession(
      request(app).post(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      admin,
      { csrf: true },
    ).send({ content: "Admin internal note." });
    expect(create.status).toBe(201);

    const list = await withSession(
      request(app).get(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      admin,
    );
    expect(list.status).toBe(200);
  });

  itIfDb("whitespace-only note content -> 400 VALIDATION_ERROR", async () => {
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      staff,
      { csrf: true },
    ).send({ content: "  \t " });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-STAFF-10 — Notes on a nonexistent ticket -> 404 (AC-14)", () => {
  itIfDb("POST notes on a nonexistent ticket -> 404 NOT_FOUND", async () => {
    const res = await withSession(
      request(app).post("/api/staff/tickets/TKT-2026-999999/notes"),
      staff,
      { csrf: true },
    ).send({ content: "Note on missing ticket." });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("GET notes on a nonexistent ticket -> 404 NOT_FOUND", async () => {
    const res = await withSession(
      request(app).get("/api/staff/tickets/TKT-2026-999999/notes"),
      staff,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("SEC-AUTHZ-02 — Requester requests Internal Notes -> 403 (AC-04)", () => {
  itIfDb("Requester GET notes -> 403 FORBIDDEN with no note data", async () => {
    const res = await withSession(
      request(app).get(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      owner,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.data).toBeUndefined();
  });

  itIfDb("Requester POST notes -> 403 FORBIDDEN", async () => {
    const res = await withSession(
      request(app).post(`/api/staff/tickets/${ownedTicketNumber}/notes`),
      owner,
      { csrf: true },
    ).send({ content: "Requester note attempt." });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("SEC-AUTHZ-08 — Requester comments on a not-owned ticket -> 404 (AC-03)", () => {
  itIfDb("Requester POST comment on another Requester's ticket -> 404, no existence leak", async () => {
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/comments`),
      other,
      { csrf: true },
    ).send({ content: "Not my ticket." });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("Requester GET comments on another Requester's ticket -> 404", async () => {
    const res = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/comments`),
      other,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("Requester comments on a nonexistent ticket -> 404", async () => {
    const res = await withSession(
      request(app).post("/api/tickets/TKT-2026-999999/comments"),
      owner,
      { csrf: true },
    ).send({ content: "Missing ticket." });
    expect(res.status).toBe(404);
  });
});

describe("Supplementary — append-only contract (BR-21)", () => {
  itIfDb("no update/delete route exists for comments or notes", async () => {
    const commentId = (
      await getPrisma().comment.findFirst({ where: { ticket: { ticketNumber: ownedTicketNumber } } })
    )!.id;
    const noteId = (
      await getPrisma().internalNote.findFirst({ where: { ticket: { ticketNumber: ownedTicketNumber } } })
    )!.id;

    const patchComment = await withSession(
      request(app).patch(`/api/tickets/${ownedTicketNumber}/comments/${commentId}`),
      staff,
      { csrf: true },
    ).send({ content: "edited" });
    expect([404, 405]).toContain(patchComment.status);

    const deleteNote = await withSession(
      request(app).delete(`/api/staff/tickets/${ownedTicketNumber}/notes/${noteId}`),
      staff,
      { csrf: true },
    );
    expect([404, 405]).toContain(deleteNote.status);
  });
});

describe("Migrated-ticket empty lists (supplementary — M-38-5)", () => {
  itIfDb("a freshly migrated-shape ticket returns empty comment and note arrays", async () => {
    const migrated = await createTicketFor(owner.userId, "Migrated-shape ticket");

    const comments = await withSession(
      request(app).get(`/api/tickets/${migrated}/comments`),
      owner,
    );
    expect(comments.status).toBe(200);
    expect(comments.body.data).toEqual([]);

    const notes = await withSession(
      request(app).get(`/api/staff/tickets/${migrated}/notes`),
      staff,
    );
    expect(notes.status).toBe(200);
    expect(notes.body.data).toEqual([]);
  });
});

describe("API-49-CREAD — Staff/Admin read Public Comments", () => {
  itIfDb.each([
    ["IT Staff", () => staff],
    ["Administrator", () => admin],
  ])("%s receives comments without Internal Notes", async (_label, session) => {
    const ticketNumber = await createTicketFor(owner.userId, "Staff comment read authorization");
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } });
    const comment = await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: owner.userId, content: "Known public comment" },
    });
    await prisma.internalNote.create({
      data: { ticketId: ticket.id, authorId: staff.userId, content: "Private internal note" },
    });

    const res = await withSession(
      request(app).get(`/api/tickets/${ticketNumber}/comments`),
      session(),
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: comment.id, content: "Known public comment", authorId: owner.userId }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain("Private internal note");
    expect(res.body).not.toHaveProperty("internalNotes");
  });
});

describe("API-49-FAIL — unexpected comments/notes failures", () => {
  const internalError = {
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  };

  itIfDb("contains a comment create failure and recovers on the next request", async () => {
    const ticketNumber = await createTicketFor(owner.userId, "Comment failure containment");
    const prisma = getPrisma();
    const before = await prisma.comment.count({ where: { ticket: { ticketNumber } } });
    const createSpy = vi.spyOn(prisma.comment, "create").mockRejectedValueOnce(
      new Error("review-test SQL/path sentinel"),
    );

    try {
      const failed = await withSession(
        request(app).post(`/api/tickets/${ticketNumber}/comments`),
        staff,
        { csrf: true },
      ).send({ content: "Failed comment" });
      expect(createSpy).toHaveBeenCalled();
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual(internalError);
      expect(JSON.stringify(failed.body)).not.toContain("review-test SQL/path sentinel");
    } finally {
      createSpy.mockRestore();
    }

    expect(await prisma.comment.count({ where: { ticket: { ticketNumber } } })).toBe(before);
    const recovered = await withSession(
      request(app).post(`/api/tickets/${ticketNumber}/comments`),
      staff,
      { csrf: true },
    ).send({ content: "Recovered comment" });
    expect(recovered.status).toBe(201);
    expect(await prisma.comment.count({ where: { ticket: { ticketNumber } } })).toBe(before + 1);
  });

  itIfDb("contains an internal note create failure and recovers on the next request", async () => {
    const ticketNumber = await createTicketFor(owner.userId, "Note failure containment");
    const prisma = getPrisma();
    const before = await prisma.internalNote.count({ where: { ticket: { ticketNumber } } });
    const createSpy = vi.spyOn(prisma.internalNote, "create").mockRejectedValueOnce(
      new Error("review-test SQL/path sentinel"),
    );

    try {
      const failed = await withSession(
        request(app).post(`/api/staff/tickets/${ticketNumber}/notes`),
        staff,
        { csrf: true },
      ).send({ content: "Failed note" });
      expect(createSpy).toHaveBeenCalled();
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual(internalError);
      expect(JSON.stringify(failed.body)).not.toContain("review-test SQL/path sentinel");
    } finally {
      createSpy.mockRestore();
    }

    expect(await prisma.internalNote.count({ where: { ticket: { ticketNumber } } })).toBe(before);
    const recovered = await withSession(
      request(app).post(`/api/staff/tickets/${ticketNumber}/notes`),
      staff,
      { csrf: true },
    ).send({ content: "Recovered note" });
    expect(recovered.status).toBe(201);
    expect(await prisma.internalNote.count({ where: { ticket: { ticketNumber } } })).toBe(before + 1);
  });
});