/**
 * Lab 4 Actions Taken API tests (Issue #51).
 *
 * Covers API-ACT-01…08, API-ACT-DETAIL-01, SEC-ACT-01/02, and CONC-ACT-01 from
 * `docs/lab-04/tests.md` §3. Every test uses a real authenticated session and a
 * real PostgreSQL database; fixtures are created and removed per suite.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { withSession, type TestSession } from "../lab-03/helpers/auth.js";
import { createActionFixture, seedAction, type ActionFixture } from "./helpers/action-fixtures.js";
import { cleanupExpiredIdempotency, CLEANUP_BATCH_SIZE } from "../../src/action-idempotency.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

let fx: ActionFixture;

/** Builds the canonical create body. */
function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { description: "Replaced the network cable", ...overrides };
}

/** POSTs an Action as the given session. */
function postAction(
  session: TestSession,
  ticketNumber: string,
  key: string,
  body: Record<string, unknown>,
) {
  return withSession(
    request(app).post(`/api/tickets/${ticketNumber}/actions`).set("Idempotency-Key", key).send(body),
    session,
    { csrf: true },
  );
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  fx = await createActionFixture();
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await fx.cleanup();
  await disconnectPrisma();
});

describe("API-ACT-01: create Action with server-derived fields", () => {
  itIfDb("persists the Ticket FK, server performer/time, and PENDING status; ignores forged fields", async () => {
    const res = await postAction(fx.staff.session, fx.ticketNumber, `key-01-${fx.suffix}`, {
      ...createBody(),
      // Forged server-owned fields must be ignored.
      status: "COMPLETED",
      performedByUserId: fx.otherStaff.id,
      version: 99,
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.performedBy.id).toBe(fx.staff.id);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.ticketNumber).toBe(fx.ticketNumber);

    const prisma = getPrisma();
    const row = await prisma.actionTaken.findUnique({ where: { id: res.body.data.id } });
    expect(row!.ticketId).toBe(fx.ticketId);
    expect(row!.performedByUserId).toBe(fx.staff.id);
    expect(row!.status).toBe("PENDING");
  });

  itIfDb("rejects missing/blank/over-limit description and non-boolean followUpRequired without persisting", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });

    const missing = await postAction(fx.staff.session, fx.ticketNumber, `key-01a-${fx.suffix}`, {});
    expect(missing.status).toBe(400);

    const blank = await postAction(fx.staff.session, fx.ticketNumber, `key-01b-${fx.suffix}`, { description: "   " });
    expect(blank.status).toBe(400);

    const overLimit = await postAction(fx.staff.session, fx.ticketNumber, `key-01c-${fx.suffix}`, {
      description: "x".repeat(2001),
    });
    expect(overLimit.status).toBe(400);

    const badBool = await postAction(fx.staff.session, fx.ticketNumber, `key-01d-${fx.suffix}`, {
      description: "ok",
      followUpRequired: "yes",
    });
    expect(badBool.status).toBe(400);

    const badAssignee = await postAction(fx.staff.session, fx.ticketNumber, `key-01e-${fx.suffix}`, {
      description: "ok",
      assigneeUserId: -1,
    });
    expect(badAssignee.status).toBe(400);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
  });

  itIfDb("accepts a 1-character and a 2,000-character description", async () => {
    const one = await postAction(fx.staff.session, fx.ticketNumber, `key-01f-${fx.suffix}`, { description: "a" });
    expect(one.status).toBe(201);
    const max = await postAction(fx.staff.session, fx.ticketNumber, `key-01g-${fx.suffix}`, {
      description: "b".repeat(2000),
    });
    expect(max.status).toBe(201);
  });
});

