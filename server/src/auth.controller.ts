/**
 * Auth controller (Issue #35 — Lab 3 authentication).
 * Implements the four frozen auth endpoints per api-spec §1–§4.
 */

import { Request, Response } from "express";
import { getPrisma } from "./prisma.js";
import {
  validatePasswordPolicy,
  verifyCredentials,
  changePassword,
  IncorrectCurrentPasswordError,
} from "./auth-service.js";
import { issueCsrfToken } from "./session.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user: { id: number; name: string; email: string; role: string; mustChangePassword: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** POST /api/auth/login — public. Establishes a fresh session (fixation-safe). */
export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid email is required.", fields: {} } });
    return;
  }
  if (!password) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Password is required.", fields: {} } });
    return;
  }

  const user = await verifyCredentials(email, password);
  if (!user || !user.isActive) {
    // Safe generic failure — invalid credentials and inactive accounts are indistinguishable (AC-05).
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Invalid email or password." } });
    return;
  }

  // Fixation-safe: regenerate the session identifier at privilege change.
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;
  issueCsrfToken(req, res);

  res.status(200).json({ data: publicUser(user) });
}

/** POST /api/auth/logout — authenticated + CSRF. Destroys exactly one session. */
export async function logout(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
  res.status(200).json({ data: { success: true } });
}

/** GET /api/auth/me — authenticated. Returns current identity + role from the DB. */
export async function me(_req: Request, res: Response): Promise<void> {
  const user = res.locals.user;
  res.status(200).json({ data: publicUser(user) });
}

/**
 * GET /api/app/context — authenticated + password-change gate.
 *
 * This is the #35 "normal application" entry surface: it is the minimal protected
 * endpoint that composes `requireAuth → requirePasswordChanged → handler`, so the
 * mandatory-password-change gate (BR-02 / AC-02) is enforced by the backend on a
 * real application endpoint rather than only on the content-gate-exempt auth routes.
 *
 * It is intentionally NOT one of the frozen auth endpoints (`/api/auth/me` is
 * content-gate-exempt) and NOT a downstream #37/#38/#41 feature route. It returns
 * only the authenticated identity already available from `res.locals` (populated by
 * `requireAuth` from the current DB row) — no new business data, no new schema.
 */
export async function appContext(_req: Request, res: Response): Promise<void> {
  const user = res.locals.user;
  res.status(200).json({ data: publicUser(user) });
}

/** POST /api/auth/change-password — authenticated + CSRF. Never returns PASSWORD_CHANGE_REQUIRED. */
export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Current password is required.", fields: {} } });
    return;
  }
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: policyError, fields: {} } });
    return;
  }

  try {
    await changePassword(res.locals.userId, currentPassword, newPassword);
    res.status(200).json({ data: { success: true, mustChangePassword: false } });
  } catch (err) {
    if (err instanceof IncorrectCurrentPasswordError) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Current password is incorrect.", fields: {} },
      });
      return;
    }
    throw err;
  }
}