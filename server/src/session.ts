/**
 * Session middleware + CSRF (Issue #35 — Lab 3 auth).
 *
 * Frozen session authority (spec §13 / review Rev8 §4.6):
 *   - The session stores identity only: `userId`, the CSRF token, and session metadata.
 *   - `role`, `isActive`, and `mustChangePassword` are NEVER stored in the session.
 *   - `requireAuth` re-reads the current `User` row on EVERY protected request and
 *     populates `res.locals` from the database (never a login-time snapshot).
 *   - A deactivated user's live session becomes invalid (401, session destroyed) on its
 *     next protected request.
 *
 * Gate rejections (frozen §0 canonical table / Rev 12 — N-5):
 *   - requireAuth (missing/inactive) -> 401 UNAUTHENTICATED
 *   - requirePasswordChanged (mustChangePassword) -> 401 PASSWORD_CHANGE_REQUIRED
 *   - requireCsrf (missing/invalid token) -> 403 FORBIDDEN
 */

import { NextFunction, Request, Response, RequestHandler } from "express";
import expressSession from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { getPrisma } from "./prisma.js";
import { getSessionSecret } from "./config/env.js";
import { testSeams } from "./test-seams.js";

const SESSION_TTL_SECONDS = 30 * 60; // 30-minute rolling idle expiry (frozen)
const SESSION_COOKIE_MAX_AGE_MS = 30 * 60 * 1000;

// Augment the express-session SessionData with our custom fields (identity + CSRF only).
declare module "express-session" {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
  }
}

/** Express session middleware configured per the frozen security policy. */
export function sessionMiddleware(): RequestHandler {
  const isProduction = process.env.NODE_ENV === "production";
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pgPool = new pg.Pool({ connectionString: url.split("?")[0] });
  const PgStore = connectPgSimple(expressSession);

  return expressSession({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    },
    store: new PgStore({
      pool: pgPool,
      createTableIfMissing: true,
      disableTouch: false,
      ttl: SESSION_TTL_SECONDS,
    }),
  });
}

/** Generates a fresh session-bound CSRF synchronizer token. */
function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/** Issues the CSRF token into the session and the X-CSRF-Token response header. */
export function issueCsrfToken(req: Request, res: Response): string {
  const existing = req.session.csrfToken as string | undefined;
  if (existing) {
    res.setHeader("X-CSRF-Token", existing);
    return existing;
  }
  const token = generateCsrfToken();
  req.session.csrfToken = token;
  res.setHeader("X-CSRF-Token", token);
  return token;
}

/**
 * requireAuth — fresh-User authority.
 * Re-reads the current User row per protected request; missing/inactive -> destroy session + 401.
 *
 * Issue #37: when `testSeams.sessionIdentity` is set (Lab 2 regression fixture only),
 * the identity is taken from the seam instead of the session + DB read. The seam is
 * honored ONLY when `NODE_ENV === "test"` (N-3 guard), so it is inert in production.
 * The real authentication boundary is covered by #35's auth suite and by #37's frozen
 * authorization/requester API tests, which use real logins.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const seam = process.env.NODE_ENV === "test" ? testSeams.sessionIdentity : null;
  if (seam) {
    res.locals.userId = seam.userId;
    res.locals.role = seam.role;
    res.locals.mustChangePassword = seam.mustChangePassword;
    res.locals.user = {
      id: seam.userId,
      name: seam.name,
      email: seam.email,
      role: seam.role,
      mustChangePassword: seam.mustChangePassword,
      isActive: true,
    };
    next();
    return;
  }

  const userId = req.session.userId as number | undefined;
  if (userId === undefined) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      // Deactivated or deleted user: destroy the session and reject.
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => (err ? reject(err) : resolve()));
      });
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }

    // Populate res.locals from the DB (never the session).
    res.locals.userId = user.id;
    res.locals.role = user.role;
    res.locals.mustChangePassword = user.mustChangePassword;
    res.locals.user = user;
    next();
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  }
}

/**
 * requirePasswordChanged — blocks normal application access until the password is changed.
 * Rejects with 401 PASSWORD_CHANGE_REQUIRED (frozen §0 canonical table / N-5).
 */
export function requirePasswordChanged(_req: Request, res: Response, next: NextFunction): void {
  if (res.locals.mustChangePassword === true) {
    res.status(401).json({
      error: { code: "PASSWORD_CHANGE_REQUIRED", message: "You must change your password before proceeding." },
    });
    return;
  }
  next();
}

/**
 * requireCsrf — validates the session-bound synchronizer token on state-changing requests.
 * Missing/invalid -> 403 FORBIDDEN (no state change).
 *
 * Issue #37: when `testSeams.sessionIdentity` is set (Lab 2 regression fixture only),
 * CSRF is satisfied by the fixture. The seam is honored ONLY when `NODE_ENV === "test"`
 * (N-3 guard), so it is inert in production. Lab 2 had no CSRF mechanism, so those
 * suites exercise business logic only; the CSRF boundary itself is covered by the
 * frozen SEC-AUTHZ-07 row in `authorization.api.test.ts`, which uses real logins.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test" && testSeams.sessionIdentity) {
    next();
    return;
  }

  const expected = req.session.csrfToken as string | undefined;
  const provided = req.headers["x-csrf-token"];
  const headerValue = Array.isArray(provided) ? provided[0] : provided;

  if (!expected || !headerValue || headerValue !== expected) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Invalid or missing CSRF token." } });
    return;
  }
  next();
}

/** Convenience: requireAuth + requireCsrf for state-changing protected routes. */
export function requireAuthAndCsrf(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => requireCsrf(req, res, next));
}