/**
 * Environment configuration for Issue #35 (Lab 3 — Identity, Database Migration & Authentication).
 *
 * SESSION_SECRET handling (frozen §13 / review Rev6 §4.5):
 * - Server-only secret; never committed.
 * - `.env.example` carries a placeholder only.
 * - Fail-safe startup: in non-test environments the server refuses to boot without a real secret.
 * - Tests inject a deterministic test-only secret (see test-seams.ts / auth tests).
 */

const isTestEnv = (): boolean => {
  const nodeEnv = process.env.NODE_ENV ?? "";
  return nodeEnv === "test";
};

/**
 * Known placeholder values that must never be accepted as a real secret.
 *
 * The `.env.example` placeholder is 51 characters, so it passes a naive `>= 32` length
 * check. Length alone is therefore not sufficient: a copied placeholder is a publicly
 * known value and provides no security. These are rejected explicitly.
 */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "change-me-to-a-long-random-secret-at-least-32-chars",
  "change-me",
  "changeme",
  "secret",
  "your-secret-here",
  "replace-me",
]);

/**
 * Returns the session signing secret, enforcing the fail-safe startup rule.
 * In non-test environments a missing/placeholder secret aborts startup.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  const trimmed = secret.trim();

  if (isTestEnv()) {
    // Tests inject a deterministic test-only secret; allow a fallback so the
    // test suite can run without a real secret in the environment.
    return trimmed.length > 0 ? trimmed : "test-only-session-secret-not-for-production";
  }

  if (trimmed.length < 32) {
    throw new Error(
      "SESSION_SECRET is not configured. Set a real secret (>= 32 chars) in server/.env " +
        "before starting the server. Refusing to boot with a weak or missing secret.",
    );
  }

  if (KNOWN_PLACEHOLDER_SECRETS.has(trimmed.toLowerCase())) {
    throw new Error(
      "SESSION_SECRET is set to a known placeholder value. Set a real, unique secret in " +
        "server/.env before starting the server. Refusing to boot with a placeholder secret.",
    );
  }

  return trimmed;
}

/** True when running under the test runner (used to relax fail-safe startup). */
export function isTestEnvironment(): boolean {
  return isTestEnv();
}