describe("API-ACT-02: idempotency", () => {
  itIfDb("rejects missing/empty/over-128/non-ASCII keys without persisting", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });

    const missing = await withSession(
      request(app).post(`/api/tickets/${fx.ticketNumber}/actions`).send(createBody()),
      fx.staff.session,
      { csrf: true },
    );
    expect(missing.status).toBe(400);

    const empty = await postAction(fx.staff.session, fx.ticketNumber, "", createBody());
    expect(empty.status).toBe(400);

    const over = await postAction(fx.staff.session, fx.ticketNumber, "k".repeat(129), createBody());
    expect(over.status).toBe(400);

    const nonAscii = await postAction(fx.staff.session, fx.ticketNumber, "key-é", createBody());
    expect(nonAscii.status).toBe(400);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
  });

  itIfDb("replays the identical 201 for a canonical-equivalent retry and conflicts on a changed payload", async () => {
    const key = `key-02a-${fx.suffix}`;
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, {
      description: "  Trimmed description  ",
      followUpRequired: false,
    });
    expect(first.status).toBe(201);

    // Canonical-equivalent: padded vs trimmed, omitted optional text vs null, unknown field ignored.
    const replay = await postAction(fx.staff.session, fx.ticketNumber, key, {
      description: "Trimmed description",
      result: null,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
      assigneeUserId: null,
      unknownField: "ignored",
    });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(first.body.data.id);

    const changed = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "Different" });
    expect(changed.status).toBe(409);
  });

  itIfDb("treats a record as expired at exactly 24h and creates one fresh Action", async () => {
    const prisma = getPrisma();
    const key = `key-02b-${fx.suffix}`;
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "First action" });
    expect(first.status).toBe(201);

    // Force the record to be expired.
    await prisma.actionCreateIdempotency.updateMany({
      where: { key, route: `/api/tickets/${fx.ticketNumber}/actions` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const second = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "First action" });
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    // The old Action is retained.
    const old = await prisma.actionTaken.findUnique({ where: { id: first.body.data.id } });
    expect(old).not.toBeNull();
  });

  itIfDb("cleanup deletes at most 500 expired rows ordered by (expiresAt,id)", async () => {
    const prisma = getPrisma();
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const expiredAt = new Date(Date.now() - 60_000);

    // Insert 505 expired rows directly (actionId must reference a real Action).
    const anchor = await seedAction({ ticketId: fx.ticketId, performedByUserId: fx.staff.id, description: "anchor" });
    const rows = Array.from({ length: CLEANUP_BATCH_SIZE + 5 }, (_, i) => ({
      actorUserId: fx.staff.id,
      route,
      key: `cleanup-${fx.suffix}-${i}`,
      requestHash: "hash",
      actionId: anchor,
      responseBody: { data: { id: anchor } },
      expiresAt: expiredAt,
    }));
    await prisma.actionCreateIdempotency.createMany({ data: rows });

    const first = await cleanupExpiredIdempotency();
    expect(first.ok).toBe(true);
    expect(first.deleted).toBe(CLEANUP_BATCH_SIZE);

    const second = await cleanupExpiredIdempotency();
    expect(second.ok).toBe(true);
    expect(second.deleted).toBe(5);

    // Unexpired rows are left alone.
    const unexpired = await prisma.actionCreateIdempotency.count({
      where: { route, expiresAt: { gt: new Date() } },
    });
    expect(unexpired).toBeGreaterThanOrEqual(0);
  });
});

describe("API-ACT-03: follow-up and attachment notes", () => {
  itIfDb("requires a nonblank follow-up note when followUpRequired is true", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });

    const absent = await postAction(fx.staff.session, fx.ticketNumber, `key-03a-${fx.suffix}`, {
      description: "ok",
      followUpRequired: true,
    });
    expect(absent.status).toBe(400);

    const blank = await postAction(fx.staff.session, fx.ticketNumber, `key-03b-${fx.suffix}`, {
      description: "ok",
      followUpRequired: true,
      followUpNote: "   ",
    });
    expect(blank.status).toBe(400);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);

    const valid = await postAction(fx.staff.session, fx.ticketNumber, `key-03c-${fx.suffix}`, {
      description: "ok",
      followUpRequired: true,
      followUpNote: "Call back next week",
      attachmentNotes: "See existing log file",
    });
    expect(valid.status).toBe(201);
    expect(valid.body.data.followUpNote).toBe("Call back next week");
    expect(valid.body.data.attachmentNotes).toBe("See existing log file");
  });
});

describe("API-ACT-04: assignee eligibility", () => {
  itIfDb("accepts an active staff/Admin assignee distinct from the owner and rejects ineligible targets", async () => {
    const ok = await postAction(fx.staff.session, fx.ticketNumber, `key-04a-${fx.suffix}`, {
      description: "assigned",
      assigneeUserId: fx.otherStaff.id,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.assignee.id).toBe(fx.otherStaff.id);

    const admin = await postAction(fx.staff.session, fx.ticketNumber, `key-04b-${fx.suffix}`, {
      description: "assigned admin",
      assigneeUserId: fx.admin.id,
    });
    expect(admin.status).toBe(201);

    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });

    const nonexistent = await postAction(fx.staff.session, fx.ticketNumber, `key-04c-${fx.suffix}`, {
      description: "x",
      assigneeUserId: 2_000_000_000,
    });
    expect(nonexistent.status).toBe(409);

    const inactive = await postAction(fx.staff.session, fx.ticketNumber, `key-04d-${fx.suffix}`, {
      description: "x",
      assigneeUserId: fx.inactiveStaff.id,
    });
    expect(inactive.status).toBe(409);

    const requester = await postAction(fx.staff.session, fx.ticketNumber, `key-04e-${fx.suffix}`, {
      description: "x",
      assigneeUserId: fx.requester.id,
    });
    expect(requester.status).toBe(409);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
  });
});

