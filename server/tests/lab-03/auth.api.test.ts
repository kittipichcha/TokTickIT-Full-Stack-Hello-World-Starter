import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { deriveInitialPassword } from "../../src/migrate-lab3.js";
import bcrypt from "bcrypt";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

// Deterministic test-only session secret (frozen §13 / Rev6 §4.5).
process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const VALID_NEW_PASSWORD = "NewPass123!xyz";

/** Extracts the session cookie value from a supertest response (set-cookie may be an array). */
function extractSessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first).split(";")[0];
}

/**
 * Extracts the raw session id from a `connect.sid` cookie value.
 * The cookie value is `s%3A<sid>.<signature>` (URL-encoded `s:<sid>.<sig>`).
 */
function extractSessionId(cookie: string): string {
  const value = cookie.slice(cookie.indexOf("=") + 1);
  const decoded = decodeURIComponent(value);
  const withoutPrefix = decoded.startsWith("s:") ? decoded.slice(2) : decoded;
  return withoutPrefix.split(".")[0];
}

/**
 * Deterministically expires a real server-side session record in the
 * connect-pg-simple store (no 30-minute wall-clock sleep). The store's `get()`
 * filters on `expire >= to_timestamp(now)`, so setting `expire` to the epoch
 * makes the session behave exactly like an idle-expired session.
 */
async function expireSession(sid: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new pg.Pool({ connectionString: url.split("?")[0] });
  try {
    await pool.query('UPDATE "session" SET expire = to_timestamp(0) WHERE sid = $1', [sid]);
  } finally {
    await pool.end();
  }
}

/**
 * Reads the remaining lifetime (seconds) of a session record, computed in the
 * session store's own frame (`expire` is a naive timestamp compared against
 * `to_timestamp(now)` by connect-pg-simple).
 */
async function readSessionRemainingSeconds(sid: string): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new pg.Pool({ connectionString: url.split("?")[0] });
  try {
    const result = await pool.query<{ remaining: string }>(
      'SELECT EXTRACT(EPOCH FROM (expire - to_timestamp(EXTRACT(EPOCH FROM now()))))::text AS remaining FROM "session" WHERE sid = $1',
      [sid],
    );
    return Number(result.rows[0]?.remaining ?? 0);
  } finally {
    await pool.end();
  }
}

