# Lab 3 — Peer Review Record

**Author:** <Kittipich Charoenthanachot> — <67070503405> — GitHub: @kittipichcha
**Peer reviewer:** <SUTHANG SUKRUEANGKUN> — <67070503477> — GitHub: @oangsa

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#44 — Add Sprint 3 engineering contract (Issue #34)](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/44) | `feature/issue-34-sprint-3-contract` | Changes Requested (2026-09-10) |
| [#46 — feat(lab-03): Issue #35 — Identity, Database Migration & Authentication](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/46) | `feature/issue-35-identity-db-migration-auth` → `lab3-staging` | Changes Requested (2026-09-17) — remediation in progress; **human review PENDING** |
| [#47 — feat(lab-03): Issue #37 — Authorization + Requester Migration / Regression](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/47) | `feature/issue-37-authorization-requester-migration` → `lab3-staging` | Agent review (2026-09-20) — 2 blocking + 6 non-blocking findings, all remediated; **human review PENDING** |
| [#48 — Issue #41 Administrator User Management](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48) | `feature/issue-41-admin-user-management` → `lab3-staging` | Local #38/#41 integration and automated verification complete (2026-09-24); **live target comparison and fresh human review PENDING** |

**Issue #41/#38 integration and PR #48 review fix (2026-09-24):** `origin/lab3-staging` at
`bde221f` was fetched and merged into `feature/issue-41-admin-user-management` at merge commit
`3337918`, so the PR branch contains the current base. Commit `49c9c1a` closes the remaining
last-active-Administrator TOCTOU hole by reading the target, deciding whether its requested
role/activation change reduces the active-Administrator count, checking that count, and
writing inside the same Serializable transaction. New regression `API-ADM-12` forces the
inactive→active race on an independent database connection; it was observed failing against
the pre-fix implementation and passes after the fix. The complete Admin API suite passes
39/39, the full server suite passes 578/578 with zero skipped, and the server build passes.
The Windows verification run used a local-only `tsx` temp-directory fallback for the
environment's `os.userInfo()` `ENOMEM`; details and raw output are in
`artifacts/lab-03/issue-41/README.md`. This entry records implementation and evidence only;
fresh human review is still pending and this is not peer approval.

**Issue #34**
Reviewer comment I received: **Request Changes** — 5 blocking issues before the contract could be considered frozen:
1. Existing Requester initial-password migration behavior was not explicit (no test proving a migrated Requester receives an initial password, can authenticate, and is forced to change it).
2. Concrete database design was not fully frozen (fields, types, FKs, indexes, enums, timestamps, migration strategy).
3. IT Staff Queue query behavior still contained placeholders (`search`/`sort` fields undefined) and conflicted with `tests.md` ("Safe defaults applied").
4. Session expiration was intentionally left undecided (deferred to repository/environment config).
5. Some AC-to-test mappings were not meaningful (e.g. `UI-STYLE-01`/`VISUAL-01`/`A11Y-01` mapped to `AC-20` authorization; `SEED-01` mapped to `AC-16`).

How I responded: Addressed all five blockers in successive commits on `feature/issue-34-sprint-3-contract`:
1. **Initial-password migration frozen** — added §9.2 "Initial-password migration mechanism (frozen)": each migrated Requester receives a deterministic per-user initial password derived from their own email and name, stored only as a bcrypt hash, with `mustChangePassword=true` forcing a change at first login. Added `DB-MIG-03`/`DB-MIG-04` and `AC-26` covering authenticate-with-initial-password and forced change.
2. **Concrete data model contract** — added §9.3 "Data model contract (frozen)" defining the normative `User`, `Comment`, `InternalNote`, Ticket ownership, IT Priority, FK behavior, uniqueness constraints, indexes, timestamps, and migration behavior for Issue #35 to translate into the Prisma schema.
3. **Staff Queue query semantics frozen** — defined the exact `search` fields, allowed filters, allowed sort fields, default ordering, valid page sizes, pagination metadata, and invalid-query behavior (safe defaults applied) in `api-spec.md`, and aligned `tests.md` with that decision.
4. **Session expiration frozen** — documented a **30-minute session idle timeout** as the Lab 3 contract value (specification.md §10 item 9), including what happens on expiration and activity refresh, with corresponding planned tests.
5. **AC-to-test traceability corrected** — added dedicated Acceptance Criteria `AC-21` (Zen Green), `AC-22` (responsive), `AC-23` (accessibility), `AC-24` (seed idempotency), `AC-25` (migration preservation), and `AC-26` (initial-password migration), and remapped each planned test to the AC it actually verifies (`UI-STYLE-01→AC-21`, `VISUAL-01/02→AC-22`, `A11Y-01→AC-23`, `SEED-01→AC-24`, `DB-MIG-01/02→AC-25`, `DB-MIG-03/04→AC-26`).

**Follow-up freeze-gate revision (2026-09-11):** A subsequent review identified two remaining
contract decisions that were still left to implementation rather than frozen in the contract:
1. **Password policy was not frozen** — `BR-10` referenced "documented password rules (length
   and composition)" without defining them, and `API-AUTH-07` could not be implementation-ready
   without an exact boundary.
2. **Migrated-Requester initial-password derivation was not frozen** — §9.2 said the derivation
   was "documented in the seed module," leaving the formula to the implementation agent.

Resolution: Both decisions were frozen in the engineering contract and propagated consistently:
- **Password policy (Option A):** 12–128 characters; at least one uppercase ASCII letter, one
  lowercase ASCII letter, one digit, and one ASCII special character; not trimmed before
  validation; whitespace permitted; no reuse/history rule. Frozen in `specification.md` (BR-10,
  §13 decision 12) and propagated to `api-spec.md` (change-password, admin create user, admin
  initial-password), `ui-spec.md` (Change Password screen), and `tests.md` (`API-AUTH-07`).
- **Migration derivation (Option A):** `Lab3-` + first 20 hex chars of
  SHA-256(lowercase(trim(email)) + ":" + trim(name)), encoded as lowercase hex. Frozen in
  `specification.md` (§9.2, §13 decision 13) and verified by `DB-MIG-03` in `tests.md`. The seed
  module now implements the frozen rule; it does not define it.

### Issue #35 — Identity, Database Migration & Authentication (PR #46)

**Reviewer comment I received (2026-09-17): Request Changes.** The reviewer disclosed that they
could not read any repository files, so their review was based on the PR description alone. They
raised: **B-1** missing `E2E-01`; **B-2** evidence bundle missing; **B-3** legacy
`removedByRequesterId` response key present; **B-4** DB-MIG skip risk; **B-5** `reviewer.md`
incomplete; **B-6** ground truth unreadable; plus minor session-regeneration and config items.

**How I responded — per finding:**

- **B-1 (E2E-01) — answered with plan authority, no code change.** `E2E-01` is a frozen Test-DD
  row whose Automated Test File is `e2e/lab-03/authentication.spec.ts`, owned by **#42** (Locked
  Decision: "CREATE IF MISSING … #42 is the expected initial creator of all four"). #35
  references `E2E-01` as *basis* only (plan AU-14). Taking the reviewer's own fallback path,
  `tests.md` now states `E2E-01..04` are **Planned, owner #42**, and this PR claims neither
  `E2E-01` nor full-DoD completeness. The reviewer's suggested filename `auth-flow.spec.ts` is
  **not** the frozen path and was deliberately not created; #35 creates no E2E spec.
- **B-2 (evidence bundle) — accepted and implemented.** Published
  `artifacts/lab-03/issue-35/` (server + client vitest at the implementation SHA, server + client builds,
  `prisma validate`, `migrate status`, DB-MIG execution proof, the grep gate, `git diff --check`,
  conflict-marker grep, `.env`-not-tracked proof, compliance map, Lab 2 test-change mapping).
- **B-3 (legacy `removedByRequesterId` key) — answered with the authorization trail; key
  retained.** This is an **authorized, declared, temporary deviation**, not an unauthorized one:
  user-approved **Option A** (friend plan-review §3) → #35 Rev 13 **Locked Decision DM-17**
  ("legacy response key names kept *only* where existing Lab 2 tests assert them", confined to a
  declared greppable set) → deleted by **#37 Rev 12 RR-01** → absence verified by **#42**'s
  cutover gate. The frozen `api-spec.md` Lab 3 attachment responses (§10 upload, §14 delete:
  `{id, isRemoved, removedAt}`) do not specify the remover field, and those routes remain the
  legacy-gated surface until #37's retrofit. The branch is explicitly **non-deployable** in this
  intermediate state (#35 DoD). Removing the key now would break the Lab 2 suite at this merge
  point — the exact failure DM-17 exists to prevent. Grep-gate output is recorded in the bundle.
- **B-4 (DB-MIG execution) — accepted and implemented.** `artifacts/lab-03/issue-35/db-mig-execution.txt`
  proves DB-MIG-01..05 **executed** (not skipped, `DATABASE_URL` present) against the
  Lab-3-migrated database; the scratch-DB proof remains supplementary.
- **B-5 (reviewer.md) — accepted and implemented.** This entry is truthful: findings, fixes, and
  the human-review status is **PENDING**. No approval is pre-recorded.
- **B-6 (ground truth unreadable) — accepted and implemented.** The frozen docs are linked from
  the PR description, and `artifacts/lab-03/issue-35/compliance-map.md` quotes `specification.md`
  §9.2/§9.3/§13 and `api-spec.md` §0–§4 against the implementation, tests, and evidence.
- **Edge items — accepted.** `req.session.regenerate()` was already implemented at login
  (`auth.controller.ts`); a supplementary fixation-safety test (`API-AUTH-09 supplementary`) was
  added. The Secure flag is env-driven (`secure: isProduction` in `session.ts`); no `.env` is
  committed; a build step is in the PR checklist.
- **Lab 2 test-change mapping — documented.** `artifacts/lab-03/issue-35/lab2-test-changes.md`
  lists every Lab 2 test adaptation against the baseline with per-test justification. The one
  schema-assertion change (`DB-01`) reflects superseded Lab 2 behavior (table `DevRequester` →
  `User`); no behavioral assertion was weakened or deleted. This document seeds #37's RR-04 audit.
- **Additional regression found and fixed during remediation.** The expanded seed attached
  seeded Tickets to reference data selected from **all** categories/systems, which let a seeded
  Ticket reference a category planted by a Lab 2 test and blocked that test's `afterAll` cleanup.
  Fixed by scoping the seed's reference lookups to its own declared records
  (`server/prisma/seed.ts`); the Lab 2 suite is green again.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

### Issue #38 — PR #49 remaining verification gaps (2026-09-24)

**Latest human review:** [PR #49 review](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49#pullrequestreview-5302181325)
requested direct Staff/Administrator Public Comment authorization tests, direct safe-rendering
tests, and unexpected backend failure containment/recovery tests. An independent review also
identified a Staff Detail refresh-ordering defect: an older Comment refresh could replace a newer
successful Note result.

**Response:** Added `API-49-CREAD-01`, `UI-49-SAFE-01/02`, and `API-49-FAIL-01..04` with real
sessions, real routes, narrowly injected one-shot Prisma failures, exact canonical error-body
assertions, no-write checks, and healthy follow-ups. Added `UI-49-RACE-01` and fixed the Staff
Detail read path with local mutation-generation, read-sequence, and ticket-identity guards.
Existing safe-rendering, partial-success, focus, and conflict tests remain unchanged.

**Verification:** Focused client tests passed 59/59 across three files; focused server tests
passed 93/93 across three files, with no required skips. Full client tests passed 208/208 across
16 files, full server tests passed 539/539 across 38 files, and both builds passed. Issue #42
still owns browser/E2E/release evidence, and human re-review remains pending.

**Verdict: fix implemented; re-review requested.** No human approval is claimed.

### Issue #35 — PR #46 second review follow-up (2026-09-18)

**Reviewer comment I received (round 2): Request Changes.** Five substantive blockers remained
after the first remediation round. The reviewer explicitly confirmed that the provenance/evidence
work, E2E ownership, DM-17 compatibility decision, session-fixation test, and seed-scoping
regression fix were already addressed, and that the remaining work was concentrated in five
areas. The reviewer also confirmed the evidence infrastructure was substantially improved but
proved the *old* assertions rather than the missing behaviors.

**How I responded — per blocker:**

- **B-1 (migration atomicity/recovery) — accepted and implemented.** `applyTrackedMigrationOutOfBand()`
  now applies every tracked migration with `psql --single-transaction -v ON_ERROR_STOP=1`, so a
  late Phase C statement failure rolls back ALL Phase C DDL and the migration is never recorded
  as applied. The post-backfill verification now runs INSIDE the backfill transaction, and all
  legacy invariants that can be evaluated before the irreversible boundary are validated
  pre-backfill (`validateLegacyInvariants`). `stage1Preflight()` now explicitly recognizes the
  documented resumable state (Phase A applied / backfill complete / Phase C unapplied) and
  resumes at Phase C; the pre-backfill collision scan is correctly skipped on that resume path
  (re-running it would report false collisions against the backfilled Users). A deterministic
  test-only failure hook (`MIGRATION_TEST_FAIL_PHASE_C_AT`, active only when `NODE_ENV=test`)
  injects a late Phase C failure through the real psql mechanism. `_prisma_migrations` is never
  hand-edited.
- **B-2 (Lab 2 data preservation) — accepted and implemented.** `DB-MIG-PRESERVE-01/02` build a
  populated Lab 2 fixture (4 requesters with mixed active states, 2 categories, 2 related
  systems, 4 tickets, 3 attachments including a soft-removed one with a remover and a different
  uploader), take a complete pre-migration snapshot, run the REAL orchestrator, and compare every
  record field-by-field — including exact ID sets, `User.id === DevRequester.id`, and the
  `uploaderRequesterId → uploaderUserId` / `removedByRequesterId → removedByUserId` renames. The
  timestamp assertion now compares the EXACT expected `timestamptz` column set instead of
  `tzCols.length > 0`.
- **B-3 (canonical API errors) — accepted and implemented.** `parseApiError()` is now `async` and
  awaits `response.json()` before returning, so callers observe `status`/`code`/`message`/`fields`
  immediately. All four callers (`login`, `fetchMe`, `logout`, `changePassword`) now `await` it.
  `UNIT-API-ERROR-01/02/03` prove the canonical error is available without a microtask flush or
  retry, and that malformed/empty/500 bodies fall back safely.
- **B-4 (canonical ticket allocator) — accepted and implemented.** The seed's private
  `TicketSequence` logic was removed; seed Tickets are now created inside a transaction using
  `allocateTicketNumberWithClient()` from `server/src/ticket-number.ts`. This fixed a real defect:
  the old seed produced four-digit numbers (`TKT-2026-0334`); the new seed produces canonical
  six-digit numbers (`TKT-2026-000377`). `SEED-TKT-01..04` assert format, uniqueness, rerun
  stability, and allocator continuity.
- **B-5 (safe idempotent seed) — accepted and implemented.** `upsertUser()` was replaced with
  `ensureUser()` (create-if-missing), so a legitimate administrator change to `role`, `isActive`,
  `passwordHash`, or `mustChangePassword` survives a rerun. Seed Tickets now carry a deterministic
  seed-owned marker (`[seed:<key>]` in `description`) instead of the unsafe `summary + requesterId`
  heuristic, and seed Comments/Notes are matched by their exact content on a seed-owned Ticket
  rather than "the ticket has zero comments". `SEED-IDEMP-01/02`, `SEED-COLLISION-01`,
  `SEED-COMMENT-01`, and `SEED-NOTE-01` prove non-destructive reruns and that a resembling
  non-seed Ticket is never claimed or mutated.

**Additional defect found and fixed during remediation.** The client `tsc` build emitted compiled
`.js` files next to the `.ts` sources in `client/src/`, and Vite resolved the stale `.js` before
the `.ts`. This silently shadowed the `parseApiError` fix during tests. The stale artifacts were
removed and `client/tsconfig.json` now sets `noEmit: true` (Vite performs the actual bundling), so
the shadowing cannot recur.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

### Issue #35 — PR #46 third review follow-up (2026-09-18)

**Reviewer comment I received (round 3): Request Changes.** The reviewer re-audited the PR beyond
the three already-flagged items — reading `service.ts`'s DM-17 compatibility layer, the Phase
A/Phase C migration SQL, route wiring in `module.ts`/`requester-context.ts`, `auth-service.ts`'s
password policy, `ChangePassword.tsx`, and the actual test files to confirm the gaps were not
covered elsewhere. The reviewer confirmed **no additional blockers** beyond the three, and
explicitly confirmed that DM-17's legacy-route compatibility layer, FK re-pointing in Phase C,
CORS/session wiring, the password policy, and seed email casing are either correctly implemented
or explicitly out of scope for #35 (owned by #37/#41/#42). The reviewer also confirmed that
`AuthGate.tsx` calls `fetchMe()` on every mount, which makes the CSRF gap a normal-usage path
(any page reload) rather than a rare edge case.

**How I responded — per blocker:**

- **F-1 (migration resume identity) — accepted and implemented.** `stage1Preflight()` returned
  `"backfill-complete"` on row-count equality alone, so a database whose `User` rows did not
  correspond to the legacy `DevRequester` rows would resume at Phase C and drop `DevRequester`
  with the wrong identity mapping. Added `verifyBackfillIdentity(legacy)` in
  `server/src/migrate-lab3.ts`: for every legacy row it asserts a `User` with the **same `id`**,
  `role = 'REQUESTER'`, and `normalizeEmail(devRequester.email) === user.email`, and throws
  `MigrationStopAndReportError` naming the mismatched id(s) otherwise. The
  `actualUsers === 0 → "phase-a-applied"` branch is unchanged. `DB-MIG-06` builds a fixture with
  1 legacy requester and 1 unrelated `User` (counts equal, identity mismatched) and asserts the
  abort, that Phase C is not applied, and that `DevRequester` still exists.
- **F-2 (`/api/auth/me` CSRF reissue) — accepted and implemented.** `me()` now calls
  `issueCsrfToken(req, res)`, which re-sends the session's **existing** token (it does not
  regenerate one). This closes a normal-usage gap: `AuthGate` calls `fetchMe()` on every mount,
  so any page reload previously left an authenticated session with no client CSRF token and every
  subsequent mutation failed `403`. `API-AUTH-05b` asserts the `/me` header equals the
  login-issued token; `CSRF-ME-01` simulates a new tab (cleared `sessionStorage`), captures the
  token from `fetchMe()`, and proves `changePassword()` then sends it and succeeds.
- **F-3 (logout false success) — accepted and implemented.** `handleLogout()` used `finally`, so
  a failed `logout()` still cleared the user and moved the gate to Login — presenting failure as
  success while the server session remained live. The `finally` was replaced with a success path
  plus a `catch` that preserves the authenticated shell and renders an inline `role="alert"`
  error near the Logout button (no auto-retry). `UI-AUTHGATE-01/02` cover the failure and success
  paths.
- **Informational item (seed email casing) — acknowledged, no change made.** `seed.ts`'s
  `ensureUser()` does an exact-string email lookup with no `.toLowerCase()` normalization while
  the migration backfill normalizes. It is harmless today because all seed emails are hardcoded
  lowercase literals, and duplicate-email enforcement is Administrator-management scope owned by
  #41. Recorded here as a one-line note for whoever picks up that issue rather than changed in
  this PR.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

### Issue #35 — PR #46 fourth review follow-up (2026-09-19)

**Reviewer comment I received (round 4): Request Changes.** The reviewer re-audited the PR and
raised one blocking security finding, two blocking correctness findings, and a set of
non-blocking hardening items.

**How I responded — per finding:**

- **Blocking — credential leaked into committed evidence (security).** A real DB password had
  leaked into `artifacts/lab-03/issue-35/db-mig-execution.txt` and `server-vitest.txt` via an
  `execSync` error message. Fixed at the source in round 5 (password stripped from the command
  string, passed via `PGPASSWORD`, and `sanitizeExecError()` strips any credential fragment from
  error text). In this round the credential was **rotated at the source** and repository history
  was **rewritten with `git filter-repo`**, so the value is absent from every commit. The evidence
  bundle was regenerated at the new head. No value is recorded in any document.
- **Blocking — attachment ownership was not verified before Phase C (real defect).**
  `verifyBackfillIdentity()` only checked that `uploaderUserId` resolved to a User; it did not
  verify that the shadow columns **mirror** the legacy requester columns. Phase C drops those
  legacy columns, so a divergence would silently destroy the true ownership/removal attribution.
  Added `verifyAttachmentOwnership()`, called on the resume path and immediately before Phase C,
  using `IS DISTINCT FROM` (a plain `<>` returns NULL when the remover is NULL and would silently
  pass) plus a check that a non-null `removedByUserId` resolves to a User. `DB-MIG-08/09/10` cover
  the uploader divergence, the NULL-remover case, and the correct resume. A mutation check
  (removing the guard) confirmed DB-MIG-08/09 fail without it.
- **Blocking — `itPriority` left NULL on ticket creation (real defect, frozen §9.3).**
  `service.ts::createTicket` never set `itPriority`, violating the frozen contract ("Initially
  copies Requested Priority"). It is now initialized from the **validated** `requestedPriority`;
  a client-supplied `itPriority` is never read. `TKT-PRIO-01/02/03` cover each priority, the
  spoofed-body case, and the unchanged Lab 2 response shape. The Lab 2 tests that asserted the
  old NULL behavior were updated.
- **Blocking — unhandled async errors in the auth handlers (real defect).** `login`, `logout`,
  and the rethrow in `changePasswordHandler` had no `try/catch`; Express 4 does not catch rejected
  promises, so a transient DB error could leave the client without a response and terminate the
  process. All three now fail closed with the canonical `500 INTERNAL_ERROR`, and a final JSON
  error middleware was added to `app.ts` as defense in depth. `API-AUTH-10/11/12` force the
  DB/session call to reject and assert the canonical 500 with the server still up.
- **Non-blocking — `SESSION_SECRET` placeholder accepted.** The 51-character `.env.example`
  placeholder passed the `>= 32` length check. Known placeholders are now rejected explicitly
  (`SEC-AUTHZ-11`).
- **Non-blocking — login timing leaked account existence.** `verifyCredentials` returned
  immediately for an unknown email while a known email paid the full bcrypt cost. A dummy bcrypt
  comparison now equalizes the cost (`SEC-AUTHZ-12`).
- **Non-blocking — `git diff --check` trailing-blank-line hits and local paths in evidence.**
  The five trailing-blank-line hits were in the evidence logs, which were regenerated at the
  final head. The regenerated logs are produced by the same commands; the local-path/username
  content is inherent to the runner's output and is recorded as a known characteristic of the
  evidence rather than a claim of cleanliness.
- **Informational — legacy `X-Dev-Requester-Id` routes.** Acknowledged as the authorized,
  declared temporary DM-17 compatibility layer (reviewer agreement recorded); no change made.

### Issue #35 — PR #46 review follow-up, round 7 (User.id sequence sync)

**Reviewer comment I received (2026-09-19): Request Changes.** The reviewer reported that the
`User.id` sequence is not repaired when the orchestrator crashes in the window between the backfill
commit and the `setval`. They confirmed it three ways: from the code (`runBackfill()` commits the
explicit-ID inserts inside `$transaction(...)` and runs `setval` afterwards, outside it; the
`backfill-complete` resume branch skips `runBackfill()` entirely), by reproduction against the real
Phase A/Phase C SQL (sequence at `last_value=1, is_called=false`; the first auto-ID insert failed
with `duplicate key … User_pkey … Key (id)=(1)`), and against the requirements (spec §9.3 makes
`User.id` auto-increment while preserving `DevRequester.id`, and the seed calls
`prisma.user.create` without an id). They also noted the failure is silent — every check passes and
the first "create user" call fails later, up to N times where N is the number of migrated
requesters — and raised a doc nit: the `service.ts` comment called `itPriority` "required" when
spec §9.3 defines it as nullable with a default of `requestedPriority`.

**How I responded — per finding:**

- **Blocking — `User.id` sequence not repaired after a post-backfill-commit crash (real defect).**
  Accepted. The reviewer's design choice was adopted rather than adding a second `setval` to the
  resume branch: the inline `setval` was removed from `runBackfill()` and replaced by one
  idempotent `syncUserIdSequence()` called on **every** entry path immediately before Phase C, so a
  crash at any point is repaired by the next run and databases already stuck in the broken state are
  repaired too. The three-argument `setval` form is used so the next id is exactly `MAX(id) + 1`
  (and `1` on an empty table); the previous two-argument call skipped a value and wrongly started at
  2 on an empty table. `postChecks()` now also asserts the sequence's next value is greater than
  `MAX(id)`, so removing the sync later fails loudly at migration time instead of silently at first
  user creation.
- **Tests.** Added the test-only hook `maybeFailAfterBackfillCommit()`
  (`MIGRATION_TEST_FAIL_AFTER_BACKFILL_COMMIT=1` + `NODE_ENV=test`, matching the existing
  `MIGRATION_TEST_FAIL_PHASE_C_AT` guard) and `DB-MIG-11/12/13`, written first and confirmed
  failing: DB-MIG-11 failed with the real `duplicate key … User_pkey` error, DB-MIG-12 with next
  value 6 instead of 5, DB-MIG-13 with next value 2 instead of 1. DB-MIG-11 asserts the broken
  precondition (Users with preserved IDs, `DevRequester` present, sequence next value ≤ `MAX(id)`)
  so it cannot pass vacuously. A mutation check (removing the `syncUserIdSequence()` call) confirmed
  DB-MIG-11 fails again without the fix.
- **Doc nit — `itPriority` described as "required".** Accepted and corrected. Spec §9.3 defines
  `itPriority` as nullable with a default of `requestedPriority`; the `service.ts` comment now says
  so. The behavior (initialized from the validated `requestedPriority`) is unchanged.
- **Earlier findings re-checked on the new head (`ac0bfe5`, history rewritten).** Credential: no
  unmasked credential in this branch's history, only `USER:PASSWORD` placeholders; rotation is
  recorded in this file and the evidence README, and I cannot verify the rotation itself. GitHub may
  still hold the old commits, so a Support purge may still be worthwhile. Attachment ownership: the
  guard is present, NULL-safe, and runs before Phase C on every path. `itPriority`: now set on
  create. Async auth crash: re-ran the repro; it returns HTTP 500 and the server stays up.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

### Issue #37 — Authorization + Requester Migration / Regression (PR #47)

**Reviewer comment I received (2026-09-20): Changes Requested.** The review was performed by an
agent against the frozen Lab 3 contract (`docs/lab-03/specification.md`, `api-spec.md`,
`ui-spec.md`, `tests.md`) and the Lab 2 regression baseline. It raised **2 blocking** and
**6 non-blocking** findings.

**Blocking**

- **B-1 — the Lab 2 E2E suite still used the removed Dev-Requester mechanism.** Every
  `e2e/lab-02/` spec drove the selector/header that #37 deletes, so the regression suite could not
  run against the migrated app. Remediated: all specs now log in through the real Login screen
  (`loginAsRequester`), `ownership.spec.ts` uses isolated Playwright request contexts (one cookie
  jar per Requester), `responsive-visual.spec.ts` stubs `/api/auth/me` instead of the removed
  endpoints, and a `globalSetup` seeds two E2E Requester accounts. Every layout, overflow,
  touch-target, ownership, and partial-success assertion is retained; the retired selector/header
  assertions each have an authenticated-identity replacement recorded in
  `artifacts/lab-03/regression/lab2-test-audit.md`.
- **B-2 — `api-spec.md` §11 contradicted the landed code.** The spec showed a `{ "data": [...] }`
  envelope for the attachment list, but the endpoint returns a bare array (preserved from Lab 2,
  decision D-18 / RR-02). Remediated: §11 now documents the bare array and `removedByUserId` is
  documented in §11/§14; the decision is recorded in `specification.md`.

**Non-blocking**

- **N-1 — raw evidence missing.** Full server/client/E2E run outputs are now saved under
  `artifacts/lab-03/regression/`.
- **N-2 — `SEC-AUTHZ-07` wording.** Tightened to state `403 FORBIDDEN` on every then-protected
  mutation route plus explicit no-state-change checks.
- **N-3 — test seam not environment-guarded.** `requireAuth`/`requireCsrf` now honor
  `testSeams.sessionIdentity` only when `NODE_ENV === "test"`; added `UNIT-AUTHZ-02` proving the
  seam is inert under `NODE_ENV=production`.
- **N-4 — README stale.** §1/§2/§8 now state the removed surface; the file tree was corrected.
- **N-5 — idle-session UX.** Deferred to #42 (out of #37's scope).
- **N-6 — dead CSS.** The unused `.requester-select` rule was removed.

**Extra — class (c) regression found and fixed.** Migrating the E2E suite surfaced a real client
bug: `fetchCategories` read `payload.data` from `GET /api/categories`, which returns a bare array,
crashing `MyTickets` as soon as an authenticated shell rendered. Fixed in the code
(`client/src/api.ts`), not the test.

**Follow-up review round (2026-09-20) — P2: My Tickets diverged from the frozen Lab 3 filtering
and sorting contract.** A second agent review found that `GET /api/tickets` accepted only
`status=NEW` (any other valid status returned `400 VALIDATION_ERROR`) and recognized
`sort=requestedPriority` but not the documented `sort=status`/`sort=priority`; the frontend
mirrored both gaps. The `API-REQ-02` tests did not cover the mismatches.

**How I responded — per finding:**

- **P2 (accepted, fixed in the code).** `server/src/controller.ts` now validates `status` against
  the full frozen `TicketStatus` enum and accepts the documented sort keys
  (`createdAt`/`ticketNumber`/`summary`/`status`/`priority`), retaining `requestedPriority` as a
  Lab 2 compatibility alias for `priority`. `server/src/service.ts` orders `status` by the logical
  workflow sequence and `priority` by `LOW < MEDIUM < HIGH` (not alphabetically).
  `client/src/MyTickets.tsx` offers all eight statuses in the filter and makes the Requested
  Priority and Current Status columns sortable with the documented keys; `client/src/App.css`
  gained badge styles for the seven previously unstyled statuses.
- **P2 item 3 (safe defaults for *all* invalid query values) — deliberately not applied; scope
  decision recorded.** Applying it would contradict the frozen Lab 2 contract
  (`docs/lab-02/api-spec.md`; `tests.md` `API-MY-06`/`API-MY-07`), which classifies an out-of-enum
  `status`/`requestedPriority` and a malformed `categoryId` as `400 VALIDATION_ERROR` (and a
  nonexistent/inactive `categoryId` as `409 INACTIVE_REFERENCE`), and #37's plan locks "existing
  `getMyTickets` search/filter/sort/pagination behavior is preserved". The two classes are now
  documented explicitly in `api-spec.md` §8: safe-default fallback applies to
  `sort`/`order`/`page`/`pageSize`; validation errors apply to the filter enums and `categoryId`.
  Lab 3 widens the accepted status set and sort keys only.
- **`requesterId` clarification (documentation only, no behavior change).** Issue #37's checklist
  says a mismatched client-supplied `requesterId` must be "rejected"; the implementation
  **ignores** it and assigns ownership to the authenticated user. This is the frozen convention
  (unknown JSON properties are ignored; BR-03) and is what `SEC-AUTHZ-01` asserts. `api-spec.md` §0
  now states this explicitly, including a note that the checklist wording is satisfied in substance
  (the mismatched identity is never honored) but the literal HTTP behavior is *ignore*, not
  *reject* — and that the implementation must not be changed without reconciling §0 first.
- **Tests.** Extended the frozen `API-REQ-02` row with non-`NEW` status filtering, the five
  documented sort keys in both directions, logical-order assertions for `sort=status` and
  `sort=priority`, the retained `requestedPriority` alias, invalid-`sort` fallback, and the
  preserved `400` behavior for out-of-enum filter values. Added supplementary `UI-MY-08` for the
  frontend status dropdown and sort keys.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

### Issue #38 — IT Staff Ticket Operations (PR #49)

**Reviewer comment I received (PR #49): Changes Requested.** Four actionable blockers plus one
contract decision:
- **49-B1** — Staff/Admin initially landed on the Requester `My Tickets` screen.
- **49-B2** — Staff Ticket Detail did not expose the Ticket's existing Attachments.
- **49-B3** — `pageSize` did not implement the documented 1–50 clamp.
- **49-B4** — the status confirmation modal lacked the required keyboard/focus behavior.
- **49-D1** — ambiguity: who may change status on an assigned ticket?

**How I responded — per finding:**

- **49-D1 (contract decision — resolved).** The Status Transition Matrix's validation column
  reads "Ticket owned" (`ticketOwnerId` non-null), not "owned by the acting user," and the
  Authorization Matrix grants "Perform permitted status changes" to the whole
  IT Staff/Administrator group. Decision: **any** active IT Staff/Administrator may change the
  status of a claimed Ticket; the acting user need not be the specific owner, and a status change
  never mutates ownership. Recorded in `specification.md` §7 and §13 decision 14 and in
  `api-spec.md` §19, and proven by the cross-actor cases in `API-STAFF-03`.
- **49-B1 (fixed).** `App.tsx` now derives the initial view from the authenticated role
  (Requester → `home`; IT Staff/Administrator → `staff-queue`) and renders only role-permitted
  views, redirecting stale/manipulated state to the role's initial view. Backend authorization
  was deliberately left unchanged. Added UI-49-01..05 and verified they fail against the pre-fix
  behavior.
- **49-B2 (fixed).** `getStaffTicketDetail` now returns the Ticket's Attachments (reusing the
  established `AttachmentData` shape) and `StaffTicketDetail` renders a read-only Attachments
  section with Preview/Download and no upload/remove controls. No new endpoint was created — the
  shared §11–§13 read routes are consumed as-is. Added API-49-ATT-01..09 and UI-49-ATT-01..05.
- **49-B3 (fixed).** `parseQueueQuery` now clamps a well-formed integer to the frozen 1–50 range
  (`0` → `1`, `51`/`999` → `50`) while malformed input keeps the safe default of `10`. Added
  boundary cases to `staff-queue.api.test.ts`.
- **49-B4 (fixed).** The confirmation modal now captures the invoking control, moves focus inside
  on open, traps Tab/Shift+Tab, closes on Escape without calling the API, and restores focus on
  close. Added UI-49-MODAL-01..10.

**Verdict: remediation complete; re-review requested. Human review is PENDING** — no approval
is claimed, and no false sign-off is recorded.

**PR #49 accessibility follow-up (2026-09-24):** The next review identified two remaining
accessibility blockers: confirmed status transitions could restore focus to a button removed by
the status update, and eligible-owner lookup errors were not associated with their selects.
The implementation now focuses the mounted Back to Queue control after successful status rendering,
preserves invoking-button focus for Escape/Cancel and failures, and associates both owner errors
with conditional `aria-describedby` references. Focused client tests pass 67/67; the full client
suite passes 205/205 and the client build passes. Human re-review remains pending; no approval is
claimed.

---

## Pull Requests I reviewed (authored by my partner)
| PR | Branch | My verdict |
|----|--------|------------|
| [#66 — docs: establish Lab 3 engineering contract](https://github.com/oangsa/TokTickIT/pull/66) | `feature/59-lab3-engineering-contract` → `lab3-staging` | Changes Requested, then Approved (2026-09-11) |

**Issue #59**
Reviewer comment I gave: **Request Changes** — I reviewed PR #66 against the actual Lab 3 handout (treated as the upper authority), the PR's four engineering-contract documents, and the updated Issues #59–#65. I found 3 handout-to-contract alignment issues that should be fixed before treating the PR as the final Lab 3 contract:

1. **`ai_use.md` vs required `ai-use.md`** — the handout's required Lab 3 structure and Part 4 both specify `docs/lab-03/ai-use.md` (hyphen), but PR #66 created `docs/lab-03/ai_use.md` (underscore). Required fix: rename the file and update every reference in `specification.md`, `tests.md`, `reviewer.md`, and the issue bodies.
2. **Screenshot evidence root differs from the handout** — the handout prescribes `artifacts/lab-03/screenshots/` (with `authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/` subfolders), but PR #66 made `docs/lab-03/evidence/screenshots/` the normative evidence root. Required fix: use the handout path as canonical, or explicitly retain the handout-required structure rather than silently redefining it.
3. **User Management adds mandatory pagination/sorting** — the handout explicitly excludes "advanced user-list features such as mandatory pagination, multi-column sorting, and multiple simultaneous filters," yet the PR made User-list pagination (default page size 10) and sorting normative. Required fix: keep User Management minimal (search by name/email, optional role filter, simple list) and leave pagination/sorting to the IT Staff Ticket Queue only.

How my partner responded: No code or documentation changes were made in response to my review. My partner communicated directly (outside the PR) that the naming convention is not that strict and that he intends to keep the template as-is. The three issues I raised therefore remain open in the PR as filed.

Final verdict: **Approved** (2026-09-11) — I approved the PR despite the three alignment issues, since my partner indicated the naming convention is not being treated as strict and no changes were required on his side. The three findings above remain recorded for reference but were not blocking for approval.
