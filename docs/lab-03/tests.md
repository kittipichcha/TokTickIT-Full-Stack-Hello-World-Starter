# Lab 3 Test Plan and Results - TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Purpose
This document is the Lab 3 testing contract for:
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`

## 2. Current Tooling and Paths
Backend (configured now):
- Runner: Vitest
- Existing folder: `server/tests/`
- Planned Lab 3 folder: `server/tests/lab-03/`

Frontend (configured now):
- Runner: Vitest + React Testing Library
- Existing folder: `client/src/`
- Planned Lab 3 folder: `client/src/lab-03-tests/`

E2E/Responsive/Keyboard (planned):
- Runner: Playwright
- Planned folder: `e2e/lab-03/`

## 2a. Execution Evidence
Issue #35 (Identity, Database Migration & Authentication) implemented the identity/auth
foundation and executed its frozen test rows. Statuses are evidence-driven. The rows
updated to `Passed` by #35 are: DB-MIG-01..10, SEC-MIG-01, SEED-01, API-AUTH-01..12,
API-AUTH-05b, SEC-AUTHZ-06, SEC-AUTHZ-11, SEC-AUTHZ-12, UNIT-AUTH-01, UNIT-API-ERROR-01..03,
CSRF-ME-01, TKT-PRIO-01..03, UI-LOGIN-01,
UI-CHPWD-01/02, UI-AUTHGATE-01/02/03. Rows owned by other issues remain `Planned`.

Every `Passed` row above is backed by an executed run recorded in
`artifacts/lab-03/issue-35/` (see that bundle's `README.md`). No row is marked `Passed`
on the strength of the plan, a test name, or an unexecuted file.

**Ownership note (frozen rows owned by other issues):** `E2E-01..04` are frozen Test-DD rows
owned by **#42** (`e2e/lab-03/authentication.spec.ts`, `staff-ticket-flow.spec.ts`,
`user-administration.spec.ts`, `requester-regression.spec.ts`; Locked Decision "CREATE IF
MISSING; otherwise verify/update/re-run — #42 is the expected initial creator of all four").
No feature issue creates an E2E spec by design. #35 references `E2E-01` as *basis* only
(plan AU-14) and claims neither `E2E-01` nor full-DoD completeness. `SEC-AUTHZ-07` remains
owned by **#37** (`authorization.api.test.ts`); #35 contributes only supplementary CSRF
assertions inside `auth.api.test.ts`.

### Results Log (newest first)

- **2026-09-19 — Issue #35 PR #46 review follow-up, round 6 (credential rotation, attachment ownership, IT Priority, async errors, hardening)**
  - **Credential rotated and history rewritten (infra action completed).** The password exposed
    in round 5 was rotated at the source, and repository history was rewritten with
    `git filter-repo` so the value is absent from every commit. The evidence bundle was
    regenerated at the new head. No value is recorded here.
  - **P2 — `itPriority` was left NULL on ticket creation (real defect, frozen §9.3).**
    `service.ts::createTicket` never set `itPriority`, so a requester-created ticket violated
    the frozen contract ("Initially copies Requested Priority"). It is now initialized from the
    **validated** `requestedPriority`; a client-supplied `itPriority` is never read. New
    `TKT-PRIO-01/02/03` cover each priority, the spoofed-body case, and the unchanged Lab 2
    response shape. The Lab 2 tests that asserted the old NULL behavior were updated.
  - **P1-2 — attachment ownership was not verified before Phase C (real defect).**
    `verifyBackfillIdentity()` only checked that `uploaderUserId` resolved to a User; it did not
    verify that the shadow columns **mirror** the legacy requester columns. Phase C drops those
    legacy columns, so a divergence would silently destroy the true ownership/removal
    attribution. Added `verifyAttachmentOwnership()`, called on the resume path and immediately
    before Phase C, using `IS DISTINCT FROM` (a plain `<>` returns NULL when the remover is NULL
    and would silently pass) plus a check that a non-null `removedByUserId` resolves to a User.
    New `DB-MIG-08/09/10` cover the uploader divergence, the NULL-remover case, and the correct
    resume.
  - **Unhandled async errors in the auth handlers (real defect).** `login`, `logout`, and the
    rethrow in `changePasswordHandler` had no `try/catch`; Express 4 does not catch rejected
    promises, so a transient DB error could leave the client without a response and terminate
    the process. All three now fail closed with the canonical `500 INTERNAL_ERROR`, and a final
    JSON error middleware was added to `app.ts` as defense in depth. New `API-AUTH-10/11/12`
    force the DB/session call to reject and assert the canonical 500 with the server still up.
  - **Non-blocking hardening.** (a) The 51-character `.env.example` `SESSION_SECRET` placeholder
    passed the `>= 32` length check; known placeholders are now rejected explicitly
    (`SEC-AUTHZ-11`). (b) `verifyCredentials` returned immediately for an unknown email, leaking
    account existence through timing; a dummy bcrypt comparison now equalizes the cost
    (`SEC-AUTHZ-12`).
  - Commands: `npx vitest run` (server); `npx vitest run tests/lab-03/migration.integration.test.ts`;
    `npx vitest run tests/lab-03/seed.integration.test.ts`; `npx prisma validate`;
    `npx prisma migrate status`; `npm run build` (server, client); `npx vitest run` (client).
  - Results: server **403 passed / 34 files**; client **120 passed / 12 files**; DB-MIG-01..10,
    SEC-MIG-01, TKT-PRIO-01..03, API-AUTH-10..12, SEC-AUTHZ-11/12 executed (not skipped). The
    DB-MIG-08/09 mutation check (guard removed) confirmed both tests fail without the guard.
  - Follow-up: none. `E2E-01..04` remain `Planned` (owned by #42); Requester/Staff/Admin feature
    rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-19 — Issue #35 PR #46 review follow-up, round 5 (credential leak, resume mapping, session error)**
  - **B-1 credential-bearing DB URL leaked into committed evidence (real defect, security).**
    `applyTrackedMigrationOutOfBand()` built `psql "postgresql://user:pass@host/db" …` as a
    single shell string and passed it to `execSync`. On failure, Node embeds the exact command
    in the thrown error, which was captured verbatim into `artifacts/lab-03/issue-35/`
    (`db-mig-execution.txt`, `server-vitest.txt`) — exposing a real password. Fixed at the
    source: the URL is parsed, the password is stripped from the connection string that becomes
    part of the command, and the password is passed via `PGPASSWORD` in the child environment.
    `run()` now accepts an env override and wraps failures in `sanitizeExecError()`, which
    regex-strips any `scheme://user:password@` fragment from `message`/`stderr`/`cmd` before
    rethrowing (defense in depth against psql/Prisma error strings). The two committed logs were
    scrubbed to `postgresql://kitti:***@…`. New `SEC-MIG-01` forces a real psql failure through
    the production path and asserts the captured output contains no credential fragment and not
    the password value. **Infra action required (not a code diff):** the exposed password must be
    treated as compromised and rotated, and repository history rewritten (`git filter-repo`/BFG)
    because a new commit does not remove it from earlier commits/PR diffs.
  - **B-2 resume identity check was narrower than the frozen mapping (real defect).**
    `verifyBackfillIdentity()` checked only `id`, `role='REQUESTER'`, and normalized `email`,
    so a resume could accept a `User` row whose `name`, `isActive`, `mustChangePassword`, or
    initial password diverged from the frozen §9.2/§9.3 mapping. It now also asserts trimmed
    `name`, `isActive`, `mustChangePassword = true`, and a bcrypt-verifiable deterministic
    initial password, and verifies the Attachment `uploaderUserId` shadow-column backfill is
    intact. New `DB-MIG-07` builds a fixture whose `id`/`email`/`role` match a legacy row exactly
    while `name`/`isActive`/password diverge, and asserts the abort. `DB-MIG-06` is retained
    (narrower but still valid) with its assertion updated to the new message.
  - **B-3 mount-time `fetchMe()` failure always rendered Login (real defect).** Any failure of
    the mount-time session check — including a network error or 5xx — was treated as
    "unauthenticated", silently presenting a login screen to a user whose session may be valid.
    `AuthGate` now distinguishes a `401` (→ Login) from any other failure (→ a distinct
    `session-error` screen with an explicit Retry button; no auto-retry, mirroring logout). New
    `UI-AUTHGATE-03` covers 401 → Login, 500 → session-error, no-status network failure →
    session-error, and Retry-after-500 → authenticated.
  - **Out of scope (filed separately):** `itPriority` stays null on Ticket creation in
    `service.ts::createTicket` violates the frozen §9.3 contract, but it is pre-existing Lab 2
    code this PR never touches; fixing it here would be scope creep on an Identity/Auth/Migration
    PR. Recommended as a new issue against the ticket-creation owner.
  - Commands: `npx vitest run tests/lab-03/migration.integration.test.ts` (server, against a
    Lab-3-migrated PostgreSQL database); `npx vitest run src/lab-03-tests/AuthGate.test.tsx`
    (client); `git grep -n "postgresql://.*:.*@"` (repo-wide credential sweep).
  - Results: server **387 passed / 30 files**; client **120 passed / 12 files**; repo-wide
    credential sweep returns no tracked match; DB-MIG-01..07 and SEC-MIG-01 executed (not
    skipped).
  - Follow-up: rotate the exposed credential and rewrite repository history (infra action).
    `E2E-01..04` remain `Planned` (owned by #42); Requester/Staff/Admin feature rows remain
    `Planned` (owned by #37/#38/#41).

- **2026-09-18 — Issue #35 PR #46 review follow-up, round 4 (three re-audit blockers)**
  - **F-1 migration resume identity verification (real defect).** `stage1Preflight()` returned
    `"backfill-complete"` on row-count equality alone, so a database whose `User` rows did not
    correspond to the legacy `DevRequester` rows (different id/email/role) would resume at
    Phase C and drop `DevRequester` with the wrong identity mapping. Added
    `verifyBackfillIdentity(legacy)`, which asserts, for every legacy row, a `User` with the
    **same `id`**, `role = 'REQUESTER'`, and `normalizeEmail(devRequester.email) === user.email`,
    and throws `MigrationStopAndReportError` naming the mismatched id(s) otherwise. The
    `actualUsers === 0 → "phase-a-applied"` branch is unchanged. New test
    `DB-MIG-06` builds a fixture with 1 legacy requester and 1 unrelated `User` (counts equal,
    identity mismatched) and asserts the abort, that Phase C is not applied, and that
    `DevRequester` still exists.
  - **F-2 `/api/auth/me` CSRF reissue (real defect, normal-usage path).** `AuthGate` calls
    `fetchMe()` on every mount, so any page reload produced an authenticated session with no
    client-side CSRF token and every subsequent mutation failed `403`. `me()` now calls
    `issueCsrfToken(req, res)`, which re-sends the session's **existing** token (it does not
    regenerate one). New `API-AUTH-05b` asserts the `/me` header equals the login-issued token;
    new `CSRF-ME-01` simulates a new tab (cleared `sessionStorage`), captures the token from
    `fetchMe()`, and proves `changePassword()` then sends it and succeeds.
  - **F-3 logout false success (real defect).** `handleLogout()` used `finally`, so a failed
    `logout()` still cleared the user and moved the gate to Login — presenting failure as
    success while the server session remained live. The `finally` was replaced with a success
    path plus a `catch` that preserves the authenticated shell and renders an inline
    `role="alert"` error near the Logout button (no auto-retry). New `UI-AUTHGATE-01/02` cover
    the failure and success paths.
  - **Informational (not blocking, no change made):** `seed.ts`'s `ensureUser()` does an
    exact-string email lookup with no `.toLowerCase()` normalization while the migration
    backfill normalizes. Harmless today (all seed emails are hardcoded lowercase literals) and
    duplicate-email enforcement is Administrator-management scope owned by #41; noted for that
    issue rather than changed here.
  - Commands: `npx vitest run` (server, against a Lab-3-migrated PostgreSQL database);
    `npx vitest run` (client); `npm run build` (server, client); `npx prisma validate`;
    `npx prisma migrate status`; `npx vitest run tests/lab-03/migration.integration.test.ts`;
    `npx vitest run tests/lab-03/seed.integration.test.ts`;
    `npx vitest run src/lab-03-tests/ApiClient.test.ts`.
  - Results: server **385 passed / 30 files**; client **116 passed / 12 files**; server and
    client builds succeed; Prisma schema valid; migration status clean; DB-MIG-01..06 executed
    (not skipped).
  - Follow-up: none. `E2E-01..04` remain `Planned` (owned by #42); Requester/Staff/Admin
    feature rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-18 — Issue #35 evidence provenance clarification (documentation only)**
  - **Evidence/head-SHA synchronization clarified.** `artifacts/lab-03/issue-35/head-sha.txt`
    previously named `bbc1c14`, which is the *docs commit that wrote the bundle*, not the
    *implementation commit the bundle validates*. The file now states both explicitly:
    `implementation-sha: 6f4fe22a16c4a752353092672cfd1c0a249cc3e8` and
    `evidence-captured-at: bbc1c14cffa7816a086c7b7c82fc425bcc4407f4`.
  - **Why no re-run is required:** `git diff --name-only 6f4fe22 da1c7c0` returns only
    `artifacts/` and `docs/` paths — no `server/`, `client/`, or `e2e/` file changed after
    `6f4fe22`. The executed runs therefore still describe the current implementation exactly.
    The bundle README now documents this re-run policy: evidence is regenerated only when the
    implementation SHA changes.
  - **Stale counts corrected:** `lab2-test-changes.md` (368 → **383**) and
    `artifacts/lab-03/migration/integration-gate.md` (367/107 marked superseded by
    **383/113**) now agree with `server-vitest.txt` and `client-vitest.txt`.
  - Commands: none executed (documentation-only change; no code under test changed).
  - Results: unchanged and still valid — server **383 passed / 30 files**; client
    **113 passed / 11 files**; server and client builds succeed; Prisma schema valid;
    migration status clean.
  - Follow-up: none. `E2E-01..04` remain `Planned` (owned by #42); Requester/Staff/Admin
    feature rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-18 — Issue #35 verification remediation (PR #46 review follow-up, round 3)**
  - **B-1 migration atomicity/recovery fixed:** every tracked migration is now applied with
    `psql --single-transaction -v ON_ERROR_STOP=1`, so a late Phase C failure rolls back ALL
    Phase C DDL and the migration is never recorded as applied. Post-backfill verification now
    runs INSIDE the backfill transaction, and all legacy invariants determinable before the
    irreversible boundary are validated pre-backfill. `stage1Preflight()` now recognizes the
    documented resumable state (Phase A applied / backfill complete / Phase C unapplied) and
    resumes at Phase C, correctly skipping the pre-backfill collision scan on that path.
    `MIG-FAIL-01/02/03` exercise the real orchestrator with a deterministic test-only failure
    hook; `_prisma_migrations` is never hand-edited.
  - **B-2 Lab 2 preservation proven:** `DB-MIG-PRESERVE-01/02` build a populated Lab 2 fixture,
    snapshot it completely, run the real orchestrator, and compare every Requester, Ticket, and
    Attachment field-by-field (exact ID sets, `User.id === DevRequester.id`, and the
    `uploaderRequesterId → uploaderUserId` / `removedByRequesterId → removedByUserId` renames).
    The timestamp assertion now compares the exact expected `timestamptz` column set.
  - **B-3 canonical API errors fixed:** `parseApiError()` is now `async` and awaits
    `response.json()`; all four callers await it. `UNIT-API-ERROR-01/02/03` prove the canonical
    error is available without a microtask flush or retry, and that malformed/empty/500 bodies
    fall back safely.
  - **B-4 canonical ticket allocator fixed (real defect):** the seed's private `TicketSequence`
    logic was removed in favour of `allocateTicketNumberWithClient()`. The old seed produced
    four-digit numbers (`TKT-2026-0334`); the new seed produces canonical six-digit numbers
    (`TKT-2026-000377`). `SEED-TKT-01..04` assert format, uniqueness, rerun stability, and
    allocator continuity.
  - **B-5 safe idempotent seed fixed:** `upsertUser()` → `ensureUser()` (create-if-missing), so
    legitimate administrator changes survive a rerun. Seed Tickets carry a deterministic
    seed-owned marker (`[seed:<key>]`) instead of the unsafe `summary + requesterId` heuristic,
    and seed Comments/Notes are matched by exact content on a seed-owned Ticket.
    `SEED-IDEMP-01/02`, `SEED-COLLISION-01`, `SEED-COMMENT-01`, `SEED-NOTE-01` prove
    non-destructive reruns and that a resembling non-seed Ticket is never claimed or mutated.
  - **Additional defect found and fixed:** the client `tsc` build emitted compiled `.js` files
    next to the `.ts` sources in `client/src/`, and Vite resolved the stale `.js` before the
    `.ts`, silently shadowing the `parseApiError` fix during tests. The stale artifacts were
    removed and `client/tsconfig.json` now sets `noEmit: true`.
  - Commands: `npx vitest run tests/lab-03/migration.integration.test.ts`;
    `npx vitest run tests/lab-03/seed.integration.test.ts`; `npx vitest run` (server, client);
    `npm run build` (server, client); `npx prisma validate`; `npx prisma migrate status`.
  - Results: server **383 passed / 30 files**; client **113 passed / 11 files**; server and
    client builds succeed; Prisma schema valid; migration status clean.
  - Follow-up: none. `E2E-01..04` remain `Planned` (owned by #42); Requester/Staff/Admin feature
    rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-17 — Issue #35 verification remediation (PR #46 review follow-up, round 2)**
  - **Lab 2 regression fixed (real defect):** the expanded seed selected seed-ticket
    reference data via `prisma.category.findMany()` / `prisma.relatedSystem.findMany()` over
    **all** rows, so it could attach a seeded Ticket to a pre-existing unrelated Category
    (e.g. one planted by `tests/lab-02/seed.integration.test.ts`). The resulting FK
    (`ON DELETE RESTRICT`) then blocked that suite's `afterAll` cleanup failure
    (`23001`/`Ticket_categoryId_fkey`) — a genuine Lab 2 regression, recorded and fixed by
    scoping the seed's reference lookups to its own declared categories/systems
    (`server/prisma/seed.ts`).
  - **Session-fixation supplementary test added:** `API-AUTH-09 (supplementary)` proves
    `req.session.regenerate()` issues a new session identifier at login and that the
    pre-login identifier is no longer authenticated (`server/tests/lab-03/auth.api.test.ts`).
  - **Evidence bundle published:** `artifacts/lab-03/issue-35/` — server/client vitest output
    at the implementation SHA, server/client builds, `prisma validate`, `migrate status`, DB-MIG
    execution proof (not skipped), the grep gate, `git diff --check`, conflict-marker grep,
    the `.env`-not-tracked proof, the frozen-doc compliance map, and the Lab 2 test-change
    mapping.
  - Commands: `npx vitest run` (server, against a Lab-3-migrated PostgreSQL database);
    `npm run build` (server, client); `npx vitest run` (client); `npx prisma validate`;
    `npx prisma migrate status`; `npx vitest run tests/lab-03/migration.integration.test.ts`.
  - Results: server **368 passed / 30 files**; client **107 passed / 10 files**; server and
    client builds succeed; Prisma schema valid; migration status clean; DB-MIG-01..05
    executed (not skipped).
  - Follow-up: none. `E2E-01..04` remain `Planned` (owned by #42, see ownership note above);
    Requester/Staff/Admin feature rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-17 — Issue #35 verification remediation (PR #46 review follow-up)**
  - Strengthened the four evidence gaps identified in review: `API-AUTH-06` now exercises a
    real normal-application protected endpoint (`GET /api/app/context`, wired
    `requireAuth → requirePasswordChanged`) and asserts `401 PASSWORD_CHANGE_REQUIRED` before
    the change and success after the change on the same session; `SEC-AUTHZ-06` now
    deterministically expires a real server-side session record and asserts
    `401 UNAUTHENTICATED` (configuration assertions retained as supplementary);
    `DB-MIG-04` now executes the full migrated-user lifecycle (login → blocked → change →
    same-session access, with hash-change assertions); `DB-MIG-05` now runs the real
    migration orchestrator against an isolated Lab 2 fixture with a deliberate normalized-email
    collision and asserts the abort invariant (no `User` backfill, Phase A applied / Phase C
    unapplied, legacy data unchanged) plus recovery/resume to a clean migration.
  - Commands: `npx vitest run` (server, against a Lab-3-migrated PostgreSQL database);
    `npm run build` (server, client); `npm test` (client); `npx prisma validate`;
    `npx prisma migrate status`.
  - Results: server **367 passed / 30 files**; client **107 passed / 10 files**; server and
    client builds succeed; Prisma schema valid; migration status clean.
  - Follow-up: none. Requester/Staff/Admin feature rows remain `Planned` (owned by #37/#38/#41).

- **2026-09-17 — Issue #35 (Identity, Database Migration & Authentication)**
  - Tests added: `server/tests/lab-03/auth.unit.test.ts`, `server/tests/lab-03/auth.api.test.ts`,
    `server/tests/lab-03/migration.integration.test.ts`, `server/tests/lab-03/seed.integration.test.ts`,
    `client/src/lab-03-tests/Login.test.tsx`, `client/src/lab-03-tests/ChangePassword.test.tsx`.
  - Commands: `npm run build` (server, client); `npx vitest run` (server, client) against a
    Lab-3-migrated PostgreSQL database.
  - Results: server 366 passed / 30 files (Lab 2 regression green + lab-03); client 107 passed /
    10 files. Auth endpoint smoke (login/me/change-password/logout, CSRF 403, wrong-current 400)
    verified via curl. Scratch-DB proof recorded at
    `artifacts/lab-03/migration/scratch-db-proof.md`.
  - Follow-up: none. Requester/Staff/Admin feature rows remain `Planned` (owned by #37/#38/#41).

No execution evidence yet prior to #35. Issue #34 (Sprint 3 engineering contract / Spec DD)
produced no implementation code.

## 3. Test Status Terminology
`Final` describes evidence status, not the expected behavior: `Planned` means the test row is
specified but its automated test is not implemented; `Implemented` means the test exists but has
not yet passed in the current evidence log; `Passed` means the test exists and passed; `Failed`
means the latest run failed; and `Blocked` means it cannot run because its documented
prerequisite is unavailable. A row must not be marked `Passed` based on this plan alone.

## 4. Coverage Completeness Gate
Every Acceptance Criterion (AC-01 through AC-26) maps to at least one planned test below. The
matrix covers unit, API/integration, UI component, UI style, responsive, accessibility,
security/authorization, migration/regression, and end-to-end coverage.

## 5. Test Traceability Matrix (Planned Contract)

| Test ID | Type | What It Tests | Expected Result | Automated Test File | FR | BR | Requirement / AC | Final |
|---|---|---|---|---|---|---|---|---|
| API-AUTH-01 | API | Valid login | Authenticated response; safe user data | `server/tests/lab-03/auth.api.test.ts` | FR-01, FR-02 | BR-01 | AC-01 | Passed |
| API-AUTH-02 | API | Invalid login | Safe generic error; no account-status leak | `server/tests/lab-03/auth.api.test.ts` | FR-01 | BR-07, BR-08 | AC-05 | Passed |
| API-AUTH-03 | API | Inactive account login | Authentication fails; safe error | `server/tests/lab-03/auth.api.test.ts` | FR-06 | BR-08 | AC-05 | Passed |
| API-AUTH-04 | API | Logout | Session invalidated; protected endpoints blocked | `server/tests/lab-03/auth.api.test.ts` | FR-03 | BR-09 | AC-06 | Passed |
| API-AUTH-05 | API | Current user | Returns authenticated identity and role | `server/tests/lab-03/auth.api.test.ts` | FR-04 | — | AC-01 | Passed |
| API-AUTH-05b | API | `/me` reissues the session CSRF token | `GET /api/auth/me` returns `X-CSRF-Token` equal to the token issued at login (re-sent, not regenerated), so a page reload can perform authenticated mutations | `server/tests/lab-03/auth.api.test.ts` | FR-04 | BR-31 | AC-06 | Passed |
| API-AUTH-06 | API | Mandatory password change | Normal protected endpoint (`GET /api/app/context`) returns `401 PASSWORD_CHANGE_REQUIRED` before the password change, then succeeds after a valid password change using the same session | `server/tests/lab-03/auth.api.test.ts` | FR-05 | BR-02 | AC-02 | Passed |
| API-AUTH-07 | API | Password policy boundaries | Invalid new password rejected per the frozen policy (Section 13, decision 12): below 12 chars rejected; 12 valid chars accepted; 128 valid chars accepted; above 128 chars rejected; missing uppercase rejected; missing lowercase rejected; missing digit rejected; missing special char rejected; valid composition accepted | `server/tests/lab-03/auth.api.test.ts` | FR-05 | BR-10 | AC-02 | Passed |
| API-AUTH-08 | API | Change password with wrong currentPassword | `400 VALIDATION_ERROR` with a generic message ("current password is incorrect"); no hint about why it was wrong | `server/tests/lab-03/auth.api.test.ts` | FR-05 | BR-01, BR-07 | AC-02 | Passed |
| API-AUTH-09 | API | Second concurrent login for the same user | Both sessions remain valid; the first session is not invalidated (Section 13, decision 16) | `server/tests/lab-03/auth.api.test.ts` | FR-02 | BR-31 | AC-01 | Passed |
| API-AUTH-10 | API | Login DB failure containment | A DB failure during `login` returns the canonical `500 INTERNAL_ERROR` JSON body (not an unhandled rejection) and the server keeps serving subsequent requests | `server/tests/lab-03/auth-error-handling.api.test.ts` | FR-01 | BR-07 | AC-01 | Passed |
| API-AUTH-11 | API | Change-password DB failure containment | A DB failure during `change-password` returns the canonical `500 INTERNAL_ERROR` JSON body and the server keeps serving subsequent requests | `server/tests/lab-03/auth-error-handling.api.test.ts` | FR-05 | BR-07 | AC-02 | Passed |
| API-AUTH-12 | API | Logout session-store failure containment | A session-store failure during `logout` returns the canonical `500 INTERNAL_ERROR` JSON body instead of an unhandled rejection | `server/tests/lab-03/auth-error-handling.api.test.ts` | FR-03 | BR-07 | AC-06 | Passed |
| SEC-AUTHZ-11 | Unit | SESSION_SECRET placeholder rejection | The known `.env.example` placeholder (51 chars, passes the `>= 32` length check) is rejected at startup; missing/short secrets are rejected; a real unique secret is accepted; the deterministic test-only secret is allowed under `NODE_ENV=test` | `server/tests/lab-03/session-secret.unit.test.ts` | FR-01 | BR-06 | AC-01 | Passed |
| SEC-AUTHZ-12 | Unit | Account-existence timing equalization | `verifyCredentials` performs exactly one bcrypt comparison for an unknown email (dummy compare) and exactly one for a known email with a wrong password, so response timing does not leak account existence | `server/tests/lab-03/auth-timing.unit.test.ts` | FR-01 | BR-08 | AC-05 | Passed |
| TKT-PRIO-01 | API | IT Priority initialized on creation | For each requested priority (`LOW`/`MEDIUM`/`HIGH`), the persisted `Ticket.itPriority` equals the submitted `requestedPriority` (frozen §9.3) | `server/tests/lab-03/ticket-priority.integration.test.ts` | FR-10 | BR-16 | AC-25 | Passed |
| TKT-PRIO-02 | API | Client-supplied `itPriority` ignored | A request body containing a different `itPriority` is ignored; the stored value still equals the validated `requestedPriority` | `server/tests/lab-03/ticket-priority.integration.test.ts` | FR-10 | BR-16 | AC-25 | Passed |
| TKT-PRIO-03 | API | Create response shape unchanged | The Lab 2 create response envelope and key set are unchanged; `itPriority` now reflects the frozen initialization rule and `ticketOwnerId` remains null | `server/tests/lab-03/ticket-priority.integration.test.ts` | FR-10 | BR-16 | AC-25 | Passed |
| SEC-AUTHZ-01 | API | Requester supplies another requesterId | Authenticated identity applied; no other user's data | `server/tests/lab-03/authorization.api.test.ts` | FR-10 | BR-03, BR-12 | AC-03 | Planned |
| SEC-AUTHZ-02 | API | Requester requests Internal Notes | Forbidden; no note data returned | `server/tests/lab-03/comments-notes.api.test.ts` | FR-20 | BR-04, BR-32 | AC-04 | Planned |
| SEC-AUTHZ-03 | API | Non-Admin requests user management | Forbidden | `server/tests/lab-03/users-admin.api.test.ts` | FR-07, FR-09 | — | AC-20 | Planned |
| SEC-AUTHZ-04 | API | Unauthenticated protected endpoint | 401 UNAUTHENTICATED | `server/tests/lab-03/authorization.api.test.ts` | FR-07 | BR-31 | AC-06 | Planned |
| SEC-AUTHZ-05 | API | Cross-user Ticket/Attachment access | 404 NOT_FOUND; no existence leak | `server/tests/lab-03/authorization.api.test.ts` | FR-10 | BR-12, BR-32 | AC-03 | Planned |
| SEC-AUTHZ-06 | API | Session idle timeout expiration | An actually expired session is rejected by a protected endpoint with `401 UNAUTHENTICATED`; a valid session works before expiry; the 30-minute rolling configuration is asserted as supplementary evidence | `server/tests/lab-03/auth.api.test.ts` | FR-02 | BR-31 | AC-06 | Passed |
| SEC-AUTHZ-07 | API | CSRF on state-changing endpoint | Missing/invalid CSRF token rejected (403 FORBIDDEN); mutation not applied | `server/tests/lab-03/authorization.api.test.ts` | FR-07 | BR-31 | AC-06 | Planned |
| SEC-AUTHZ-08 | API | Requester posts/reads comments on a not-owned ticket | `404 NOT_FOUND`; no data leaked | `server/tests/lab-03/comments-notes.api.test.ts` | FR-12 | BR-12, BR-32 | AC-03 | Planned |
| SEC-AUTHZ-09 | API | Non-Administrator calls create-user / edit-user | `403 FORBIDDEN` | `server/tests/lab-03/users-admin.api.test.ts` | FR-24, FR-25 | — | AC-20 | Planned |
| SEC-AUTHZ-10 | API | IT Staff/Administrator attempts attachment upload or delete | `403 FORBIDDEN` (view-only; cannot mutate Attachments) | `server/tests/lab-03/authorization.api.test.ts` | FR-10 | BR-12 | AC-07 | Planned |
| API-REQ-01 | API | Requester creates Ticket | Ticket owned by authenticated identity | `server/tests/lab-03/requester.api.test.ts` | FR-10 | BR-11 | AC-07 | Planned |
| API-REQ-02 | API | Requester My Tickets | Only owned Tickets returned | `server/tests/lab-03/requester.api.test.ts` | FR-10 | BR-12 | AC-07 | Planned |
| API-REQ-03 | API | Requester posts Public Comment | Comment saved with author/timestamp | `server/tests/lab-03/comments-notes.api.test.ts` | FR-12 | BR-22, BR-23 | AC-08 | Planned |
| API-REQ-04 | API | Requester indicates appears resolved | Flag saved; status unchanged | `server/tests/lab-03/requester.api.test.ts` | FR-13 | BR-05, BR-19 | AC-09 | Planned |
| API-QUE-01 | API | IT Staff queue retrieval | Search/filter/sort/pagination works | `server/tests/lab-03/staff-queue.api.test.ts` | FR-14 | BR-17 | AC-10 | Planned |
| API-QUE-02 | API | Queue invalid query params | Safe defaults applied | `server/tests/lab-03/staff-queue.api.test.ts` | FR-14 | BR-31 | AC-10 | Planned |
| API-STAFF-01 | API | Claim/reassign ownership | Owner updated to active IT Staff/Admin | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-16 | BR-14 | AC-11 | Planned |
| API-STAFF-02 | API | Set IT Priority | IT Priority updated; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-17 | BR-15, BR-16 | AC-12 | Planned |
| API-STAFF-03 | API | Permitted status change | Status changes per matrix | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-18 | AC-13 | Planned |
| API-STAFF-04 | API | Forbidden status transition | 409 CONFLICT; no change | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-18, BR-20 | AC-13 | Planned |
| API-STAFF-05 | API | Create Internal Note | Note saved; visible only to IT Staff/Admin | `server/tests/lab-03/comments-notes.api.test.ts` | FR-20 | BR-04, BR-21, BR-24 | AC-14 | Planned |
| API-STAFF-06 | API | Set IT Priority on nonexistent/forbidden ticket | `403 FORBIDDEN` (not IT Staff/Admin) or `404 NOT_FOUND` (ticket not found) per BR-31 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-17 | BR-31 | AC-12 | Planned |
| API-STAFF-07 | API | Status change on nonexistent/forbidden ticket | `403 FORBIDDEN` (not IT Staff/Admin) or `404 NOT_FOUND` (ticket not found) per BR-31 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-31 | AC-13 | Planned |
| API-STAFF-08 | API | Status change on unowned ticket | `409 CONFLICT` — ticket must be claimed before a status change; no auto-claim (Section 13, decision 14) | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-18 | AC-13 | Planned |
| API-STAFF-09 | API | Two concurrent claims of the same ticket | Both succeed; final owner is deterministic per last-write-wins (Section 13, decision 15); no conflict error surfaced | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-16 | BR-14 | AC-11 | Planned |
| API-STAFF-10 | API | IT Staff/Administrator posts/reads notes on a nonexistent ticket | `404 NOT_FOUND` — ticket not found | `server/tests/lab-03/comments-notes.api.test.ts` | FR-20 | BR-31 | AC-14 | Planned |
| API-ADM-01 | API | User list | Name/Email/Role/Status returned | `server/tests/lab-03/users-admin.api.test.ts` | FR-21 | — | AC-15 | Planned |
| API-ADM-02 | API | User search/filter | Name/email search; optional role filter | `server/tests/lab-03/users-admin.api.test.ts` | FR-22, FR-23 | — | AC-15 | Planned |
| API-ADM-03 | API | Create user | User created; must change password next login | `server/tests/lab-03/users-admin.api.test.ts` | FR-24 | BR-25, BR-30 | AC-16 | Planned |
| API-ADM-04 | API | Duplicate email | 409 CONFLICT | `server/tests/lab-03/users-admin.api.test.ts` | FR-25 | BR-13 | AC-17 | Planned |
| API-ADM-05 | API | Edit user | Name/email/role/activation updated | `server/tests/lab-03/users-admin.api.test.ts` | FR-25 | BR-26 | AC-17 | Planned |
| API-ADM-06 | API | Self-deactivation | Rejected | `server/tests/lab-03/users-admin.api.test.ts` | — | BR-27 | AC-18 | Planned |
| API-ADM-07 | API | Last active Administrator | Rejected | `server/tests/lab-03/users-admin.api.test.ts` | — | BR-28, BR-29 | AC-19 | Planned |
| API-ADM-07b | API | Last active Administrator role change | Role change to non-Administrator rejected | `server/tests/lab-03/users-admin.api.test.ts` | — | BR-28 | AC-19 | Planned |
| API-ADM-08 | API | Set new initial password | User must change password next login | `server/tests/lab-03/users-admin.api.test.ts` | FR-26 | BR-30 | AC-16 | Planned |
| API-ADM-09 | API | Edit / set-initial-password on nonexistent userId | `404 NOT_FOUND` — user does not exist | `server/tests/lab-03/users-admin.api.test.ts` | FR-25, FR-26 | BR-31 | AC-17, AC-16 | Planned |
| API-ADM-10 | API | Non-last Administrator changes own role away from Administrator | Succeeds; rejected only if it is the last active Administrator (BR-28 path) | `server/tests/lab-03/users-admin.api.test.ts` | FR-25 | BR-34, BR-28 | AC-19 | Planned |
| UNIT-AUTH-01 | Unit | Password hashing | bcrypt hash; no plaintext | `server/tests/lab-03/auth.unit.test.ts` | FR-01 | BR-06 | AC-01 | Passed |
| UNIT-COMMENT-01 | Unit | Comment/Note validation | Trim; whitespace rejected; length limits | `server/tests/lab-03/comments-notes.unit.test.ts` | FR-12 | BR-21, BR-23, BR-24 | AC-08 | Planned |
| DB-MIG-01 | DB | DevRequester → User migration | Every legacy Requester becomes exactly one User with the same `id`, `name`, `email`, and `isActive`, role `REQUESTER`, and `mustChangePassword=true` | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-02 | DB | Existing data preserved | Categories/RelatedSystems/Tickets/Attachments valid; the exact frozen §9.3 timestamp set is `timestamptz(3)` | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-25 | Passed |
| DB-MIG-03 | DB | Migrated requester initial password | Migrated user's initial password equals the password produced by the frozen derivation (Section 13, decision 13: `Lab3-` + first 20 hex chars of SHA-256(lowercase(trim(email)) + ":" + trim(name))), authenticates successfully, and `mustChangePassword` is enforced; two independent fresh migrations produce the same derived password | `server/tests/lab-03/migration.integration.test.ts` | FR-05 | BR-02, BR-10 | AC-26 | Passed |
| DB-MIG-04 | DB | Migrated requester password change | Migrated user logs in with the deterministic initial password, is blocked from normal application access (`401 PASSWORD_CHANGE_REQUIRED`) while `mustChangePassword=true`, successfully changes the password, and can then access normal protected functionality using the same session; the stored hash changes and the old password no longer verifies | `server/tests/lab-03/migration.integration.test.ts` | FR-05 | BR-02, BR-10 | AC-26 | Passed |
| DB-MIG-05 | DB | Migration with a colliding email | The real migration orchestrator aborts with `MigrationCollisionError` before any `User` backfill, leaves Phase A applied / Phase C unapplied, preserves legacy data, and completes successfully after the collision source is resolved and the orchestrator is resumed | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-13 | AC-25 | Passed |
| DB-MIG-PRESERVE-01 | DB | Full Lab 2 Requester/Ticket preservation | Against a populated Lab 2 fixture, every legacy Requester becomes a User with the same `id`/`name`/`email`/`isActive`; the exact Ticket ID set is unchanged and every Ticket's `ticketNumber`, `requesterId`, `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, `ticketOwnerId`, and `currentStatus` are preserved (`itPriority` backfilled from `requestedPriority` where NULL) | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-PRESERVE-02 | DB | Full Lab 2 Attachment preservation | Against a populated Lab 2 fixture, the exact Attachment ID set is unchanged and every Attachment's `ticketId`, filenames, MIME type, size, `isRemoved`, `removalReason`, and `removedAt` are preserved; `uploaderRequesterId → uploaderUserId` and `removedByRequesterId → removedByUserId` are verified one-for-one | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-25 | Passed |
| MIG-FAIL-01 | DB | Late Phase C failure atomicity | A deliberately failing late Phase C statement (injected through the real `psql --single-transaction` mechanism) rolls back ALL Phase C DDL: Phase C is not recorded as applied, `DevRequester` and the legacy Attachment columns still exist, the Phase C-only index is absent, and legacy data is intact | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-25 | Passed |
| MIG-FAIL-02 | DB | Pre-backfill invariant failure recovery | A legacy `isRemoved` invariant violation is detected BEFORE the irreversible backfill, leaving the supported Phase-A-applied state (no `User` rows, `DevRequester` intact, Phase C unapplied); after repair the orchestrator resumes and completes | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-25 | Passed |
| MIG-FAIL-03 | DB | Recovery after a Phase C failure | After a late Phase C failure the database is in the documented resumable state (Phase A applied, backfill committed, Phase C unapplied); a subsequent valid run resumes at Phase C and completes with all Users/Tickets/Attachments present and `migrate status` clean | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-25 | Passed |
| DB-MIG-06 | DB | Resume identity verification | A resume with matching row counts but mismatched legacy-to-`User` identity (different id/email/role) is rejected with `MigrationStopAndReportError`; Phase C is not applied and `DevRequester` still exists | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-07 | DB | Resume full-mapping verification | A resume whose `User` row matches a legacy row on `id`/`email`/`role` but diverges on `name`, `isActive`, or the deterministic initial password is rejected with `MigrationStopAndReportError`; Phase C is not applied and `DevRequester` still exists | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-08 | DB | Attachment uploader ownership on resume | A backfill-complete fixture whose `Attachment.uploaderUserId` diverges from `uploaderRequesterId` aborts with `MigrationStopAndReportError` naming the attachment ID; Phase C is not recorded, the legacy columns and `DevRequester` still exist, and the attachment rows are unchanged | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-09 | DB | Attachment remover ownership on resume | A backfill-complete fixture whose `removedByUserId` is NULL while `removedByRequesterId` is set aborts with `MigrationStopAndReportError` (the `IS DISTINCT FROM` guard catches the NULL case a plain `<>` would miss); Phase C is not applied and `DevRequester` still exists | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| DB-MIG-10 | DB | Correct backfill-complete resume | A correct backfill-complete fixture (soft-removed attachment with remover, never-removed attachment with both remover columns NULL, and a different uploader) resumes and completes Phase C; ownership values survive the legacy-column drop and `migrate status` is clean | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-25 | Passed |
| SEC-MIG-01 | DB | Migration credential non-disclosure | A failing `psql` migration (real production path) produces captured stdout/stderr/error output containing no `scheme://user:password@` credential fragment and not the password value | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-06 | AC-25 | Passed |
| SEED-01 | DB | Seed idempotency | Safe to run repeatedly; two runs produce identical state with no duplicate seed records | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-TKT-01 | DB | Canonical ticket-number format | Every seed-owned Ticket number matches the canonical six-digit `TKT-YYYY-NNNNNN` contract | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-TKT-02 | DB | Ticket-number uniqueness | Seed-owned Ticket numbers are unique | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-TKT-03 | DB | Rerun does not renumber | A second seed run does not change any existing seed Ticket's number | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-TKT-04 | DB | Canonical allocator continuity | A Ticket created through the application allocator after seeding receives the next canonical sequence value, proving the seed uses the shared allocator rather than a parallel counter | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-IDEMP-01 | DB | Non-destructive rerun | Two seed runs produce no duplicate seed Tickets, Comments, Notes, or Users | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-IDEMP-02 | DB | Application state survives rerun | A legitimate administrator change to a seeded account (`role`, `isActive`, `passwordHash`, `mustChangePassword`) survives a subsequent seed run unchanged | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-COLLISION-01 | DB | Seed ownership safety | A non-seed Ticket that resembles a seed Ticket (same summary/requester, no seed marker) is never claimed, mutated, or given seed Comments/Notes | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-COMMENT-01 | DB | Comment idempotency | A second seed run does not duplicate seed Comments | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| SEED-NOTE-01 | DB | Internal Note idempotency | A second seed run does not duplicate seed Internal Notes | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-24 | Passed |
| UNIT-API-ERROR-01 | Unit | Canonical API error parsing | A canonical JSON error body yields an Error exposing `status`, `code`, `message`, and `fields` immediately after `await` (no microtask flush or retry), including through a real caller (`login`) | `client/src/lab-03-tests/ApiClient.test.ts` | FR-01 | BR-07 | AC-01 | Passed |
| UNIT-API-ERROR-02 | Unit | Malformed / non-JSON body | A non-JSON or empty error body preserves the fallback message and HTTP status and never throws | `client/src/lab-03-tests/ApiClient.test.ts` | FR-01 | BR-07 | AC-01 | Passed |
| UNIT-API-ERROR-03 | Unit | 500 response safety | A 500 with a canonical body exposes the canonical message/code; a 500 without one falls back to the safe generic message | `client/src/lab-03-tests/ApiClient.test.ts` | FR-01 | BR-07 | AC-01 | Passed |
| CSRF-ME-01 | Unit | CSRF capture on `fetchMe` and reuse | With no stored token (new tab / page reload), `fetchMe()` captures the `X-CSRF-Token` from `GET /api/auth/me` and a subsequent `changePassword()` sends it and succeeds (no `403`) | `client/src/lab-03-tests/ApiClient.test.ts` | FR-04 | BR-31 | AC-06 | Passed |
| UI-LOGIN-01 | UI | Login screen | Valid/invalid login; busy/safe failure; form data preserved | `client/src/lab-03-tests/Login.test.tsx` | FR-01 | BR-07, BR-33 | AC-01 | Passed |
| UI-CHPWD-01 | UI | Change Password screen | Mandatory change; validation; continuation | `client/src/lab-03-tests/ChangePassword.test.tsx` | FR-05 | BR-02 | AC-02 | Passed |
| UI-CHPWD-02 | UI | Confirm field does not match new password | Inline validation error; form not submitted; API never called | `client/src/lab-03-tests/ChangePassword.test.tsx` | FR-05 | BR-02 | AC-02 | Passed |
| UI-AUTHGATE-01 | UI | Logout failure preserves the authenticated shell | When `logout()` rejects, the authenticated shell (and `App`) stays mounted, state does not move to Login, and an inline `role="alert"` error is shown near the Logout button | `client/src/lab-03-tests/AuthGate.test.tsx` | FR-03 | BR-09, BR-33 | AC-06 | Passed |
| UI-AUTHGATE-02 | UI | Successful logout transitions to Login | When `logout()` resolves, the gate transitions to the Login screen, `App` unmounts, and no error alert is shown | `client/src/lab-03-tests/AuthGate.test.tsx` | FR-03 | BR-09 | AC-06 | Passed |
| UI-AUTHGATE-03 | UI | Mount-time session-check failure is distinct from unauthenticated | A `401` from `fetchMe()` renders Login; a `500` or status-less network failure renders a distinct session-error screen with a Retry button (neither Login nor the authenticated shell); clicking Retry after a `500` transitions to authenticated | `client/src/lab-03-tests/AuthGate.test.tsx` | FR-03 | BR-09, BR-33 | AC-06 | Passed |
| UI-QUE-01 | UI | Staff Ticket Queue | Search/filter/sort/pagination; empty/no-results | `client/src/lab-03-tests/StaffTicketQueue.test.tsx` | FR-14 | BR-17 | AC-10 | Planned |
| UI-QUE-02 | UI | Staff Queue zero-result search/filter | Empty-state message shown; no error | `client/src/lab-03-tests/StaffTicketQueue.test.tsx` | FR-14 | BR-31 | AC-10 | Planned |
| UI-STAFF-01 | UI | Staff Ticket Detail | Ownership/priority/status/comments/notes | `client/src/lab-03-tests/StaffTicketDetail.test.tsx` | FR-16–20 | BR-14–18 | AC-11–14 | Planned |
| UI-STAFF-02 | UI | Status change to Resolved/Closed/Cancelled | Confirm modal shown before request is sent; cancel aborts, confirm proceeds | `client/src/lab-03-tests/StaffTicketDetail.test.tsx` | FR-18 | BR-18 | AC-13 | Planned |
| UI-ADM-01 | UI | User Management | List/search/filter/create/edit/activate | `client/src/lab-03-tests/UserManagement.test.tsx` | FR-21–26 | BR-25–30 | AC-15–19 | Planned |
| UI-ADM-02 | UI | Admin user search zero results | Empty-state message shown; no error | `client/src/lab-03-tests/UserManagement.test.tsx` | FR-22 | BR-31 | AC-15 | Planned |
| UI-STYLE-01 | UI Style | Zen Green tokens | No ad-hoc colors | `client/src/lab-03-tests/UiStyles.test.tsx` | FR-08 | — | AC-21 | Planned |
| VISUAL-01 | Responsive | All major screens | Desktop/tablet/mobile screenshots | `e2e/lab-03/responsive-visual.spec.ts` | FR-08 | — | AC-22 | Planned |
| VISUAL-02 | Responsive | Staff Queue presentation | Desktop readable table (no horizontal overflow); tablet condensed; mobile cards; all required info accessible | `e2e/lab-03/responsive-visual.spec.ts` | FR-14 | — | AC-10, AC-22 | Planned |
| A11Y-01 | Accessibility | Keyboard/focus/aria | Keyboard-operable; focus visible | `e2e/lab-03/keyboard-access.spec.ts` | FR-08 | — | AC-23 | Planned |
| E2E-01 | E2E | Authentication flow | Login → change password → app → logout | `e2e/lab-03/authentication.spec.ts` | FR-01–06 | BR-01–10 | AC-01, AC-02, AC-05, AC-06 | Planned |
| E2E-02 | E2E | Staff ticket flow | Queue → detail → claim → priority → status → comments/notes | `e2e/lab-03/staff-ticket-flow.spec.ts` | FR-14–20 | BR-14–18 | AC-10–14 | Planned |
| E2E-03 | E2E | User administration | List → search → create → edit → initial password | `e2e/lab-03/user-administration.spec.ts` | FR-21–26 | BR-25–30 | AC-15–19 | Planned |
| E2E-04 | E2E | Requester regression | Create → My Tickets → detail → comments → appears resolved (removes Dev Requester selector) | `e2e/lab-03/requester-regression.spec.ts` | FR-10–13 | BR-05, BR-11, BR-19 | AC-07–09 | Planned |

## 6. Requirement → Test Mapping Summary
Every Acceptance Criterion maps to at least one planned test:
- AC-01 → API-AUTH-01, API-AUTH-05, API-AUTH-09, API-AUTH-10, SEC-AUTHZ-11, UNIT-AUTH-01, UI-LOGIN-01, E2E-01
- AC-02 → API-AUTH-06, API-AUTH-07, API-AUTH-08, API-AUTH-11, UI-CHPWD-01, UI-CHPWD-02, E2E-01
- AC-03 → SEC-AUTHZ-01, SEC-AUTHZ-05, SEC-AUTHZ-08
- AC-04 → SEC-AUTHZ-02
- AC-05 → API-AUTH-02, API-AUTH-03, SEC-AUTHZ-12, E2E-01
- AC-06 → API-AUTH-04, API-AUTH-05b, API-AUTH-12, CSRF-ME-01, SEC-AUTHZ-04, SEC-AUTHZ-06, SEC-AUTHZ-07, UI-AUTHGATE-01, UI-AUTHGATE-02, UI-AUTHGATE-03, E2E-01
- AC-07 → API-REQ-01, API-REQ-02, SEC-AUTHZ-10, E2E-04
- AC-08 → API-REQ-03, UNIT-COMMENT-01, E2E-04
- AC-09 → API-REQ-04, E2E-04
- AC-10 → API-QUE-01, API-QUE-02, UI-QUE-01, UI-QUE-02, VISUAL-02
- AC-11 → API-STAFF-01, API-STAFF-09, UI-STAFF-01, E2E-02
- AC-12 → API-STAFF-02, API-STAFF-06, UI-STAFF-01, E2E-02
- AC-13 → API-STAFF-03, API-STAFF-04, API-STAFF-07, API-STAFF-08, UI-STAFF-01, UI-STAFF-02, E2E-02
- AC-14 → API-STAFF-05, API-STAFF-10, UI-STAFF-01, E2E-02
- AC-15 → API-ADM-01, API-ADM-02, API-ADM-09, UI-ADM-01, UI-ADM-02, E2E-03
- AC-16 → API-ADM-03, API-ADM-08, API-ADM-09, UI-ADM-01, E2E-03
- AC-17 → API-ADM-04, API-ADM-05, API-ADM-09, UI-ADM-01, E2E-03
- AC-18 → API-ADM-06, UI-ADM-01
- AC-19 → API-ADM-07, API-ADM-07b, API-ADM-10, UI-ADM-01
- AC-20 → SEC-AUTHZ-03, SEC-AUTHZ-09
- AC-21 → UI-STYLE-01
- AC-22 → VISUAL-01, VISUAL-02
- AC-23 → A11Y-01
- AC-24 → SEED-01
- AC-25 → DB-MIG-01, DB-MIG-02, DB-MIG-05, DB-MIG-06, DB-MIG-07, DB-MIG-08, DB-MIG-09, DB-MIG-10, SEC-MIG-01, TKT-PRIO-01, TKT-PRIO-02, TKT-PRIO-03
- AC-26 → DB-MIG-03, DB-MIG-04, API-AUTH-06, API-AUTH-07