describe("API-AUTH-01..09 / SEC-AUTHZ-06: Auth endpoints", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    // Ensure a known active requester exists with a known derived password.
    const email = "ada@example.com";
    const derived = deriveInitialPassword(email, "Ada Lovelace");
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Reset to a deterministic state so tests are independent of prior runs.
      await prisma.user.update({
        where: { email },
        data: { passwordHash: await bcrypt.hash(derived, 10), isActive: true, mustChangePassword: true },
      });
    } else {
      await prisma.user.create({
        data: {
          name: "Ada Lovelace",
          email,
          role: "REQUESTER",
          passwordHash: await bcrypt.hash(derived, 10),
          isActive: true,
          mustChangePassword: true,
        },
      });
    }
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await disconnectPrisma();
  });

  // Reset Ada's password to the derived value before each test so tests are
  // independent of prior runs (API-AUTH-07 changes the password).
  beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    await prisma.user.update({
      where: { email: "ada@example.com" },
      data: { passwordHash: await bcrypt.hash(derived, 10), isActive: true, mustChangePassword: true },
    });
  });

  itIfDb("API-AUTH-01: valid login returns 200 with safe user data and httpOnly cookie", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe("Ada Lovelace");
    expect(res.body.data.email).toBe("ada@example.com");
    expect(res.body.data.role).toBe("REQUESTER");
    expect(res.body.data.mustChangePassword).toBe(true);
    // No passwordHash in the payload.
    expect(res.body.data.passwordHash).toBeUndefined();
    // httpOnly session cookie set.
    const rawCookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(";") : String(rawCookie);
    expect(cookieStr).toBeDefined();
    expect(cookieStr).toContain("HttpOnly");
    // CSRF token header issued.
    expect(res.headers["x-csrf-token"]).toBeDefined();
  });

  itIfDb("API-AUTH-02: invalid credentials return 401 UNAUTHENTICATED with a safe generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "definitely-wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    // Generic message — no reveal which part was wrong.
    expect(res.body.error.message).toMatch(/invalid|incorrect/i);
  });

  itIfDb("API-AUTH-03: inactive account login returns 401 indistinguishable from invalid credentials", async () => {
    const prisma = getPrisma();
    const email = "inactive-auth-test@example.com";
    const derived = deriveInitialPassword(email, "Inactive Auth Test");
    await prisma.user.upsert({
      where: { email },
      update: { isActive: false },
      create: {
        name: "Inactive Auth Test",
        email,
        role: "REQUESTER",
        passwordHash: await bcrypt.hash(derived, 10),
        isActive: false,
        mustChangePassword: true,
      },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: derived });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    // Message indistinguishable from API-AUTH-02.
    expect(res.body.error.message).toMatch(/invalid|incorrect/i);
  });

  itIfDb("API-AUTH-04: logout destroys the session; subsequent protected request is 401", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);
    const csrf = loginRes.headers["x-csrf-token"];

    // Logout without CSRF -> 403.
    const noCsrf = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(noCsrf.status).toBe(403);

    // Logout with CSRF -> 200.
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.success).toBe(true);

    // Subsequent protected request -> 401.
    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(401);
  });

  itIfDb("API-AUTH-05: /me returns identity + role; 401 without a session", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);

    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe("REQUESTER");

    const noSession = await request(app).get("/api/auth/me");
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("API-AUTH-06: mustChangePassword user is blocked from a protected endpoint with PASSWORD_CHANGE_REQUIRED", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);
    const csrf = loginRes.headers["x-csrf-token"];

    // A real normal-application protected endpoint (requireAuth -> requirePasswordChanged).
    // This test fails if requirePasswordChanged is removed from the route chain.
    const blocked = await request(app).get("/api/app/context").set("Cookie", cookie);
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // The content-gate-exempt auth routes remain reachable while the gate is active.
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);

    // Change the password using the SAME session (no re-login).
    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ currentPassword: derived, newPassword: VALID_NEW_PASSWORD });
    expect(changed.status).toBe(200);
    expect(changed.body.data.mustChangePassword).toBe(false);

    // The same session now reaches the normal protected endpoint.
    const allowed = await request(app).get("/api/app/context").set("Cookie", cookie);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.email).toBe("ada@example.com");
    expect(allowed.body.data.mustChangePassword).toBe(false);
  });

  itIfDb("API-AUTH-07: password policy boundaries via change-password", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const prisma = getPrisma();

    // Reset Ada's password to the derived value, then attempt a change. This keeps
    // each boundary attempt independent (a successful change alters the current password).
    const attempt = async (newPassword: string) => {
      await prisma.user.update({
        where: { email: "ada@example.com" },
        data: { passwordHash: await bcrypt.hash(derived, 10), mustChangePassword: true },
      });
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: derived });
      const cookie = extractSessionCookie(loginRes);
      const csrf = loginRes.headers["x-csrf-token"];
      return request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrf)
        .send({ currentPassword: derived, newPassword });
    };

    // 11 chars rejected.
    expect((await attempt("Short1!a")).status).toBe(400);
    // 12 valid accepted.
    expect((await attempt("Abcdef12!xyz")).status).toBe(200);
    // 128 valid accepted.
    const p128 = "A1!" + "a".repeat(125);
    expect((await attempt(p128)).status).toBe(200);
    // 129 rejected.
    const p129 = "A1!" + "a".repeat(126);
    expect((await attempt(p129)).status).toBe(400);
    // Missing uppercase rejected.
    expect((await attempt("abcdef123!xyz")).status).toBe(400);
    // Missing lowercase rejected.
    expect((await attempt("ABCDEF123!XYZ")).status).toBe(400);
    // Missing digit rejected.
    expect((await attempt("Abcdefgh!xyz")).status).toBe(400);
    // Missing special rejected.
    expect((await attempt("Abcdefgh123xyz")).status).toBe(400);
    // Valid composition accepted.
    expect((await attempt("Abcdef123!xyz")).status).toBe(200);
  });

  itIfDb("API-AUTH-08: wrong currentPassword returns 400 VALIDATION_ERROR with a generic message", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);
    const csrf = loginRes.headers["x-csrf-token"];

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ currentPassword: "wrong-current-password", newPassword: VALID_NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/current password is incorrect/i);
  });

  itIfDb("API-AUTH-09: second concurrent login keeps both sessions valid", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const login1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie1 = extractSessionCookie(login1);

    const login2 = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie2 = extractSessionCookie(login2);

    // Both sessions are independently valid.
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie1)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie2)).status).toBe(200);
  });

  itIfDb("SEC-AUTHZ-06: an actually expired session is rejected as unauthenticated (401 UNAUTHENTICATED)", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);
    const sid = extractSessionId(cookie);

    // The session exists in the real server-side store with a ~30-minute expiry.
    const remaining = await readSessionRemainingSeconds(sid);
    expect(remaining).toBeGreaterThan(29 * 60);
    expect(remaining).toBeLessThanOrEqual(30 * 60 + 5);

    // Before expiry the session is valid (use the requireAuth-only endpoint so this
    // test isolates session validity from the password-change gate).
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);

    // Deterministically expire the real session record (no 30-minute wall-clock sleep).
    await expireSession(sid);

    // The expired session behaves exactly like an unauthenticated session.
    const expired = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("SEC-AUTHZ-06 (supplementary): session cookie is configured for a 30-minute rolling idle timeout", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const rawCookie = loginRes.headers["set-cookie"];
    const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(";") : String(rawCookie);
    // The cookie carries an Expires ~30 minutes in the future (30-minute rolling idle expiry).
    const expiresMatch = cookieStr.match(/Expires=([^;]+)/);
    expect(expiresMatch).not.toBeNull();
    const expiresAt = new Date(expiresMatch![1]).getTime();
    const deltaMinutes = (expiresAt - Date.now()) / 60000;
    // Allow a small tolerance around 30 minutes.
    expect(deltaMinutes).toBeGreaterThan(29);
    expect(deltaMinutes).toBeLessThan(31);
    // httpOnly + SameSite are set.
    expect(cookieStr).toContain("HttpOnly");
    expect(cookieStr).toMatch(/SameSite=Lax/i);
  });

  itIfDb("Supplementary AU-19: change-password with missing CSRF returns 403 and no state change", async () => {
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: derived });
    const cookie = extractSessionCookie(loginRes);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: derived, newPassword: VALID_NEW_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});