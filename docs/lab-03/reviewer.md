# Lab 3 — Peer Review Record

**Author:** <Kittipich Charoenthanachot> — <67070503405> — GitHub: @kittipichcha
**Peer reviewer:** <SUTHANG SUKRUEANGKUN> — <67070503477> — GitHub: @oangsa

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#44 — Add Sprint 3 engineering contract (Issue #34)](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/44) | `feature/issue-34-sprint-3-contract` | Changes Requested (2026-09-10) |
| [#46 — feat(lab-03): Issue #35 — Identity, Database Migration & Authentication](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/46) | `feature/issue-35-identity-db-migration-auth` → `lab3-staging` | Changes Requested (2026-09-17) — remediation in progress; **human review PENDING** |

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