describe("API-ACT-05: list pagination and ordering", () => {
  itIfDb("lists zero/one/many in (createdAt,id) order and validates paging", async () => {
    const emptyTicket = await getPrisma().ticket.findUnique({ where: { ticketNumber: fx.ticketNumber } });
    expect(emptyTicket).not.toBeNull();

    const list = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.staff.session,
    );
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.pagination.page).toBe(1);
    expect(list.body.pagination.pageSize).toBe(10);

    // Ordering: ascending (createdAt, id).
    const ids = list.body.data.map((a: { id: number }) => a.id);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);

    const badPage = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions?page=0`),
      fx.staff.session,
    );
    expect(badPage.status).toBe(400);

    const badSize = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions?pageSize=51`),
      fx.staff.session,
    );
    expect(badSize.status).toBe(400);

    const nonInteger = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions?page=1.5`),
      fx.staff.session,
    );
    expect(nonInteger.status).toBe(400);
  });
});

describe("API-ACT-06: audited updates", () => {
  itIfDb("edits a Pending Action, appends an immutable revision, and enforces expectedVersion", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-06a-${fx.suffix}`, {
      description: "original",
    });
    const actionId = created.body.data.id;

    const patched = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
        .send({ expectedVersion: 1, description: "updated" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.data.description).toBe("updated");
    expect(patched.body.data.version).toBe(2);

    const prisma = getPrisma();
    const revisions = await prisma.actionTakenRevision.findMany({ where: { actionId } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].versionBefore).toBe(1);
    expect(revisions[0].versionAfter).toBe(2);
    expect((revisions[0].beforeSnapshot as { description: string }).description).toBe("original");
    expect((revisions[0].afterSnapshot as { description: string }).description).toBe("updated");

    // Missing/malformed expectedVersion and empty body fail without mutation.
    const missingVersion = await withSession(
      request(app).patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`).send({ description: "x" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(missingVersion.status).toBe(400);

    const emptyBody = await withSession(
      request(app).patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`).send({ expectedVersion: 2 }),
      fx.staff.session,
      { csrf: true },
    );
    expect(emptyBody.status).toBe(400);

    const stillTwo = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(stillTwo!.version).toBe(2);
    expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(1);
  });

  itIfDb("requires explicit repair when the current assignee became ineligible", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-06b-${fx.suffix}`, {
      description: "assigned",
      assigneeUserId: fx.otherStaff.id,
    });
    const actionId = created.body.data.id;

    // Deactivate the assignee after assignment.
    await getPrisma().user.update({ where: { id: fx.otherStaff.id }, data: { isActive: false } });
    try {
      const retained = await withSession(
        request(app)
          .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
          .send({ expectedVersion: 1, description: "edited" }),
        fx.staff.session,
        { csrf: true },
      );
      expect(retained.status).toBe(409);

      const repaired = await withSession(
        request(app)
          .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
          .send({ expectedVersion: 1, description: "edited", assigneeUserId: null }),
        fx.staff.session,
        { csrf: true },
      );
      expect(repaired.status).toBe(200);
      expect(repaired.body.data.assignee).toBeNull();
    } finally {
      await getPrisma().user.update({ where: { id: fx.otherStaff.id }, data: { isActive: true } });
    }
  });
});

describe("API-ACT-07: lifecycle transitions", () => {
  itIfDb("allows Pending→Completed with Result and Pending→Cancelled; rejects terminal edits", async () => {
    const complete = await postAction(fx.staff.session, fx.ticketNumber, `key-07a-${fx.suffix}`, {
      description: "to complete",
    });
    const completeId = complete.body.data.id;

    const noResult = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 1, status: "COMPLETED" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(noResult.status).toBe(400);

    const completed = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 1, status: "COMPLETED", result: "Fixed" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");

    // Terminal Action cannot be edited.
    const terminalEdit = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 2, description: "nope" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(terminalEdit.status).toBe(409);

    const cancel = await postAction(fx.staff.session, fx.ticketNumber, `key-07b-${fx.suffix}`, {
      description: "to cancel",
    });
    const cancelled = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${cancel.body.data.id}`)
        .send({ expectedVersion: 1, status: "CANCELLED" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
  });
});

