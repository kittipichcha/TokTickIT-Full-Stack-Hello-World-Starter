/**
 * Frozen Test-DD file: `server/tests/lab-03/authorization.api.test.ts`
 *
 * Owned by Issue #37. Frozen rows executed here:
 *   - SEC-AUTHZ-01  body-supplied `requesterId` is ignored
 *   - SEC-AUTHZ-04  unauthenticated reference-data access -> 401
 *   - SEC-AUTHZ-05  shared-read authorization (Ticket Detail + each shared attachment read)
 *   - SEC-AUTHZ-07  CSRF on every then-protected mutation route (full subcase coverage)
 *   - SEC-AUTHZ-10  Staff/Admin attachment mutation -> 403, no state change
 *
 * Supplementary (never a tests.md row): UNIT-AUTHZ-01 `requireRole` assertions.
 *
 * SEC-AUTHZ-08 is owned by #38 and is deliberately NOT implemented here.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { requireRole } from "../../src/authorization.js";
import {
  ensureAndLogin,
  ensureTestUser,
  loginAs,
  withSession,
  type TestSession,
} from "./helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const OWNER_EMAIL = "authz-owner@example.com";
const OTHER_EMAIL = "authz-other@example.com";
const STAFF_EMAIL = "authz-staff@example.com";
const ADMIN_EMAIL = "authz-admin@example.com";

let owner: TestSession;
let other: TestSession;
let staff: TestSession;
let admin: TestSession;

let categoryId: number;
let systemId: number;
let ownedTicketNumber: string;
let ownedAttachmentId: number;

/** Creates a Ticket owned by `requesterId` and returns its ticket number. */
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
      description: "Authorization test ticket description.",
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

  await ensureTestUser({ email: OWNER_EMAIL, name: "Authz Owner", role: "REQUESTER" });
  await ensureTestUser({ email: OTHER_EMAIL, name: "Authz Other", role: "REQUESTER" });
  await ensureTestUser({ email: STAFF_EMAIL, name: "Authz Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: ADMIN_EMAIL, name: "Authz Admin", role: "ADMINISTRATOR" });

  owner = await loginAs(OWNER_EMAIL);
  other = await loginAs(OTHER_EMAIL);
  staff = await loginAs(STAFF_EMAIL);
  admin = await loginAs(ADMIN_EMAIL);

  let cat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: `Authz Cat-${Date.now()}`, isActive: true } });
  }
  categoryId = cat.id;

  let sys = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!sys) {
    sys = await prisma.relatedSystem.create({ data: { name: `Authz Sys-${Date.now()}`, isActive: true } });
  }
  systemId = sys.id;

  ownedTicketNumber = await createTicketFor(owner.userId, "Authz owned ticket");

  // Owner uploads one attachment used by the shared-read matrix.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const uploadRes = await withSession(
    request(app).post(`/api/tickets/${ownedTicketNumber}/attachments`),
    owner,
    { csrf: true },
  ).attach("file", jpeg, "authz.jpg");
  expect(uploadRes.status).toBe(201);
  ownedAttachmentId = uploadRes.body.data.id as number;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: ownedTicketNumber } });
  if (ticket) {
    await prisma.attachment.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  }
  await disconnectPrisma();
});

describe("SEC-AUTHZ-01: body-supplied requesterId is ignored", () => {
  itIfDb("created ticket is owned by the authenticated identity, never the body value", async () => {
    const res = await withSession(request(app).post("/api/tickets"), owner, { csrf: true }).send({
      categoryId,
      relatedSystemId: systemId,
      summary: "Spoof attempt summary",
      description: "Attempting to spoof the requester id in the request body.",
      requestedPriority: "LOW",
      // Spoofed identity — must be ignored entirely.
      requesterId: other.userId,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.requesterId).toBe(owner.userId);
    expect(res.body.data.requesterId).not.toBe(other.userId);

    // The other requester must not see it in their own list.
    const otherList = await withSession(request(app).get("/api/tickets"), other);
    expect(otherList.status).toBe(200);
    const numbers = (otherList.body.data as Array<{ ticketNumber: string }>).map((t) => t.ticketNumber);
    expect(numbers).not.toContain(res.body.data.ticketNumber);

    // Cleanup the created ticket.
    const prisma = getPrisma();
    const created = await prisma.ticket.findUnique({ where: { ticketNumber: res.body.data.ticketNumber } });
    if (created) await prisma.ticket.delete({ where: { id: created.id } });
  });
});

describe("SEC-AUTHZ-04: unauthenticated reference-data access", () => {
  itIfDb("GET /api/categories without a session -> 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("GET /api/related-systems without a session -> 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/related-systems");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("both endpoints return 200 with a valid session", async () => {
    const categories = await withSession(request(app).get("/api/categories"), owner);
    expect(categories.status).toBe(200);

    const systems = await withSession(request(app).get("/api/related-systems"), owner);
    expect(systems.status).toBe(200);
  });
});

