/**
 * Frozen Test-DD file: `server/tests/lab-03/users-admin.api.test.ts`
 *
 * Owned by Issue #41. Frozen rows executed here:
 *   - API-ADM-01  User list
 *   - API-ADM-02  User search/filter (incl. unrecognized role -> no filter)
 *   - API-ADM-03  Create user
 *   - API-ADM-04  Duplicate email -> 409 CONFLICT (subcase A create, subcase B edit)
 *   - API-ADM-05  Edit user (name/email/role/activation updated)
 *   - API-ADM-06  Self-deactivation rejected
 *   - API-ADM-07  Last active Administrator deactivation rejected (concurrency-safe)
 *   - API-ADM-07b Last active Administrator role change to non-Administrator rejected
 *   - API-ADM-08  Set new initial password (must change at next login)
 *   - API-ADM-09  Edit/set-initial-password on nonexistent userId -> 404
 *   - API-ADM-10  Non-last Administrator changes own role away from Administrator
 *   - API-ADM-11  Inactive Administrator demotion/deactivation succeeds (review 48-B2)
 *   - API-ADM-12  Inactive→active race cannot bypass last-Administrator protection
 *   - SEC-AUTHZ-03 Non-Admin requests user management -> 403
 *   - SEC-AUTHZ-09 Non-Administrator calls create-user/edit-user -> 403
 *
 * Rev 8 sub-assertions (Issue #41 plan):
 *   - F-41-1: PATCH round-tripping the target's own unchanged/case-variant email -> 200
 *   - F-41-2: concurrent duplicate-email creates -> exactly one 201, one 409, no 500
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { testSeams } from "../../src/test-seams.js";
import {
  ensureTestUser,
  loginAs,
  withSession,
  TEST_PASSWORD,
  type TestSession,
} from "./helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const ADMIN_EMAIL = "adm41-admin@example.com";
const ADMIN2_EMAIL = "adm41-admin2@example.com";
const STAFF_EMAIL = "adm41-staff@example.com";
const REQUESTER_EMAIL = "adm41-requester@example.com";

const VALID_PASSWORD = "AdminPass123!xyz";

let admin: TestSession;
let admin2: TestSession;
let staff: TestSession;
let requester: TestSession;

/** Creates a user row directly (bypassing the API) for fixture setup. */
async function createFixtureUser(options: {
  email: string;
  name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive?: boolean;
}): Promise<number> {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { email: options.email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { email: options.email },
      data: {
        name: options.name,
        role: options.role,
        passwordHash,
        isActive: options.isActive ?? true,
        mustChangePassword: false,
      },
    });
    return updated.id;
  }
  const created = await prisma.user.create({
    data: {
      email: options.email,
      name: options.name,
      role: options.role,
      passwordHash,
      isActive: options.isActive ?? true,
      mustChangePassword: false,
    },
  });
  return created.id;
}

/** Removes every user created by this suite (email prefix `adm41-`). */
async function cleanupSuiteUsers(): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.deleteMany({ where: { email: { startsWith: "adm41-" } } });
}

/**
 * Snapshot of every pre-existing Administrator row.
 *
 * The last-active-Administrator tests deliberately deactivate/demote Administrators,
 * which mutates shared seed data. Other suites (e.g. the Lab 2 regression suites)
 * depend on the seeded Administrator being active, so this suite must restore the
 * exact prior state in `afterAll` — it must never leave the shared database mutated.
 */
let adminSnapshot: Array<{ id: number; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean }> = [];

async function snapshotAdministrators(): Promise<void> {
  const prisma = getPrisma();
  adminSnapshot = await prisma.user.findMany({
    where: { role: "ADMINISTRATOR" },
    select: { id: true, role: true, isActive: true },
  });
}