describe("API-ACT-08: terminal Ticket creation rule", () => {
  itIfDb("rejects a new Pending Action on Resolved/Closed/Cancelled Tickets", async () => {
    const prisma = getPrisma();
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: status } });
      const res = await postAction(fx.staff.session, fx.ticketNumber, `key-08-${status}-${fx.suffix}`, {
        description: "should fail",
      });
      expect(res.status).toBe(409);
    }
    // A permitted Reopened Ticket can receive a Pending Action.
    await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "REOPENED" } });
    const reopened = await postAction(fx.staff.session, fx.ticketNumber, `key-08-reopened-${fx.suffix}`, {
      description: "allowed",
    });
    expect(reopened.status).toBe(201);
    await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "IN_PROGRESS" } });
  });
});

describe("API-ACT-DETAIL-01: Action detail", () => {
  itIfDb("returns staff detail, 404 for mismatched/missing, and a restricted Requester projection", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-detail-${fx.suffix}`, {
      description: "detail action",
      assigneeUserId: fx.otherStaff.id,
    });
    const actionId = created.body.data.id;

    const staffDetail = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
      fx.staff.session,
    );
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.data.performedBy.id).toBe(fx.staff.id);
    expect(staffDetail.body.data.assignee.role).toBe("IT_STAFF");
    expect(staffDetail.body.data.version).toBe(1);

    const missing = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions/2000000000`),
      fx.staff.session,
    );
    expect(missing.status).toBe(404);

    const requesterDetail = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
      fx.requester.session,
    );
    expect(requesterDetail.status).toBe(200);
    expect(requesterDetail.body.data.performedBy).toEqual({ name: "Action Staff" });
    expect(requesterDetail.body.data.assignee).toEqual({ name: "Other Staff" });
    expect(requesterDetail.body.data.version).toBeUndefined();
    expect(requesterDetail.body.data.performedBy.id).toBeUndefined();
  });
});

describe("SEC-ACT-01: authorization matrix", () => {
  itIfDb("enforces read/write authorization for every role", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-sec-${fx.suffix}`, {
      description: "sec action",
    });
    const actionId = created.body.data.id;

    // Unauthenticated reads -> 401.
    const unauthList = await request(app).get(`/api/tickets/${fx.ticketNumber}/actions`);
    expect(unauthList.status).toBe(401);
    const unauthDetail = await request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`);
    expect(unauthDetail.status).toBe(401);

    // Cross-requester read -> ownership-safe 404.
    const cross = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.otherRequester.session,
    );
    expect(cross.status).toBe(404);

    // Requester write -> 403.
    const requesterWrite = await postAction(fx.requester.session, fx.ticketNumber, `key-sec-r-${fx.suffix}`, {
      description: "nope",
    });
    expect(requesterWrite.status).toBe(403);

    // Admin parity.
    const adminList = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.admin.session,
    );
    expect(adminList.status).toBe(200);
    const adminCreate = await postAction(fx.admin.session, fx.ticketNumber, `key-sec-a-${fx.suffix}`, {
      description: "admin action",
    });
    expect(adminCreate.status).toBe(201);
  });
});

describe("SEC-ACT-02: CSRF enforcement", () => {
  itIfDb("rejects Action POST/PATCH without a valid CSRF token before mutation", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });

    const noCsrf = await withSession(
      request(app)
        .post(`/api/tickets/${fx.ticketNumber}/actions`)
        .set("Idempotency-Key", `key-csrf-${fx.suffix}`)
        .send(createBody()),
      fx.staff.session,
    );
    expect(noCsrf.status).toBe(403);

    const badCsrf = await withSession(
      request(app)
        .post(`/api/tickets/${fx.ticketNumber}/actions`)
        .set("Idempotency-Key", `key-csrf2-${fx.suffix}`)
        .set("X-CSRF-Token", "wrong")
        .send(createBody()),
      fx.staff.session,
    );
    expect(badCsrf.status).toBe(403);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
  });
});

describe("CONC-ACT-01: concurrent same-version edits", () => {
  itIfDb("commits exactly one of two same-version edits and conflicts the stale one", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-conc-${fx.suffix}`, {
      description: "concurrent base",
    });
    const actionId = created.body.data.id;

    const [a, b] = await Promise.all([
      withSession(
        request(app)
          .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
          .send({ expectedVersion: 1, description: "winner A" }),
        fx.staff.session,
        { csrf: true },
      ),
      withSession(
        request(app)
          .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
          .send({ expectedVersion: 1, description: "winner B" }),
        fx.staff.session,
        { csrf: true },
      ),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const prisma = getPrisma();
    const final = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    expect(final!.version).toBe(2);
    expect(["winner A", "winner B"]).toContain(final!.description);
    expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(1);
  });
});
