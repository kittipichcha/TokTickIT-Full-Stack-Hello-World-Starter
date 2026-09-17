/**
 * Auth service (Issue #35 — Lab 3 authentication).
 *
 * Frozen password policy (§13 decision 12 / api-spec §4, §25, §27):
 *   - 12–128 characters
 *   - at least one uppercase ASCII letter (A–Z)
 *   - at least one lowercase ASCII letter (a–z)
 *   - at least one digit (0–9)
 *   - at least one ASCII special character from `!@#$%^&*()-_=+[]{};:,.?/\`
 *   - NOT trimmed before validation; whitespace permitted
 *   - no password-reuse/history rule in Lab 3
 *
 * This single function is reused — never reimplemented — by change-password (this issue),
 * Administrator create/initial-password (#41), and the migration/seed derivation path.
 */

import bcrypt from "bcrypt";
import { getPrisma } from "./prisma.js";

const SPECIAL_CHARS = `!@#$%^&*()-_=+[]{};:,.?/\\`;

/** Validates a password against the frozen policy. Returns null if valid, else an error message. */
export function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== "string") {
    return "Password must be a string.";
  }
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one digit.";
  }
  if (!password.split("").some((c) => SPECIAL_CHARS.includes(c))) {
    return "Password must contain at least one special character.";
  }
  return null;
}

/** Hashes a password with bcrypt (never plaintext). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Verifies a plaintext password against a bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Verifies credentials. Returns the User on success, or null on failure.
 * Invalid credentials and inactive accounts are indistinguishable (AC-05 / BR-08):
 * the caller returns the same safe generic 401 either way.
 */
export async function verifyCredentials(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = await getPrisma().user.findUnique({ where: { email: normalized } });
  if (!user) {
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return null;
  }
  return user;
}

/**
 * Changes the user's password. Requires the correct currentPassword.
 * On success sets mustChangePassword = false.
 * Throws a typed error for the wrong-current-password case (generic message).
 */
export class IncorrectCurrentPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
    this.name = "IncorrectCurrentPasswordError";
  }
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new IncorrectCurrentPasswordError();
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new IncorrectCurrentPasswordError();
  }
  const newHash = await hashPassword(newPassword);
  await getPrisma().user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });
}