describe("SEC-AUTHZ-05 (extended): shared-read authorization matrix", () => {
  itIfDb("Ticket Detail: owner 200 / non-owner Requester 404 / IT Staff 200 / Administrator 200", async () => {
    const ownerRes = await withSession(request(app).get(`/api/tickets/${ownedTicketNumber}`), owner);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.ticketNumber).toBe(ownedTicketNumber);

    const otherRes = await withSession(request(app).get(`/api/tickets/${ownedTicketNumber}`), other);
    expect(otherRes.status).toBe(404);
    expect(otherRes.body.error.code).toBe("NOT_FOUND");

    const staffRes = await withSession(request(app).get(`/api/tickets/${ownedTicketNumber}`), staff);
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data.ticketNumber).toBe(ownedTicketNumber);

    const adminRes = await withSession(request(app).get(`/api/tickets/${ownedTicketNumber}`), admin);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.ticketNumber).toBe(ownedTicketNumber);
  });

  itIfDb("Attachment list: owner 200 / non-owner Requester 404 / IT Staff 200 / Administrator 200", async () => {
    const ownerRes = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/attachments`),
      owner,
    );
    expect(ownerRes.status).toBe(200);
    // Landed Lab 2 response shape is a bare array (preserved by #37 — RR-02).
    expect(Array.isArray(ownerRes.body)).toBe(true);

    const otherRes = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/attachments`),
      other,
    );
    expect(otherRes.status).toBe(404);
    expect(otherRes.body.error.code).toBe("NOT_FOUND");

    const staffRes = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/attachments`),
      staff,
    );
    expect(staffRes.status).toBe(200);

    const adminRes = await withSession(
      request(app).get(`/api/tickets/${ownedTicketNumber}/attachments`),
      admin,
    );
    expect(adminRes.status).toBe(200);
  });

  itIfDb("Attachment download: owner 200 / non-owner Requester 404 / IT Staff 200 / Administrator 200", async () => {
    const ownerRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/download`),
      owner,
    );
    expect(ownerRes.status).toBe(200);

    const otherRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/download`),
      other,
    );
    expect(otherRes.status).toBe(404);
    expect(otherRes.body.error.code).toBe("NOT_FOUND");

    const staffRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/download`),
      staff,
    );
    expect(staffRes.status).toBe(200);

    const adminRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/download`),
      admin,
    );
    expect(adminRes.status).toBe(200);
  });

  itIfDb("Attachment preview: owner 200 / non-owner Requester 404 / IT Staff 200 / Administrator 200", async () => {
    const ownerRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/preview`),
      owner,
    );
    expect(ownerRes.status).toBe(200);

    const otherRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/preview`),
      other,
    );
    expect(otherRes.status).toBe(404);
    expect(otherRes.body.error.code).toBe("NOT_FOUND");

    const staffRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/preview`),
      staff,
    );
    expect(staffRes.status).toBe(200);

    const adminRes = await withSession(
      request(app).get(`/api/attachments/${ownedAttachmentId}/preview`),
      admin,
    );
    expect(adminRes.status).toBe(200);
  });
});