async function restoreAdministrators(): Promise<void> {
  const prisma = getPrisma();
  for (const row of adminSnapshot) {
    const existing = await prisma.user.findUnique({ where: { id: row.id }, select: { id: true } });
    if (!existing) continue;
    await prisma.user.update({
      where: { id: row.id },
      data: { role: row.role, isActive: row.isActive },
    });
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;

  await cleanupSuiteUsers();
  await snapshotAdministrators();

  await ensureTestUser({ email: ADMIN_EMAIL, name: "Adm41 Admin", role: "ADMINISTRATOR" });
  await ensureTestUser({ email: ADMIN2_EMAIL, name: "Adm41 Admin Two", role: "ADMINISTRATOR" });
  await ensureTestUser({ email: STAFF_EMAIL, name: "Adm41 Staff", role: "IT_STAFF" });
  await ensureTestUser({ email: REQUESTER_EMAIL, name: "Adm41 Requester", role: "REQUESTER" });

  admin = await loginAs(ADMIN_EMAIL);
  admin2 = await loginAs(ADMIN2_EMAIL);
  staff = await loginAs(STAFF_EMAIL);
  requester = await loginAs(REQUESTER_EMAIL);
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  // Restore the shared Administrator rows BEFORE deleting this suite's own users.
  await restoreAdministrators();
  await cleanupSuiteUsers();
  await disconnectPrisma();
});

// ---------------------------------------------------------------------------
// API-ADM-01 / API-ADM-02 — list, search, filter (AC-15)
// ---------------------------------------------------------------------------

