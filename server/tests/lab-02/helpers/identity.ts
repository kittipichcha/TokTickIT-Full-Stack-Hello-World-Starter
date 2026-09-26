/**
 * Shared Lab 2 regression fixture (Issue #37 — RR-04 class (a)).
 *
 * Lab 2 tests injected identity with the `X-Dev-Requester-Id` header. That mechanism
 * is removed by #37, so the fixture is replaced by an authenticated identity supplied
 * through the established `testSeams` pattern.
 *
 * These suites exercise routing/validation/business logic with an injected identity;
 * they never exercised the session/login path itself. The real authentication boundary
 * is covered by #35's auth suite and by #37's frozen `authorization.api.test.ts` /
 * `requester.api.test.ts`, which use real logins.
 *
 * Every functional assertion in the converted suites is unchanged — only the identity
 * fixture differs.
 */

import { testSeams } from "../../../src/test-seams.js";

/** Deterministic test-only session secret (frozen §13). */
export const TEST_SESSION_SECRET = "test-only-session-secret-not-for-production";

export type SeamRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

/**
 * Installs an injected authenticated identity for the duration of a suite.
 *
 * Call from `beforeEach`/`beforeAll`; call `clearSeamIdentity` from `afterEach`/`afterAll`.
 */
export function setSeamIdentity(options: {
  userId: number;
  role?: SeamRole;
  mustChangePassword?: boolean;
  name?: string;
  email?: string;
}): void {
  testSeams.sessionIdentity = {
    userId: options.userId,
    role: options.role ?? "REQUESTER",
    mustChangePassword: options.mustChangePassword ?? false,
    name: options.name ?? `Seam User ${options.userId}`,
    email: options.email ?? `seam-${options.userId}@example.com`,
  };
}

/** Clears the injected identity. */
export function clearSeamIdentity(): void {
  testSeams.sessionIdentity = null;
}