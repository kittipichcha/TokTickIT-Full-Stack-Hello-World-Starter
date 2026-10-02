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
import {
  createActionFixture,
  createAdditionalActionTicket,
  seedAction,
  type ActionFixture,
} from "./helpers/action-fixtures.js";
import { cleanupExpiredIdempotency, CLEANUP_BATCH_SIZE } from "../../src/action-idempotency.js";
import { IDEMPOTENCY_TTL_MS, isIdempotencyRecordExpired } from "../../src/action-service.js";

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

/** POSTs raw JSON so decimal/exponent number syntax is preserved on the wire. */
function postRawAction(session: TestSession, ticketNumber: string, key: string, rawBody: string) {
  return withSession(
    request(app)
      .post(`/api/tickets/${ticketNumber}/actions`)
      .set("Content-Type", "application/json")
      .set("Idempotency-Key", key)
      .send(rawBody),
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
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const beforeKeys = await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } });

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

    const invalidOptionalBounds = [
      { result: "x".repeat(2001) },
      { followUpRequired: true, followUpNote: "x".repeat(1001) },
      { attachmentNotes: "x".repeat(1001) },
    ];
    for (const [index, fields] of invalidOptionalBounds.entries()) {
      const invalid = await postAction(
        fx.staff.session,
        fx.ticketNumber,
        `key-01-bound-${index}-${fx.suffix}`,
        { description: "valid description", ...fields },
      );
      expect(invalid.status).toBe(400);
    }

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
    expect(await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } })).toBe(beforeKeys);
  });

  itIfDb("accepts a 1-character and a 2,000-character description", async () => {
    const one = await postAction(fx.staff.session, fx.ticketNumber, `key-01f-${fx.suffix}`, { description: "a" });
    expect(one.status).toBe(201);
    const max = await postAction(fx.staff.session, fx.ticketNumber, `key-01g-${fx.suffix}`, {
      description: "b".repeat(2000),
      result: "r".repeat(2000),
      followUpRequired: true,
      followUpNote: "f".repeat(1000),
      attachmentNotes: "a".repeat(1000),
    });
    expect(max.status).toBe(201);
    expect(max.body.data.result).toHaveLength(2000);
    expect(max.body.data.followUpNote).toHaveLength(1000);
    expect(max.body.data.attachmentNotes).toHaveLength(1000);
  });

  itIfDb("enforces raw integer syntax for assignees and Action versions", async () => {
    const prisma = getPrisma();
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const beforeActions = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });
    const beforeKeys = await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } });

    for (const [suffix, token] of [["decimal", "1.0"], ["exponent", "1e0"]]) {
      const invalid = await postRawAction(
        fx.staff.session,
        fx.ticketNumber,
        `key-01-raw-${suffix}-${fx.suffix}`,
        `{"description":"invalid ${suffix}","assigneeUserId":${token}}`,
      );
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.fields.assigneeUserId).toBe("assigneeUserId must be a valid positive integer.");
    }

    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-01-raw-patch-${fx.suffix}`, {
      description: "version syntax",
    });
    const actionId = created.body.data.id;
    const original = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
    const revisionCount = await prisma.actionTakenRevision.count({ where: { actionId } });

    for (const [suffix, token] of [["decimal", "1.0"], ["exponent", "1e0"]]) {
      const invalid = await withSession(
        request(app)
          .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
          .set("Content-Type", "application/json")
          .send(`{"expectedVersion":${token},"description":"invalid ${suffix}"}`),
        fx.staff.session,
        { csrf: true },
      );
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.fields.expectedVersion).toBe("expectedVersion must be a valid positive integer.");
    }

    const unchanged = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
    expect(unchanged).toEqual(original);
    expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(revisionCount);
    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(beforeActions + 1);
    expect(await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } })).toBe(beforeKeys + 1);

    const validAssignee = await postRawAction(
      fx.staff.session,
      fx.ticketNumber,
      `key-01-raw-valid-${fx.suffix}`,
      `{"description":"valid integer","assigneeUserId":${fx.otherStaff.id}}`,
    );
    expect(validAssignee.status).toBe(201);
    expect(validAssignee.body.data.assignee.id).toBe(fx.otherStaff.id);

    const nullAssignee = await postRawAction(
      fx.staff.session,
      fx.ticketNumber,
      `key-01-raw-null-${fx.suffix}`,
      '{"description":"null assignee","assigneeUserId":null}',
    );
    expect(nullAssignee.status).toBe(201);
    expect(nullAssignee.body.data.assignee).toBeNull();

    const validVersion = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
        .set("Content-Type", "application/json")
        .send('{"expectedVersion":1,"description":"valid integer version","assigneeUserId":null}'),
      fx.staff.session,
      { csrf: true },
    );
    expect(validVersion.status).toBe(200);
    expect(validVersion.body.data.version).toBe(2);
  });
});

describe("API-ACT-02: idempotency", () => {
  it("treats exact expiry as expired", () => {
    const boundary = new Date("2026-10-02T12:00:00.000Z");
    expect(isIdempotencyRecordExpired(boundary, boundary)).toBe(true);
    expect(isIdempotencyRecordExpired(new Date(boundary.getTime() + 1), boundary)).toBe(false);
  });

  itIfDb("rejects missing/empty/over-128/non-ASCII keys without persisting", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const beforeKeys = await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } });

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

    const nonPrintable = await postAction(fx.staff.session, fx.ticketNumber, "key-\tbad", createBody());
    expect(nonPrintable.status).toBe(400);

    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before);
    expect(await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } })).toBe(beforeKeys);
  });

  itIfDb("replays the identical 201 for a canonical-equivalent retry and conflicts on a changed payload", async () => {
    const prisma = getPrisma();
    const key = `key-02a-${fx.suffix}`;
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, {
      description: "  Trimmed description  ",
      followUpRequired: false,
    });
    expect(first.status).toBe(201);
    const record = await prisma.actionCreateIdempotency.findUniqueOrThrow({
      where: {
        actorUserId_route_key: {
          actorUserId: fx.staff.id,
          route: `/api/tickets/${fx.ticketNumber}/actions`,
          key,
        },
      },
    });
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBe(IDEMPOTENCY_TTL_MS);

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

  itIfDb("replays the original result after the Ticket becomes terminal", async () => {
    const prisma = getPrisma();
    const key = `key-02-terminal-${fx.suffix}`;
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "terminal replay" });
    expect(first.status).toBe(201);

    await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "RESOLVED" } });
    try {
      const replay = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "terminal replay" });
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);

      const changed = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "different payload" });
      expect(changed.status).toBe(409);
      expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before + 1);
      expect(await prisma.actionCreateIdempotency.count({
        where: { actorUserId: fx.staff.id, route: `/api/tickets/${fx.ticketNumber}/actions`, key },
      })).toBe(1);
    } finally {
      await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "IN_PROGRESS" } });
    }
  });

  itIfDb("treats an expired key as fresh only after current Ticket validation", async () => {
    const prisma = getPrisma();
    const key = `key-02-expired-terminal-${fx.suffix}`;
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "old action" });
    expect(first.status).toBe(201);
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const keyWhere = { actorUserId_route_key: { actorUserId: fx.staff.id, route, key } };
    await prisma.actionCreateIdempotency.updateMany({
      where: { actorUserId: fx.staff.id, route, key },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredRecord = await prisma.actionCreateIdempotency.findUniqueOrThrow({ where: keyWhere });
    const actionCountBefore = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });
    await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "RESOLVED" } });

    try {
      const retry = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "old action" });
      expect(retry.status).toBe(409);
      expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(actionCountBefore);
      expect(await prisma.actionTaken.findUnique({ where: { id: first.body.data.id } })).not.toBeNull();
      expect(await prisma.actionCreateIdempotency.findUniqueOrThrow({ where: keyWhere })).toEqual(expiredRecord);
    } finally {
      await prisma.ticket.update({ where: { id: fx.ticketId }, data: { currentStatus: "IN_PROGRESS" } });
    }
  });

  itIfDb("serializes concurrent reuse of an expired key into one fresh Action", async () => {
    const prisma = getPrisma();
    const key = `key-02b-${fx.suffix}`;
    const first = await postAction(fx.staff.session, fx.ticketNumber, key, { description: "First action" });
    expect(first.status).toBe(201);

    // Force the record to be expired.
    await prisma.actionCreateIdempotency.updateMany({
      where: { key, route: `/api/tickets/${fx.ticketNumber}/actions` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const [second, concurrentReplay] = await Promise.all([
      postAction(fx.staff.session, fx.ticketNumber, key, { description: "First action" }),
      postAction(fx.staff.session, fx.ticketNumber, key, { description: "First action" }),
    ]);
    expect(second.status).toBe(201);
    expect(concurrentReplay.status).toBe(201);
    expect(second.body).toEqual(concurrentReplay.body);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    // The old Action is retained.
    const old = await prisma.actionTaken.findUnique({ where: { id: first.body.data.id } });
    expect(old).not.toBeNull();
    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId, description: "First action" } })).toBe(2);
    expect(await prisma.actionCreateIdempotency.count({
      where: { actorUserId: fx.staff.id, route: `/api/tickets/${fx.ticketNumber}/actions`, key },
    })).toBe(1);
  });

  itIfDb("cleanup deletes at most 500 expired rows ordered by (expiresAt,id)", async () => {
    const prisma = getPrisma();
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const cleanupNow = new Date("1901-01-01T00:00:00.000Z");
    const expiredAt = new Date("1900-01-01T00:00:00.000Z");

    // Insert 505 expired rows directly (actionId must reference a real Action).
    const anchor = await seedAction({ ticketId: fx.ticketId, performedByUserId: fx.staff.id, description: "anchor" });
    const rows = Array.from({ length: CLEANUP_BATCH_SIZE + 5 }, (_, i) => ({
      actorUserId: fx.staff.id,
      route,
      key: `cleanup-${fx.suffix}-${i}`,
      requestHash: "hash",
      actionId: anchor,
      responseBody: { data: { id: anchor } },
      createdAt: new Date(expiredAt.getTime() - IDEMPOTENCY_TTL_MS),
      expiresAt: new Date(expiredAt.getTime() + i * 1000),
    }));
    await prisma.actionCreateIdempotency.createMany({ data: rows });
    const unexpiredKey = `cleanup-unexpired-${fx.suffix}`;
    await prisma.actionCreateIdempotency.create({
      data: {
        actorUserId: fx.staff.id,
        route,
        key: unexpiredKey,
        requestHash: "hash",
        actionId: anchor,
        responseBody: { data: { id: anchor } },
        createdAt: new Date(cleanupNow.getTime() - IDEMPOTENCY_TTL_MS),
        expiresAt: new Date(cleanupNow.getTime() + 60_000),
      },
    });

    const first = await cleanupExpiredIdempotency(cleanupNow);
    expect(first.ok).toBe(true);
    expect(first.deleted).toBe(CLEANUP_BATCH_SIZE);
    const remainingExpired = await prisma.actionCreateIdempotency.findMany({
      where: { route, key: { startsWith: `cleanup-${fx.suffix}-` } },
      select: { key: true },
      orderBy: { expiresAt: "asc" },
    });
    expect(remainingExpired.map((row) => row.key)).toEqual(
      Array.from({ length: 5 }, (_, i) => `cleanup-${fx.suffix}-${CLEANUP_BATCH_SIZE + i}`),
    );

    const second = await cleanupExpiredIdempotency(cleanupNow);
    expect(second.ok).toBe(true);
    expect(second.deleted).toBe(5);

    expect(await prisma.actionCreateIdempotency.findUnique({
      where: {
        actorUserId_route_key: { actorUserId: fx.staff.id, route, key: unexpiredKey },
      },
    })).not.toBeNull();
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
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const beforeKeys = await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } });
    const ticketBefore = await prisma.ticket.findUniqueOrThrow({ where: { id: fx.ticketId } });

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
    expect(await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } })).toBe(beforeKeys);
    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: fx.ticketId } });
    expect(ticketAfter.ticketOwnerId).toBe(ticketBefore.ticketOwnerId);
    expect(ok.body.data.performedBy.id).toBe(fx.staff.id);
    expect(ok.body.data.assignee.id).toBe(fx.otherStaff.id);
  });
});

describe("API-ACT-05: list pagination and ordering", () => {
  itIfDb("lists zero/one/many in (createdAt,id) order and validates paging", async () => {
    const zeroTicket = await createAdditionalActionTicket(fx, `zero-${fx.suffix}`);
    const oneTicket = await createAdditionalActionTicket(fx, `one-${fx.suffix}`);
    const manyTicket = await createAdditionalActionTicket(fx, `many-${fx.suffix}`);
    const otherTicket = await createAdditionalActionTicket(fx, `other-${fx.suffix}`);
    try {
      const prisma = getPrisma();
      const timestamp = new Date("2026-09-01T10:00:00.000Z");
      const oneId = await seedAction({
        ticketId: oneTicket.id,
        performedByUserId: fx.staff.id,
        description: "single action",
        createdAt: timestamp,
      });
      const tiedFirstId = await seedAction({
        ticketId: manyTicket.id,
        performedByUserId: fx.staff.id,
        description: "tie first",
        createdAt: timestamp,
      });
      const laterId = await seedAction({
        ticketId: manyTicket.id,
        performedByUserId: fx.staff.id,
        description: "later action",
        createdAt: new Date(timestamp.getTime() + 60_000),
      });
      const tiedSecondId = await seedAction({
        ticketId: manyTicket.id,
        performedByUserId: fx.staff.id,
        description: "tie second",
        createdAt: timestamp,
      });
      const crossTicketId = await seedAction({
        ticketId: otherTicket.id,
        performedByUserId: fx.staff.id,
        description: "belongs elsewhere",
        createdAt: new Date(timestamp.getTime() - 60_000),
      });

      const getList = (ticketNumber: string, query = "") =>
        withSession(request(app).get(`/api/tickets/${ticketNumber}/actions${query}`), fx.staff.session);

      const empty = await getList(zeroTicket.ticketNumber);
      expect(empty.status).toBe(200);
      expect(empty.body.data).toEqual([]);
      expect(empty.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });

      const one = await getList(oneTicket.ticketNumber);
      expect(one.status).toBe(200);
      expect(one.body.data.map((action: { id: number }) => action.id)).toEqual([oneId]);
      expect(one.body.pagination.totalItems).toBe(1);

      const many = await getList(manyTicket.ticketNumber);
      expect(many.status).toBe(200);
      expect(many.body.data.map((action: { id: number }) => action.id)).toEqual([tiedFirstId, tiedSecondId, laterId]);
      expect(many.body.data.map((action: { createdAt: string }) => action.createdAt)).toEqual([
        timestamp.toISOString(),
        timestamp.toISOString(),
        new Date(timestamp.getTime() + 60_000).toISOString(),
      ]);
      expect(many.body.data.some((action: { id: number }) => action.id === crossTicketId)).toBe(false);

      const firstPage = await getList(manyTicket.ticketNumber, "?page=1&pageSize=2");
      const lastPage = await getList(manyTicket.ticketNumber, "?page=2&pageSize=2");
      expect(firstPage.body.data.map((action: { id: number }) => action.id)).toEqual([tiedFirstId, tiedSecondId]);
      expect(lastPage.body.data.map((action: { id: number }) => action.id)).toEqual([laterId]);

      for (const query of ["?page=0", "?page=1.5", "?pageSize=0", "?pageSize=51"]) {
        const invalid = await getList(manyTicket.ticketNumber, query);
        expect(invalid.status).toBe(400);
      }
    } finally {
      await Promise.all([zeroTicket.cleanup(), oneTicket.cleanup(), manyTicket.cleanup(), otherTicket.cleanup()]);
    }
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
    const firstRevision = structuredClone(revisions[0]);

    const invalidBodies: Record<string, unknown>[] = [
      { description: "x" },
      { expectedVersion: null, description: "x" },
      { expectedVersion: 0, description: "x" },
      { expectedVersion: 2 },
      { expectedVersion: 2, description: "x".repeat(2001) },
      { expectedVersion: 2, result: "x".repeat(2001) },
      { expectedVersion: 2, followUpNote: "x".repeat(1001) },
      { expectedVersion: 2, attachmentNotes: "x".repeat(1001) },
      { expectedVersion: 2, followUpRequired: true },
    ];
    for (const body of invalidBodies) {
      const invalid = await withSession(
        request(app).patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`).send(body),
        fx.staff.session,
        { csrf: true },
      );
      expect(invalid.status).toBe(400);
    }

    const unchanged = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
    expect(unchanged.description).toBe("updated");
    expect(unchanged.version).toBe(2);
    expect(await prisma.actionTakenRevision.findMany({ where: { actionId } })).toEqual([firstRevision]);

    const secondEdit = await withSession(
      request(app).patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`).send({
        expectedVersion: 2,
        description: "second update",
      }),
      fx.staff.session,
      { csrf: true },
    );
    expect(secondEdit.status).toBe(200);
    expect(secondEdit.body.data.version).toBe(3);
    expect(await prisma.actionTakenRevision.findUniqueOrThrow({ where: { id: firstRevision.id } })).toEqual(firstRevision);
    expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(2);
  });

  itIfDb("requires explicit repair when the current assignee became ineligible", async () => {
    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-06b-${fx.suffix}`, {
      description: "assigned",
      assigneeUserId: fx.otherStaff.id,
    });
    const actionId = created.body.data.id;
    const prisma = getPrisma();
    const original = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
    const originalRevisionCount = await prisma.actionTakenRevision.count({ where: { actionId } });

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

      const afterRejectedPatch = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
      expect(afterRejectedPatch).toEqual(original);
      expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(originalRevisionCount);

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
    const prisma = getPrisma();
    const assertState = async (expectedStatus: "PENDING" | "COMPLETED", version: number, revisions: number) => {
      const row = await prisma.actionTaken.findUniqueOrThrow({ where: { id: completeId } });
      expect(row.status).toBe(expectedStatus);
      expect(row.version).toBe(version);
      expect(await prisma.actionTakenRevision.count({ where: { actionId: completeId } })).toBe(revisions);
    };

    const invalidStatus = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 1, status: "UNSUPPORTED" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(invalidStatus.status).toBe(400);
    await assertState("PENDING", 1, 0);

    const samePending = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 1, status: "PENDING", description: "still pending" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(samePending.status).toBe(200);
    expect(samePending.body.data.status).toBe("PENDING");
    expect(samePending.body.data.version).toBe(2);

    const noResult = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 2, status: "COMPLETED" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(noResult.status).toBe(400);
    await assertState("PENDING", 2, 1);

    const completed = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 2, status: "COMPLETED", result: "Fixed" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
    await assertState("COMPLETED", 3, 2);

    // Terminal Action cannot be edited.
    const terminalEdit = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${completeId}`)
        .send({ expectedVersion: 3, description: "nope" }),
      fx.staff.session,
      { csrf: true },
    );
    expect(terminalEdit.status).toBe(409);
    await assertState("COMPLETED", 3, 2);

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
    const otherTicket = await createAdditionalActionTicket(fx, `detail-other-${fx.suffix}`);
    try {
      const otherActionId = await seedAction({
        ticketId: otherTicket.id,
        performedByUserId: fx.staff.id,
        description: "other ticket detail",
      });
      const mismatched = await withSession(
        request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${otherActionId}`),
        fx.staff.session,
      );
      expect(mismatched.status).toBe(404);

      const staffDetail = await withSession(
        request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
        fx.staff.session,
      );
      expect(staffDetail.status).toBe(200);
      expect(staffDetail.body.data.performedBy.id).toBe(fx.staff.id);
      expect(staffDetail.body.data.assignee.role).toBe("IT_STAFF");
      expect(staffDetail.body.data.version).toBe(1);

      const adminDetail = await withSession(
        request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
        fx.admin.session,
      );
      expect(adminDetail.status).toBe(200);
      expect(adminDetail.body.data.performedBy.id).toBe(fx.staff.id);
      expect(adminDetail.body.data.version).toBe(1);

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
      expect(requesterDetail.body.data.assignee.role).toBeUndefined();
      expect(requesterDetail.body.data.revisions).toBeUndefined();

      const otherRequesterDetail = await withSession(
        request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
        fx.otherRequester.session,
      );
      expect(otherRequesterDetail.status).toBe(404);
    } finally {
      await otherTicket.cleanup();
    }
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

    const staffList = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.staff.session,
    );
    const staffDetail = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
      fx.staff.session,
    );
    expect(staffList.status).toBe(200);
    expect(staffDetail.status).toBe(200);

    const requesterList = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.requester.session,
    );
    expect(requesterList.status).toBe(200);
    for (const action of requesterList.body.data) {
      expect(action.performedBy.id).toBeUndefined();
      expect(action.assignee?.id).toBeUndefined();
      expect(action.assignee?.role).toBeUndefined();
      expect(action.version).toBeUndefined();
      expect(action.revisions).toBeUndefined();
    }

    // Requester write -> 403.
    const requesterWrite = await postAction(fx.requester.session, fx.ticketNumber, `key-sec-r-${fx.suffix}`, {
      description: "nope",
    });
    expect(requesterWrite.status).toBe(403);
    const requesterPatch = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`)
        .send({ expectedVersion: 1, description: "requester cannot edit" }),
      fx.requester.session,
      { csrf: true },
    );
    expect(requesterPatch.status).toBe(403);

    // Admin parity.
    const adminList = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions`),
      fx.admin.session,
    );
    expect(adminList.status).toBe(200);
    const adminDetail = await withSession(
      request(app).get(`/api/tickets/${fx.ticketNumber}/actions/${actionId}`),
      fx.admin.session,
    );
    expect(adminDetail.status).toBe(200);
    const adminCreate = await postAction(fx.admin.session, fx.ticketNumber, `key-sec-a-${fx.suffix}`, {
      description: "admin action",
    });
    expect(adminCreate.status).toBe(201);
    const adminUpdate = await withSession(
      request(app)
        .patch(`/api/tickets/${fx.ticketNumber}/actions/${adminCreate.body.data.id}`)
        .send({ expectedVersion: 1, description: "admin edit" }),
      fx.admin.session,
      { csrf: true },
    );
    expect(adminUpdate.status).toBe(200);
  });
});

