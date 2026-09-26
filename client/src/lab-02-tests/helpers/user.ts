/**
 * Shared client test fixture (Issue #37 — RR-04 class (a)).
 *
 * Lab 2 client tests rendered `<App />` and drove the Development Requester
 * selector to establish identity. Lab 3 §8.2 removes the selector: `App` now
 * receives the authenticated user from `AuthGate`, which obtains it from the
 * session.
 *
 * These suites exercise UI behavior with an injected identity; they never
 * exercised the login/session path itself. The real authentication boundary is
 * covered by the Lab 3 client suites (`AuthGate.test.tsx`, `Login.test.tsx`) and
 * by the server-side frozen authorization/requester API tests.
 *
 * Every functional assertion in the converted suites is unchanged — only the
 * identity fixture differs.
 */

import type { AuthUser } from "../../api-client";

/** The authenticated Requester used by the converted Lab 2 client suites. */
export const TEST_USER: AuthUser = {
  id: 1,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

/** An authenticated IT Staff user, for role-gate assertions. */
export const TEST_STAFF_USER: AuthUser = {
  id: 2,
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};