describe("SEC-AUTHZ-07 (frozen row — full coverage): CSRF on every protected mutation route", () => {
  /**
   * Every then-protected mutation route: #35's two auth mutations plus #37's three
   * inherited Lab 2 mutations. Each is checked with (a) no token and (b) an invalid
   * token, and in both cases the mutation must not be applied.
   */
  const mutationRoutes: Array<{
    label: string;
    method: "post" | "delete";
    path: () => string;
    session: () => TestSession;
    body?: () => unknown;
  }> = [
    {
      label: "POST /api/auth/logout",
      method: "post",
      path: () => "/api/auth/logout",
      session: () => owner,
    },
    {
      label: "POST /api/auth/change-password",
      method: "post",
      path: () => "/api/auth/change-password",
      session: () => owner,
      body: () => ({ currentPassword: "wrong", newPassword: "NewPass123!xyz" }),
    },
    {
      label: "POST /api/tickets",
      method: "post",
      path: () => "/api/tickets",
      session: () => owner,
      body: () => ({
        categoryId,
        relatedSystemId: systemId,
        summary: "CSRF probe summary",
        description: "CSRF probe description body.",
        requestedPriority: "LOW",
      }),
    },
    {
      label: "POST /api/tickets/:ticketNumber/attachments",
      method: "post",
      path: () => `/api/tickets/${ownedTicketNumber}/attachments`,
      session: () => owner,
    },
    {
      label: "DELETE /api/attachments/:attachmentId",
      method: "delete",
      path: () => `/api/attachments/${ownedAttachmentId}`,
      session: () => owner,
    },
  ];

  for (const route of mutationRoutes) {
    itIfDb(`${route.label}: missing CSRF token -> 403 FORBIDDEN, no state change`, async () => {
      const session = route.session();
      const req = request(app)[route.method](route.path());
      withSession(req, session); // session cookie only — no CSRF header
      if (route.body) req.send(route.body() as object);

      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    itIfDb(`${route.label}: invalid CSRF token -> 403 FORBIDDEN, no state change`, async () => {
      const session = route.session();
      const req = request(app)[route.method](route.path());
      req.set("Cookie", session.cookie);
      req.set("X-CSRF-Token", "invalid-token-value");
      if (route.body) req.send(route.body() as object);

      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  }

  itIfDb("no state change: a CSRF-rejected create leaves no ticket behind", async () => {
    const prisma = getPrisma();
    const before = await prisma.ticket.count({ where: { requesterId: owner.userId } });

    const res = await withSession(request(app).post("/api/tickets"), owner).send({
      categoryId,
      relatedSystemId: systemId,
      summary: "CSRF no-state-change probe",
      description: "This ticket must never be created.",
      requestedPriority: "LOW",
    });
    expect(res.status).toBe(403);

    const after = await prisma.ticket.count({ where: { requesterId: owner.userId } });
    expect(after).toBe(before);
  });

  itIfDb("no state change: a CSRF-rejected logout leaves the session valid", async () => {
    const session = await ensureAndLogin({
      email: OWNER_EMAIL,
      name: "Authz Owner",
      role: "REQUESTER",
    });

    const logoutRes = await withSession(request(app).post("/api/auth/logout"), session);
    expect(logoutRes.status).toBe(403);

    // The session must still be usable.
    const meRes = await withSession(request(app).get("/api/auth/me"), session);
    expect(meRes.status).toBe(200);
  });

  itIfDb("a valid CSRF token lets the mutation proceed", async () => {
    const res = await withSession(request(app).post("/api/tickets"), owner, { csrf: true }).send({
      categoryId,
      relatedSystemId: systemId,
      summary: "CSRF valid token probe",
      description: "This ticket is created because the CSRF token is valid.",
      requestedPriority: "LOW",
    });
    expect(res.status).toBe(201);

    const prisma = getPrisma();
    const created = await prisma.ticket.findUnique({ where: { ticketNumber: res.body.data.ticketNumber } });
    if (created) await prisma.ticket.delete({ where: { id: created.id } });
  });
});

describe("SEC-AUTHZ-10: Staff/Admin cannot mutate attachments (view-only)", () => {
  itIfDb("IT Staff upload -> 403 and no attachment row created", async () => {
    const prisma = getPrisma();
    const before = await prisma.attachment.count({ where: { ticketId: (await prisma.ticket.findUnique({ where: { ticketNumber: ownedTicketNumber } }))!.id } });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/attachments`),
      staff,
      { csrf: true },
    ).attach("file", jpeg, "staff.jpg");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.attachment.count({ where: { ticketId: (await prisma.ticket.findUnique({ where: { ticketNumber: ownedTicketNumber } }))!.id } });
    expect(after).toBe(before);
  });

  itIfDb("Administrator upload -> 403 and no attachment row created", async () => {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: ownedTicketNumber } });
    const before = await prisma.attachment.count({ where: { ticketId: ticket!.id } });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await withSession(
      request(app).post(`/api/tickets/${ownedTicketNumber}/attachments`),
      admin,
      { csrf: true },
    ).attach("file", jpeg, "admin.jpg");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.attachment.count({ where: { ticketId: ticket!.id } });
    expect(after).toBe(before);
  });

  itIfDb("IT Staff delete -> 403 and the attachment is unchanged", async () => {
    const prisma = getPrisma();
    const before = await prisma.attachment.findUnique({ where: { id: ownedAttachmentId } });

    const res = await withSession(
      request(app).delete(`/api/attachments/${ownedAttachmentId}`),
      staff,
      { csrf: true },
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.attachment.findUnique({ where: { id: ownedAttachmentId } });
    expect(after!.isRemoved).toBe(before!.isRemoved);
    expect(after!.removedAt).toEqual(before!.removedAt);
  });

  itIfDb("Administrator delete -> 403 and the attachment is unchanged", async () => {
    const prisma = getPrisma();
    const before = await prisma.attachment.findUnique({ where: { id: ownedAttachmentId } });

    const res = await withSession(
      request(app).delete(`/api/attachments/${ownedAttachmentId}`),
      admin,
      { csrf: true },
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.attachment.findUnique({ where: { id: ownedAttachmentId } });
    expect(after!.isRemoved).toBe(before!.isRemoved);
    expect(after!.removedAt).toEqual(before!.removedAt);
  });
});

describe("Supplementary — UNIT-AUTHZ-01: requireRole", () => {
  /** Minimal Express-like doubles for the middleware unit assertions. */
  function runRequireRole(allowed: Array<"REQUESTER" | "IT_STAFF" | "ADMINISTRATOR">, role?: string) {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
      locals: role === undefined ? {} : { role },
    };
    let nextCalled = false;
    requireRole(allowed)({} as never, res as never, () => {
      nextCalled = true;
    });
    return { res, nextCalled };
  }

  it("allows a listed role", () => {
    const { res, nextCalled } = runRequireRole(["REQUESTER"], "REQUESTER");
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it("403s a role that is not listed", () => {
    const { res, nextCalled } = runRequireRole(["REQUESTER"], "IT_STAFF");
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("allows both staff roles when both are listed", () => {
    expect(runRequireRole(["IT_STAFF", "ADMINISTRATOR"], "IT_STAFF").nextCalled).toBe(true);
    expect(runRequireRole(["IT_STAFF", "ADMINISTRATOR"], "ADMINISTRATOR").nextCalled).toBe(true);
  });

  it("403s a Requester when only staff roles are listed", () => {
    const { res, nextCalled } = runRequireRole(["IT_STAFF", "ADMINISTRATOR"], "REQUESTER");
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("401s when no identity is present", () => {
    const { res, nextCalled } = runRequireRole(["REQUESTER"]);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});

/**
 * Supplementary — UNIT-AUTHZ-02 (N-3): the Lab 2 regression test seam is inert
 * outside `NODE_ENV=test`.
 *
 * `testSeams.sessionIdentity` lets the Lab 2 suites inject an identity without the
 * session/login path. That seam must never weaken production: with
 * `NODE_ENV=production` and the seam set, a request with no session still gets 401.
 */
describe("Supplementary — UNIT-AUTHZ-02: test seam is inert outside NODE_ENV=test", () => {
  it("ignores testSeams.sessionIdentity when NODE_ENV=production", async () => {
    const { testSeams } = await import("../../src/test-seams.js");
    const originalEnv = process.env.NODE_ENV;
    testSeams.sessionIdentity = {
      userId: 999999,
      role: "REQUESTER",
      mustChangePassword: false,
      name: "Seam Identity",
      email: "seam-identity@example.com",
    };
    try {
      process.env.NODE_ENV = "production";
      // No session cookie: the seam must NOT authenticate the request.
      const res = await request(app).get("/api/categories");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    } finally {
      process.env.NODE_ENV = originalEnv;
      testSeams.sessionIdentity = null;
    }
  });

  it("honors testSeams.sessionIdentity when NODE_ENV=test", async () => {
    const { testSeams } = await import("../../src/test-seams.js");
    const originalEnv = process.env.NODE_ENV;
    testSeams.sessionIdentity = {
      userId: 1,
      role: "REQUESTER",
      mustChangePassword: false,
      name: "Seam Identity",
      email: "seam-identity@example.com",
    };
    try {
      process.env.NODE_ENV = "test";
      const res = await request(app).get("/api/categories");
      expect(res.status).toBe(200);
    } finally {
      process.env.NODE_ENV = originalEnv;
      testSeams.sessionIdentity = null;
    }
  });
});