describe("SEC-ACT-02: CSRF enforcement", () => {
  itIfDb("rejects Action POST/PATCH without a valid CSRF token before mutation", async () => {
    const prisma = getPrisma();
    const before = await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } });
    const route = `/api/tickets/${fx.ticketNumber}/actions`;
    const beforeKeys = await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } });

    const unauthenticatedWrite = await request(app)
      .post(route)
      .set("Idempotency-Key", `key-csrf-unauth-${fx.suffix}`)
      .send(createBody());
    expect(unauthenticatedWrite.status).toBe(401);

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

    const created = await postAction(fx.staff.session, fx.ticketNumber, `key-csrf-base-${fx.suffix}`, {
      description: "csrf patch base",
    });
    const actionId = created.body.data.id;
    const beforeAction = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
    const beforeRevisions = await prisma.actionTakenRevision.count({ where: { actionId } });
    const noCsrfPatch = await withSession(
      request(app)
        .patch(`${route}/${actionId}`)
        .send({ expectedVersion: 1, description: "without csrf" }),
      fx.staff.session,
    );
    expect(noCsrfPatch.status).toBe(403);
    const badCsrfPatch = await withSession(
      request(app)
        .patch(`${route}/${actionId}`)
        .set("X-CSRF-Token", "wrong")
        .send({ expectedVersion: 1, description: "invalid csrf" }),
      fx.staff.session,
    );
    expect(badCsrfPatch.status).toBe(403);

    expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } })).toEqual(beforeAction);
    expect(await prisma.actionTakenRevision.count({ where: { actionId } })).toBe(beforeRevisions);
    expect(await prisma.actionTaken.count({ where: { ticketId: fx.ticketId } })).toBe(before + 1);
    expect(await prisma.actionCreateIdempotency.count({ where: { actorUserId: fx.staff.id, route } })).toBe(beforeKeys + 1);
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
