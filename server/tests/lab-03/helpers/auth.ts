/**
 * Shared authenticated-session test helper (Issue #37 — Lab 2 regression cutover).
 *
 * Lab 2 tests injected identity with the `X-Dev-Requester-Id` header. That mechanism
 * is removed by #37, so every Lab 2 test that exercised a protected route must now
 * establish a real authenticated session (login → httpOnly cookie + CSRF token).
 *
 * This helper is the single fixture used by the RR-04-audited Lab 2 test updates:
 * class (a) tests keep every functional assertion and only swap the auth fixture.
 *
 * Not a test file — it lives outside the `*.test.ts` include pattern.
 */

import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../../../src/app.js";
import { getPrisma } from "../../../src/prisma.js";

/** Deterministic test-only session secret (frozen §13). */
export const TEST_SESSION_SECRET = "test-only-session-secret-not-for-production";

/** Password used for every helper-managed test account. */
export const TEST_PASSWORD = "TestPass123!xyz";

export interface TestSession {
  /** `connect.sid=…` cookie value for the authenticated session. */
  cookie: string;
  /** Session-bound CSRF token, echoed on state-changing requests. */
  csrfToken: string;
  /** Authenticated user id. */
  userId: number;
  /** Authenticated user role. */
  role: string;
}

/** Extracts the session cookie value from a supertest response. */
function extractSessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first).split(";")[0];
}

/**
 * Ensures a User row exists with a known password and `mustChangePassword = false`
 * (so the password-change gate does not block normal application routes).
 *
 * Returns the user id. Idempotent — safe to call from `beforeAll`.
 */
export async function ensureTestUser(options: {
  email: string;
  name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive?: boolean;
}): Promise<number> {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const data = {
    name: options.name,
    role: options.role,
    passwordHash,
    isActive: options.isActive ?? true,
    mustChangePassword: false,
  };

  const existing = await prisma.user.findUnique({ where: { email: options.email } });
  if (existing) {
    const updated = await prisma.user.update({ where: { email: options.email }, data });
    return updated.id;
  }
  const created = await prisma.user.create({ data: { email: options.email, ...data } });
  return created.id;
}

/**
 * Logs in as the given account and returns the session cookie + CSRF token.
 *
 * The account must already exist (see `ensureTestUser`).
 */
export async function loginAs(email: string, password: string = TEST_PASSWORD): Promise<TestSession> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = extractSessionCookie(res);
  const csrfToken = String(res.headers["x-csrf-token"] ?? "");
  return {
    cookie,
    csrfToken,
    userId: res.body.data.id as number,
    role: res.body.data.role as string,
  };
}

/** Convenience: ensure the account exists, then log in. */
export async function ensureAndLogin(options: {
  email: string;
  name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive?: boolean;
}): Promise<TestSession> {
  await ensureTestUser(options);
  return loginAs(options.email);
}

/**
 * Applies an authenticated session to a supertest request.
 *
 * `csrf: true` additionally echoes the session-bound CSRF token, required on every
 * state-changing (non-GET) protected route.
 */
export function withSession<T extends { set: (k: string, v: string) => T }>(
  req: T,
  session: TestSession,
  options: { csrf?: boolean } = {},
): T {
  req.set("Cookie", session.cookie);
  if (options.csrf) {
    req.set("X-CSRF-Token", session.csrfToken);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Session registry — for Lab 2 integration suites that switch identity per request.
// ---------------------------------------------------------------------------

const registry = new Map<number, TestSession>();

/**
 * Original `User` rows captured before `registerSession` mutated them, so the
 * mutation can be undone. Lab 2 integration suites reuse the seeded requesters,
 * and other suites (e.g. the migration tests) assert on those rows' original
 * state — so the fixture must be non-destructive.
 */
const snapshots = new Map<
  number,
  { passwordHash: string; mustChangePassword: boolean; isActive: boolean }
>();

/**
 * Gives the user a known password (and clears the password-change gate), logs in,
 * and registers the resulting session under the user id.
 *
 * The original row is snapshotted first; call `clearSessions()` from `afterAll` to
 * restore it. Call from `beforeAll` for every identity a suite needs.
 */
export async function registerSession(userId: number): Promise<TestSession> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`registerSession: no user with id ${userId}`);
  }

  if (!snapshots.has(userId)) {
    snapshots.set(userId, {
      passwordHash: user.passwordHash,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      mustChangePassword: false,
      isActive: true,
    },
  });
  const session = await loginAs(user.email);
  registry.set(userId, session);
  return session;
}

/** Synchronous lookup of a registered session (for building requests inline). */
export function sess(userId: number): TestSession {
  const session = registry.get(userId);
  if (!session) {
    throw new Error(`sess: no registered session for user ${userId} — call registerSession first`);
  }
  return session;
}

/**
 * Clears the session registry and restores every mutated `User` row to its
 * pre-fixture state. Call from `afterAll`.
 *
 * Tolerant of rows the suite itself deleted (e.g. a suite that creates and then
 * removes its own test requesters): a missing row needs no restore.
 */
export async function clearSessions(): Promise<void> {
  registry.clear();
  if (snapshots.size === 0) return;

  const prisma = getPrisma();
  for (const [userId, original] of snapshots) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) continue;
    await prisma.user.update({ where: { id: userId }, data: original });
  }
  snapshots.clear();
}

/**
 * Applies a registered session (by user id) to a supertest request, including the
 * CSRF token. Convenience for Lab 2 integration suites that switch identity inline.
 */
export function asUser<T extends { set: (k: string, v: string) => T }>(req: T, userId: number): T {
  const session = sess(userId);
  req.set("Cookie", session.cookie);
  req.set("X-CSRF-Token", session.csrfToken);
  return req;
}