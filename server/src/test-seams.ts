/**
 * Test seams for integration tests.
 *
 * This module provides mutable state that can be set by integration tests
 * and read by production code. It allows deterministic fault injection
 * without mocking Prisma or other internals.
 *
 * IMPORTANT: This module is NEVER imported in production request paths.
 * It is only used by integration tests and the testability hooks in service.ts.
 */

export const testSeams = {
  /**
   * When set to a non-null Error, createAttachmentMetadata will throw
   * that error instead of writing to the database.
   */
  forceCreateAttachmentMetadataError: null as Error | null,

  /**
   * When set to a non-null Error, the upload transaction will throw that
   * error AFTER the attachment metadata row has been created but BEFORE the
   * transaction commits. This deterministically exercises the transaction-wide
   * filesystem compensation boundary (BR-31): the physical file must be deleted
   * even though the metadata insert succeeded.
   */
  forcePostInsertTransactionError: null as Error | null,

  /**
   * Issue #37 — Lab 2 regression auth fixture.
   *
   * When set, `requireAuth` resolves the authenticated identity from this value
   * instead of the session + DB read. This replaces the removed
   * `X-Dev-Requester-Id` header injection used by the Lab 2 suites: those tests
   * exercise routing/validation/business logic with an injected identity and never
   * exercised the session/login path itself.
   *
   * The real authentication boundary (login → session cookie → fresh-User
   * authority) is covered by #35's auth suite and by #37's frozen
   * `authorization.api.test.ts` / `requester.api.test.ts`, which use real logins.
   *
   * NEVER set in production: this module is only imported by tests and the
   * testability hooks in service.ts.
   */
  sessionIdentity: null as {
    userId: number;
    role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
    mustChangePassword: boolean;
    name: string;
    email: string;
  } | null,

  /**
   * Issue #41 — deterministic last-active-Administrator interleaving hook.
   *
   * When set, `updateUser`'s Serializable last-admin guard awaits this hook AFTER
   * reading the active-Administrator count and BEFORE writing. A test can use it to
   * force two concurrent demotions to both read the pre-write count, which is the
   * exact interleaving the Serializable isolation level must reject.
   *
   * Without this hook the two requests usually serialize naturally and the race
   * window is never exercised, so the concurrency test would pass even if the guard
   * were weakened. Honored ONLY when `NODE_ENV === "test"`.
   */
  beforeLastAdminWrite: null as (() => Promise<void>) | null,

  /**
   * Issue #41 review — change the target state on an independent connection after
   * a role/activation edit reads it. This deterministically tests that the
   * invariant decision and write use the same Serializable snapshot. Test mode only.
   */
  afterAdminTargetRead: null as
    | ((context: { userId: number; role?: string; isActive?: boolean }) => Promise<void>)
    | null,
};