describe("API-ADM-01: user list", () => {
  itIfDb("returns 200 with Name/Email/Role/Status for each user and no passwordHash", async () => {
    const res = await withSession(request(app).get("/api/admin/users"), admin);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const row = (res.body.data as Array<Record<string, unknown>>).find(
      (u) => u.email === ADMIN_EMAIL,
    );
    expect(row).toBeDefined();
    expect(row!.name).toBe("Adm41 Admin");
    expect(row!.role).toBe("ADMINISTRATOR");
    expect(row!.isActive).toBe(true);
    // Frozen list DTO: exactly these five fields.
    expect(Object.keys(row!).sort()).toEqual(["email", "id", "isActive", "name", "role"]);
    // Negative assertion: no passwordHash anywhere in the payload.
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("API-ADM-02: user search/filter", () => {
  itIfDb("search matches name/email case-insensitively", async () => {
    const byName = await withSession(
      request(app).get("/api/admin/users").query({ search: "adm41 admin" }),
      admin,
    );
    expect(byName.status).toBe(200);
    const names = (byName.body.data as Array<{ email: string }>).map((u) => u.email);
    expect(names).toContain(ADMIN_EMAIL);

    const byEmail = await withSession(
      request(app).get("/api/admin/users").query({ search: "ADM41-STAFF@" }),
      admin,
    );
    expect(byEmail.status).toBe(200);
    const emails = (byEmail.body.data as Array<{ email: string }>).map((u) => u.email);
    expect(emails).toContain(STAFF_EMAIL);
  });

  itIfDb("role filter is exact-match", async () => {
    const res = await withSession(
      request(app).get("/api/admin/users").query({ role: "IT_STAFF" }),
      admin,
    );
    expect(res.status).toBe(200);
    const roles = (res.body.data as Array<{ role: string }>).map((u) => u.role);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.every((r) => r === "IT_STAFF")).toBe(true);
  });

  itIfDb("unrecognized role value applies no filter and never returns 400", async () => {
    const unfiltered = await withSession(request(app).get("/api/admin/users"), admin);
    const bogus = await withSession(
      request(app).get("/api/admin/users").query({ role: "SUPERADMIN" }),
      admin,
    );

    expect(bogus.status).toBe(200);
    expect((bogus.body.data as unknown[]).length).toBe((unfiltered.body.data as unknown[]).length);
  });

  itIfDb("search matching zero rows returns 200 with an empty array (not an error)", async () => {
    const res = await withSession(
      request(app).get("/api/admin/users").query({ search: "no-such-user-xyz-999" }),
      admin,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// API-ADM-03 — create user (AC-16)
// ---------------------------------------------------------------------------

describe("API-ADM-03: create user", () => {
  itIfDb("creates a user with mustChangePassword true and no passwordHash in the response", async () => {
    const email = "adm41-created@example.com";
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Created User",
      email,
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe("REQUESTER");
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.mustChangePassword).toBe(true);
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    // The stored hash is a real bcrypt hash of the supplied password.
    const prisma = getPrisma();
    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).not.toBe(VALID_PASSWORD);
    expect(await bcrypt.compare(VALID_PASSWORD, stored!.passwordHash)).toBe(true);
  });

  itIfDb("normalizes the email to lowercase(trim(...)) on create", async () => {
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Mixed Case",
      email: "  Adm41-MixedCase@Example.COM  ",
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("adm41-mixedcase@example.com");
  });

  itIfDb("rejects an invalid role with 400 VALIDATION_ERROR (never silently coerced)", async () => {
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Bad Role",
      email: "adm41-badrole@example.com",
      role: "administrator",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.role).toBeDefined();
  });

  itIfDb("rejects a password-policy violation with 400 VALIDATION_ERROR", async () => {
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Weak Password",
      email: "adm41-weakpw@example.com",
      role: "REQUESTER",
      isActive: true,
      initialPassword: "short",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.initialPassword).toBeDefined();
  });

  itIfDb("rejects a missing name with 400 VALIDATION_ERROR", async () => {
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      email: "adm41-noname@example.com",
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.name).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// API-ADM-04 — duplicate email (AC-17)
// ---------------------------------------------------------------------------

describe("API-ADM-04: duplicate email -> 409 CONFLICT", () => {
  itIfDb("subcase A: create with an existing normalized email -> 409, no user created", async () => {
    const prisma = getPrisma();
    const before = await prisma.user.count();

    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Duplicate",
      email: ADMIN_EMAIL,
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(await prisma.user.count()).toBe(before);
  });

  itIfDb("subcase A: mixed-casing duplicate collides after normalization", async () => {
    const res = await withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
      name: "Duplicate Case",
      email: "ADM41-ADMIN@EXAMPLE.COM",
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  itIfDb("subcase A (Rev 8 — F-41-2): two concurrent creates with the same email -> one 201, one 409, no 500", async () => {
    const prisma = getPrisma();
    const email = "adm41-concurrent@example.com";
    const before = await prisma.user.count();

    const [a, b] = await Promise.all([
      withSession(request(app).post("/api/admin/users"), admin, { csrf: true }).send({
        name: "Concurrent A",
        email,
        role: "REQUESTER",
        isActive: true,
        initialPassword: VALID_PASSWORD,
      }),
      withSession(request(app).post("/api/admin/users"), admin2, { csrf: true }).send({
        name: "Concurrent B",
        email,
        role: "REQUESTER",
        isActive: true,
        initialPassword: VALID_PASSWORD,
      }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect([a.status, b.status]).not.toContain(500);
    expect(await prisma.user.count()).toBe(before + 1);
  });

  itIfDb("subcase B: PATCH User A's email to User B's normalized email -> 409, both rows unchanged", async () => {
    const prisma = getPrisma();
    const aId = await createFixtureUser({
      email: "adm41-edit-a@example.com",
      name: "Edit A",
      role: "REQUESTER",
    });
    const bId = await createFixtureUser({
      email: "adm41-edit-b@example.com",
      name: "Edit B",
      role: "IT_STAFF",
    });

    const aBefore = await prisma.user.findUnique({ where: { id: aId } });
    const bBefore = await prisma.user.findUnique({ where: { id: bId } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${aId}`),
      admin,
      { csrf: true },
    ).send({ email: "ADM41-EDIT-B@EXAMPLE.COM" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const aAfter = await prisma.user.findUnique({ where: { id: aId } });
    const bAfter = await prisma.user.findUnique({ where: { id: bId } });
    expect(aAfter).toEqual(aBefore);
    expect(bAfter).toEqual(bBefore);
  });

  itIfDb("subcase B: admin edits their own email to another user's email -> 409, own row unchanged", async () => {
    const prisma = getPrisma();
    const adminBefore = await prisma.user.findUnique({ where: { id: admin.userId } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin.userId}`),
      admin,
      { csrf: true },
    ).send({ email: STAFF_EMAIL });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const adminAfter = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(adminAfter).toEqual(adminBefore);
  });
});

// ---------------------------------------------------------------------------
// API-ADM-05 — edit user (AC-17)
// ---------------------------------------------------------------------------

describe("API-ADM-05: edit user", () => {
  itIfDb("updates name/email/role/activation and returns the frozen edit DTO", async () => {
    const id = await createFixtureUser({
      email: "adm41-edit-positive@example.com",
      name: "Before Edit",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({
      name: "After Edit",
      email: "adm41-edit-positive-new@example.com",
      role: "IT_STAFF",
      isActive: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("After Edit");
    expect(res.body.data.email).toBe("adm41-edit-positive-new@example.com");
    expect(res.body.data.role).toBe("IT_STAFF");
    expect(res.body.data.isActive).toBe(false);
    expect(Object.keys(res.body.data).sort()).toEqual(["email", "id", "isActive", "name", "role"]);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  itIfDb("rejects an invalid role on edit with 400 VALIDATION_ERROR", async () => {
    const id = await createFixtureUser({
      email: "adm41-edit-badrole@example.com",
      name: "Bad Role Edit",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({ role: "SUPERADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.role).toBeDefined();
  });

  itIfDb("Rev 8 — F-41-1: PATCH with the user's own unchanged email -> 200, never 409", async () => {
    const id = await createFixtureUser({
      email: "adm41-self-email@example.com",
      name: "Self Email",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({ name: "Self Email Renamed", email: "adm41-self-email@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Self Email Renamed");
    expect(res.body.data.email).toBe("adm41-self-email@example.com");
  });

  itIfDb("Rev 8 — F-41-1: PATCH with a case-variant of the user's own email -> 200, stored email stays normalized", async () => {
    const id = await createFixtureUser({
      email: "adm41-self-case@example.com",
      name: "Self Case",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({ email: "ADM41-Self-Case@Example.COM" });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("adm41-self-case@example.com");

    const prisma = getPrisma();
    const stored = await prisma.user.findUnique({ where: { id } });
    expect(stored!.email).toBe("adm41-self-case@example.com");
  });

  itIfDb("ignores a passwordHash field in the PATCH body (no 400, stored hash unchanged)", async () => {
    const prisma = getPrisma();
    const id = await createFixtureUser({
      email: "adm41-patch-hash@example.com",
      name: "Patch Hash",
      role: "REQUESTER",
    });
    const before = await prisma.user.findUnique({ where: { id } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({ name: "Patch Hash Renamed", passwordHash: "$2b$10$attacker-supplied-hash-value" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Patch Hash Renamed");

    const after = await prisma.user.findUnique({ where: { id } });
    expect(after!.passwordHash).toBe(before!.passwordHash);
  });

  itIfDb("Rev 8 — F-41-3: an empty PATCH body is a valid no-op returning 200 with the current row", async () => {
    const id = await createFixtureUser({
      email: "adm41-noop@example.com",
      name: "No Op",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      admin,
      { csrf: true },
    ).send({});

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("No Op");
    expect(res.body.data.email).toBe("adm41-noop@example.com");
    expect(res.body.data.role).toBe("REQUESTER");
    expect(res.body.data.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// API-ADM-06 — self-deactivation (AC-18)
// ---------------------------------------------------------------------------

describe("API-ADM-06: self-deactivation rejected", () => {
  itIfDb("an Administrator cannot deactivate their own account -> 409, isActive unchanged", async () => {
    const prisma = getPrisma();

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin.userId}`),
      admin,
      { csrf: true },
    ).send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const after = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(after!.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// API-ADM-07 / 07b / 10 — last-active-Administrator guard (AC-19)
// ---------------------------------------------------------------------------

describe("API-ADM-07: last active Administrator deactivation rejected (concurrency-safe)", () => {
  itIfDb("deactivating the last active Administrator -> 409, isActive unchanged", async () => {
    const prisma = getPrisma();
    // Deactivate every other Administrator so exactly one remains.
    await prisma.user.updateMany({
      where: { role: "ADMINISTRATOR", email: { not: ADMIN_EMAIL } },
      data: { isActive: false },
    });
    await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin.userId}`),
      admin,
      { csrf: true },
    ).send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const after = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(after!.isActive).toBe(true);
  });

  itIfDb("two concurrent demotions of the last two Administrators -> exactly one succeeds, final active count = 1", async () => {
    const prisma = getPrisma();

    // Fixture: exactly two active Administrators.
    await prisma.user.updateMany({ where: { role: "ADMINISTRATOR" }, data: { isActive: false } });
    await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });
    await prisma.user.update({ where: { id: admin2.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });

    const activeBefore = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(activeBefore).toBe(2);

    // Deterministic interleaving: hold BOTH transactions after they have read the
    // active-Administrator count and before either writes. This is the exact race
    // the Serializable isolation level must reject — without the barrier the two
    // requests usually serialize naturally and the race window is never exercised.
    let arrived = 0;
    let releaseBarrier: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    testSeams.beforeLastAdminWrite = async () => {
      arrived += 1;
      if (arrived === 2) releaseBarrier();
      await barrier;
    };

    try {
      // Two simultaneous demotions, each targeting a different Administrator.
      const [a, b] = await Promise.all([
        withSession(request(app).patch(`/api/admin/users/${admin.userId}`), admin, { csrf: true }).send({
          role: "IT_STAFF",
        }),
        withSession(request(app).patch(`/api/admin/users/${admin2.userId}`), admin2, { csrf: true }).send({
          role: "IT_STAFF",
        }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);
    } finally {
      testSeams.beforeLastAdminWrite = null;
    }

    const activeAfter = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(activeAfter).toBe(1);

    // Restore both Administrators for the remaining tests.
    await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });
    await prisma.user.update({ where: { id: admin2.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });
  });

  itIfDb("inactive-to-active race cannot bypass the last-Administrator guard", async () => {
    const prisma = getPrisma();
    await prisma.user.updateMany({ where: { role: "ADMINISTRATOR" }, data: { isActive: false } });
    await prisma.user.update({
      where: { id: admin.userId },
      data: { role: "ADMINISTRATOR", isActive: true },
    });
    await prisma.user.update({
      where: { id: admin2.userId },
      data: { role: "ADMINISTRATOR", isActive: false },
    });

    const concurrentPrisma = new PrismaClient();
    let paused = false;
    testSeams.afterAdminTargetRead = async ({ userId, role }) => {
      if (userId !== admin2.userId || role !== "IT_STAFF" || paused) return;
      paused = true;
      // Independent connection simulates two valid concurrent operations after
      // the pending request read B as inactive: activate B, then demote A while
      // two active Administrators exist.
      await concurrentPrisma.user.update({
        where: { id: admin2.userId },
        data: { isActive: true },
      });
      const activeCount = await concurrentPrisma.user.count({
        where: { role: "ADMINISTRATOR", isActive: true },
      });
      expect(activeCount).toBe(2);
      await concurrentPrisma.user.update({
        where: { id: admin.userId },
        data: { role: "IT_STAFF" },
      });
    };

    let staleDemotionStatus = 0;
    let staleDemotionCode = "";
    let activeAdminIds: number[] = [];
    try {
      const staleDemotion = await withSession(
        request(app).patch(`/api/admin/users/${admin2.userId}`),
        admin,
        { csrf: true },
      ).send({ role: "IT_STAFF" });
      staleDemotionStatus = staleDemotion.status;
      staleDemotionCode = staleDemotion.body.error?.code ?? "";

      activeAdminIds = (await prisma.user.findMany({
        where: { role: "ADMINISTRATOR", isActive: true },
        select: { id: true },
      })).map(({ id }) => id);
    } finally {
      testSeams.afterAdminTargetRead = null;
      await concurrentPrisma.$disconnect();
      await prisma.user.update({
        where: { id: admin.userId },
        data: { role: "ADMINISTRATOR", isActive: true },
      });
      await prisma.user.update({
        where: { id: admin2.userId },
        data: { role: "ADMINISTRATOR", isActive: true },
      });
    }

    expect(staleDemotionStatus).toBe(409);
    expect(staleDemotionCode).toBe("CONFLICT");
    expect(activeAdminIds).toHaveLength(1);
    expect(activeAdminIds[0]).toBe(admin2.userId);
  });
});

describe("API-ADM-07b: last active Administrator role change rejected", () => {
  itIfDb("demoting the last active Administrator to a non-Administrator role -> 409, role unchanged", async () => {
    const prisma = getPrisma();
    await prisma.user.updateMany({
      where: { role: "ADMINISTRATOR", email: { not: ADMIN_EMAIL } },
      data: { isActive: false },
    });
    await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin.userId}`),
      admin,
      { csrf: true },
    ).send({ role: "IT_STAFF" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");

    const after = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(after!.role).toBe("ADMINISTRATOR");

    // Restore the second Administrator.
    await prisma.user.update({ where: { id: admin2.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });
  });
});

describe("API-ADM-10: non-last Administrator changes own role away from Administrator", () => {
  itIfDb("succeeds with 200 and the role is updated", async () => {
    const prisma = getPrisma();
    // Ensure at least two active Administrators so the acting admin is not the last.
    await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });
    await prisma.user.update({ where: { id: admin2.userId }, data: { isActive: true, role: "ADMINISTRATOR" } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin.userId}`),
      admin,
      { csrf: true },
    ).send({ role: "IT_STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("IT_STAFF");

    // Restore the acting admin's role for the remaining tests.
    await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMINISTRATOR" } });
  });
});

// ---------------------------------------------------------------------------
// API-ADM-11 — inactive Administrator demotion (Issue #41 review 48-B2)
//
// The last-active-Administrator guard must only run when the target is CURRENTLY
// ACTIVE and CURRENTLY an Administrator. An inactive Administrator is already
// excluded from the active count, so demoting them cannot reduce it and must
// succeed (200) even when exactly one active Administrator remains.
// ---------------------------------------------------------------------------

describe("API-ADM-11: inactive Administrator can be demoted while one active Administrator remains", () => {
  itIfDb("demoting an inactive Administrator -> 200, role updated, active count unchanged", async () => {
    const prisma = getPrisma();

    // Fixture: Admin A active, Admin B inactive. Exactly one active Administrator.
    await prisma.user.updateMany({ where: { role: "ADMINISTRATOR" }, data: { isActive: false } });
    await prisma.user.update({
      where: { id: admin.userId },
      data: { isActive: true, role: "ADMINISTRATOR" },
    });
    await prisma.user.update({
      where: { id: admin2.userId },
      data: { isActive: false, role: "ADMINISTRATOR" },
    });

    const activeBefore = await prisma.user.count({
      where: { role: "ADMINISTRATOR", isActive: true },
    });
    expect(activeBefore).toBe(1);

    // Admin A demotes the INACTIVE Admin B to IT_STAFF.
    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin2.userId}`),
      admin,
      { csrf: true },
    ).send({ role: "IT_STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("IT_STAFF");

    const after = await prisma.user.findUnique({ where: { id: admin2.userId } });
    expect(after!.role).toBe("IT_STAFF");
    expect(after!.isActive).toBe(false);

    // Admin A remains the sole active Administrator — the invariant is preserved.
    const adminAAfter = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(adminAAfter!.role).toBe("ADMINISTRATOR");
    expect(adminAAfter!.isActive).toBe(true);

    const activeAfter = await prisma.user.count({
      where: { role: "ADMINISTRATOR", isActive: true },
    });
    expect(activeAfter).toBe(1);

    // Restore both Administrators for the remaining tests.
    await prisma.user.update({
      where: { id: admin2.userId },
      data: { isActive: true, role: "ADMINISTRATOR" },
    });
  });

  itIfDb("deactivating an already-inactive Administrator -> 200 (no count reduction)", async () => {
    const prisma = getPrisma();

    await prisma.user.updateMany({ where: { role: "ADMINISTRATOR" }, data: { isActive: false } });
    await prisma.user.update({
      where: { id: admin.userId },
      data: { isActive: true, role: "ADMINISTRATOR" },
    });
    await prisma.user.update({
      where: { id: admin2.userId },
      data: { isActive: false, role: "ADMINISTRATOR" },
    });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${admin2.userId}`),
      admin,
      { csrf: true },
    ).send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const activeAfter = await prisma.user.count({
      where: { role: "ADMINISTRATOR", isActive: true },
    });
    expect(activeAfter).toBe(1);

    // Restore both Administrators for the remaining tests.
    await prisma.user.update({
      where: { id: admin2.userId },
      data: { isActive: true, role: "ADMINISTRATOR" },
    });
  });
});

// ---------------------------------------------------------------------------
// API-ADM-08 — initial password reset (AC-16)
// ---------------------------------------------------------------------------

describe("API-ADM-08: set new initial password", () => {
  itIfDb("resets the password, sets mustChangePassword, and forces a change at next login (end-to-end)", async () => {
    const prisma = getPrisma();
    const email = "adm41-reset@example.com";
    const id = await createFixtureUser({ email, name: "Reset Target", role: "REQUESTER" });

    const newPassword = "ResetPass456!abc";
    const res = await withSession(
      request(app).post(`/api/admin/users/${id}/initial-password`),
      admin,
      { csrf: true },
    ).send({ initialPassword: newPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.mustChangePassword).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    // The stored hash is a real bcrypt hash of the new password.
    const stored = await prisma.user.findUnique({ where: { id } });
    expect(await bcrypt.compare(newPassword, stored!.passwordHash)).toBe(true);
    expect(stored!.mustChangePassword).toBe(true);

    // End-to-end: log in with the new password -> normal access is blocked.
    const loginRes = await request(app).post("/api/auth/login").send({ email, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.mustChangePassword).toBe(true);

    const rawCookie = loginRes.headers["set-cookie"];
    const cookie = String(Array.isArray(rawCookie) ? rawCookie[0] : rawCookie).split(";")[0];
    const csrf = String(loginRes.headers["x-csrf-token"] ?? "");

    const blocked = await request(app).get("/api/app/context").set("Cookie", cookie);
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // Complete the change-password flow -> normal access is unblocked.
    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ currentPassword: newPassword, newPassword: "FinalPass789!xyz" });
    expect(changed.status).toBe(200);

    const unblocked = await request(app).get("/api/app/context").set("Cookie", cookie);
    expect(unblocked.status).toBe(200);
  });

  itIfDb("rejects a password-policy violation with 400 VALIDATION_ERROR", async () => {
    const id = await createFixtureUser({
      email: "adm41-reset-weak@example.com",
      name: "Reset Weak",
      role: "REQUESTER",
    });

    const res = await withSession(
      request(app).post(`/api/admin/users/${id}/initial-password`),
      admin,
      { csrf: true },
    ).send({ initialPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.initialPassword).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// API-ADM-09 — nonexistent userId (AC-16, AC-17)
// ---------------------------------------------------------------------------

describe("API-ADM-09: nonexistent userId -> 404 NOT_FOUND", () => {
  itIfDb("PATCH on a nonexistent userId -> 404", async () => {
    const res = await withSession(
      request(app).patch("/api/admin/users/2147483647"),
      admin,
      { csrf: true },
    ).send({ name: "Ghost" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("initial-password on a nonexistent userId -> 404", async () => {
    const res = await withSession(
      request(app).post("/api/admin/users/2147483647/initial-password"),
      admin,
      { csrf: true },
    ).send({ initialPassword: VALID_PASSWORD });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  itIfDb("a malformed userId -> 404 (never 500)", async () => {
    const res = await withSession(
      request(app).patch("/api/admin/users/not-a-number"),
      admin,
      { csrf: true },
    ).send({ name: "Ghost" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// SEC-AUTHZ-03 / SEC-AUTHZ-09 — non-Administrator forbidden (AC-20)
// ---------------------------------------------------------------------------

describe("SEC-AUTHZ-03: non-Admin requests user management -> 403", () => {
  itIfDb("IT Staff GET /api/admin/users -> 403 FORBIDDEN", async () => {
    const res = await withSession(request(app).get("/api/admin/users"), staff);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  itIfDb("Requester GET /api/admin/users -> 403 FORBIDDEN", async () => {
    const res = await withSession(request(app).get("/api/admin/users"), requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("SEC-AUTHZ-09: non-Administrator calls create-user/edit-user -> 403", () => {
  itIfDb("IT Staff POST /api/admin/users -> 403, no user created", async () => {
    const prisma = getPrisma();
    const before = await prisma.user.count();

    const res = await withSession(request(app).post("/api/admin/users"), staff, { csrf: true }).send({
      name: "Forbidden Create",
      email: "adm41-forbidden@example.com",
      role: "REQUESTER",
      isActive: true,
      initialPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await prisma.user.count()).toBe(before);
  });

  itIfDb("Requester PATCH /api/admin/users/:id -> 403, target unchanged", async () => {
    const prisma = getPrisma();
    const id = await createFixtureUser({
      email: "adm41-forbidden-edit@example.com",
      name: "Forbidden Edit",
      role: "REQUESTER",
    });
    const before = await prisma.user.findUnique({ where: { id } });

    const res = await withSession(
      request(app).patch(`/api/admin/users/${id}`),
      requester,
      { csrf: true },
    ).send({ name: "Hacked" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.user.findUnique({ where: { id } });
    expect(after).toEqual(before);
  });

  itIfDb("supplementary: non-Administrator POST initial-password -> 403, password state unchanged", async () => {
    const prisma = getPrisma();
    const id = await createFixtureUser({
      email: "adm41-forbidden-reset@example.com",
      name: "Forbidden Reset",
      role: "REQUESTER",
    });
    const before = await prisma.user.findUnique({ where: { id } });

    const res = await withSession(
      request(app).post(`/api/admin/users/${id}/initial-password`),
      staff,
      { csrf: true },
    ).send({ initialPassword: "AttackerPass123!xyz" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const after = await prisma.user.findUnique({ where: { id } });
    expect(after!.passwordHash).toBe(before!.passwordHash);
    expect(after!.mustChangePassword).toBe(before!.mustChangePassword);
  });
});
