# Lab 3 - AI Use and Reflection

**LLM/agent used:** GitHub Copilot (DeepSeek V4 Flash 0731)

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Create `lab3-staging` from `main` and a worktree/branch for Issue #34 | Created `lab3-staging`, pushed it, and created worktree `issue-34-sprint-3-contract` on branch `feature/issue-34-sprint-3-contract`. |
| 2 | Plan the Sprint 3 engineering contract using the planning skill | Researched the Lab 2 baseline, the Lab 3 handout, and the repository conventions, then produced a feature-by-feature plan. |
| 3 | Confirm open decisions (auth mechanism, hashing, status matrix, queue defaults, comment limits) | Locked in session-cookie auth, bcrypt, drafted status matrix, queue defaults, and comment length limits. |
| 4 | Draft `docs/lab-03/specification.md` | Produced the Sprint 3 engineering specification with FR/BR, authorization matrix, status matrix, migration inventory, AC, and DoD. |
| 5 | Draft `docs/lab-03/api-spec.md` | Produced the REST API contract with auth/session decisions and all endpoints. |
| 6 | Draft `docs/lab-03/ui-spec.md` | Produced the Zen Green UI contract for all Lab 3 screens. |
| 7 | Draft `docs/lab-03/tests.md` | Produced the test design and traceability matrix in the Lab 2 format, with every AC mapped to a planned test. |

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Reusing the established Lab 2 documentation format avoids inventing new conventions and keeps the contract consistent.
3. Freezing the authorization and status matrices during specification prevents downstream implementation churn.
4. Every Acceptance Criterion must map to at least one planned test before implementation begins.
5. The contract must be reviewed and approved before dependent implementation issues begin.

## Issue #34 Implementation Entry

- Prompt summary: Create the Sprint 3 engineering contract (Spec DD + Test DD) for Issue #34 from the Lab 3 handout and Lab 2 baseline.
- What was done with output: Created `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `ai-use.md`, and `reviewer.md` in the `issue-34-sprint-3-contract` worktree.
- Reflection: This issue produces documentation only; no implementation code was changed. Test rows are all `Planned` and will be executed by downstream issues.

## Issue #34 Contract-Freeze Revision Entry

- Prompt summary: After peer review, freeze the two remaining contract decisions that were previously left to implementation: the exact password policy and the exact migrated-Requester initial-password derivation.
- What was done with output: Revised the engineering contract to explicitly freeze:
  - **Password policy** (specification.md BR-10 and Section 13 decision 12): 12–128 characters; at least one uppercase ASCII letter, one lowercase ASCII letter, one digit, and one ASCII special character; not trimmed before validation; whitespace permitted; no reuse/history rule. Propagated to `api-spec.md` (change-password, admin create user, admin initial-password) and `ui-spec.md` (Change Password screen), and strengthened `API-AUTH-07` in `tests.md`.
  - **Migrated-Requester initial-password derivation** (specification.md Section 9.2 and Section 13 decision 13): `Lab3-` + first 20 hex chars of SHA-256(lowercase(trim(email)) + ":" + trim(name)), encoded as lowercase hex. The seed module implements this frozen rule; it does not define it. Strengthened `DB-MIG-03` in `tests.md` to verify the exact derivation and repeated-run determinism.
- Reflection: The two decisions were contract decisions, not implementation details, so they had to be frozen before implementation. The specification is now the single source of truth for both the password policy and the migration derivation; no document defers either decision to the seed module.

## Issue #34 Contract-Freeze Revision Entry (Round 3)

- Prompt summary: After Rounds 1–2 froze the migration, data model, queue, session, password-policy, and migration-derivation decisions, run a documentation-only audit to close the remaining internal-consistency gaps (G-01–G-10) before Lab 3 implementation begins.
- What was done with output: Closed ten remaining contract gaps across `specification.md`, `api-spec.md`, and `tests.md`:
  - **Endpoint error-case completeness (G-01–G-04):** added `403`/`404` to `PATCH .../priority` and `PATCH .../status`; added `404` to `PATCH /api/admin/users/:userId` and `POST .../initial-password`; froze invalid-`role`-filter behavior on `GET /api/admin/users` (treated as no filter, never `400`); added the wrong-`currentPassword` case to `POST /api/auth/change-password` (generic message, no leak).
  - **Frozen decisions (G-05, G-06, G-07, G-08, G-10):** claim-before-status-change (status on unowned Ticket returns `409`, never auto-claims); concurrent claim/reassign is last-write-wins; concurrent sessions are allowed; added BR-34 (non-last Administrator may change own role away from Administrator); added the migration email-collision guard (fail loudly, no silent overwrite).
  - **Empty-result coverage (G-09):** extended AC-10/AC-15 and added `UI-QUE-02`/`UI-ADM-02`.
  - Added 11 new planned test rows (`API-AUTH-08/09`, `API-STAFF-06/07/08/09`, `API-ADM-09/10`, `DB-MIG-05`, `UI-QUE-02`, `UI-ADM-02`) and updated the §6 AC→test mapping.
- Reflection: The three open decisions (claim-before-status, claim race, concurrent sessions) were genuine implementation-strategy choices the handout leaves to the team; all three were resolved as Option A (the simplest behavior consistent with the existing contract) and frozen in Section 13 decisions 14–16. The contract is now closed on every legal execution path identified in this pass.

## Issue #34 Contract-Freeze Revision Entry (Round 4)

- Prompt summary: After Rounds 1–3, run a second, exhaustive line-by-line pass through every endpoint in `api-spec.md` and `ui-spec.md` to find completeness gaps the earlier rounds did not cover (N-01–N-07).
- What was done with output: Closed seven remaining contract gaps across `api-spec.md`, `ui-spec.md`, and `tests.md`:
  - **Error-case completeness (N-01–N-04):** added `404 NOT_FOUND` to `POST/GET .../comments` (Requester-ownership path, matching `#20a`'s precedent); added `403 FORBIDDEN` to `POST /api/admin/users` and `PATCH /api/admin/users/:userId`; added `403 FORBIDDEN` to attachment upload/delete for the IT Staff/Administrator view-only case; added `404 NOT_FOUND` to `POST/GET .../notes`.
  - **Documentation-clarity fixes (N-05–N-07):** clarified in §0 that `401 UNAUTHENTICATED` applies uniformly to every protected endpoint and is not re-listed per-endpoint; confirmed `confirmPassword` is a client-side-only check never sent to the API; documented that the Status Transition Matrix's "Confirmation" transitions are a client-side modal gate only, with the API applying the transition unconditionally.
  - Added 6 new planned test rows (`SEC-AUTHZ-08/09/10`, `API-STAFF-10`, `UI-CHPWD-02`, `UI-STAFF-02`) and updated the §6 AC→test mapping.
- Reflection: This round was a self-directed completeness audit (not a partner review) that found only mechanical, already-implied error-case gaps against handout §6.2 and the team's own frozen decisions — no new judgment calls were required. The Attachment byte-size/MIME-type values remain intentionally unstated (inherited from the Lab 2 contract, which this document does not duplicate).

## Issue #35 Implementation Entry (Identity, Database Migration & Authentication)

- Prompt summary: Implement the Issue #35 plan (Revision 13) end-to-end — the two-phase migration, the auth surface, the seed expansion, the shared client transport, the auth UI, and all frozen tests — creating a branch/worktree from `lab3-staging` and following the plan strictly.
- What was done with output:
  - **Branch/worktree:** `feature/issue-35-identity-db-migration-auth` at `issue-35-worktree`, based on `origin/lab3-staging` @ `749aa96` (PR #45 merge).
  - **Scratch-DB proof (Prisma 5.22):** proved apply-then-resolve works (out-of-band SQL + `prisma migrate resolve --applied`); ran the full orchestrator from a fresh Lab-2 baseline; demonstrated collision abort + recovery/resume (DM-18). Recorded at `artifacts/lab-03/migration/scratch-db-proof.md`.
  - **Migrations:** Phase A (`20260917000000_lab3_phase_a_expand`) and Phase C (`20260917000001_lab3_phase_c_contract`); `migrate-lab3.ts` orchestrator (two-stage preflight, three-way collision scan, single-transaction backfill, post-backfill verification, DM-TIME-01 UTC conversion).
  - **Auth surface:** `session.ts` (fresh-User authority; `401 UNAUTHENTICATED` / `401 PASSWORD_CHANGE_REQUIRED` / `403 FORBIDDEN`), `auth-service.ts` (bcrypt + frozen policy), `auth.controller.ts`, CORS.
  - **Seed:** idempotent expansion (Requesters, IT Staff, Administrator, tickets, comments, notes).
  - **Client:** `api-client.ts` transport, `Login.tsx`, `ChangePassword.tsx`, `AuthGate.tsx`.
  - **DM-17 compatibility set:** adapted `service.ts`/`requester-context.ts` and the Lab 2 test files to the `User` model, preserving Lab 2 semantics and response shapes.

## Issue #35 PR #46 Review Follow-up Entry (Round 4 — three re-audit blockers)

- Prompt summary: A re-audit of PR #46 beyond the three already-flagged items confirmed the three
  blockers were the complete set, and supplied a detailed fix plan for each. Implement the three
  fixes strictly as specified, update the related documentation (including `README.md`), and
  commit and push.
- What was done with output:
  - **F-1 — migration resume identity verification.** `stage1Preflight()` previously returned
    `"backfill-complete"` on row-count equality alone. Added `verifyBackfillIdentity(legacy)` in
    `server/src/migrate-lab3.ts`, which asserts same `id`, `role = 'REQUESTER'`, and normalized
    email for every legacy `DevRequester` row before resuming at Phase C, and throws
    `MigrationStopAndReportError` naming the mismatched id(s) otherwise. Added `DB-MIG-06`.
  - **F-2 — `/api/auth/me` CSRF reissue.** `me()` now calls `issueCsrfToken(req, res)`, which
    re-sends the session's existing token. This closes a normal-usage gap: `AuthGate` calls
    `fetchMe()` on every mount, so any page reload previously left an authenticated session with
    no client CSRF token and every mutation failed `403`. Added `API-AUTH-05b` and `CSRF-ME-01`.
  - **F-3 — logout false success.** `handleLogout()` used `finally`, so a failed `logout()` still
    cleared the user and moved the gate to Login. Replaced with a success path plus a `catch`
    that preserves the authenticated shell and shows an inline `role="alert"` error. Added
    `UI-AUTHGATE-01/02`.
  - **Documentation:** updated `docs/lab-03/tests.md` (new rows, AC-06/AC-25 mappings, Results
    Log), `docs/lab-03/reviewer.md` (round-4 review record), `README.md` (Lab 3 §11.2/§11.3 and
    the test-count summary), and regenerated the `artifacts/lab-03/issue-35/` evidence bundle at
    the new implementation SHA.
  - **Informational, no change made:** `seed.ts`'s `ensureUser()` email lookup is not
    case-normalized while the migration backfill is. Harmless today (hardcoded lowercase seed
    emails) and duplicate-email enforcement belongs to #41; recorded for that issue.
- Reflection: All three defects were in code paths that the existing tests did not exercise —
  a resume path that only triggers after a Phase C failure, a CSRF header on a `GET` that no test
  asserted, and a logout failure branch that the `finally` block made unreachable. The re-audit's
  value was tracing the *actual* call paths (`AuthGate` → `fetchMe()` on every mount) rather than
  reasoning about the endpoints in isolation, which is what reclassified the CSRF gap from a rare
  edge case to a normal-usage path.
- Reflection: The plan's DM-17 compatibility set was essential — Phase C drops `DevRequester`, and without the declared adaptation the #35 merge point would not compile and the Lab 2 regression suite would break. Adapting the Lab 2 tests to `prisma.user` (role `REQUESTER`) preserved their assertions exactly rather than weakening them. The scratch-DB proof validated the Prisma-5.22 apply-then-resolve assumption before feature work, so no stop-and-report gate was triggered.

## Issue #35 PR #46 Review Follow-up Entry (Round 6 — credential rotation, ownership guard, IT Priority, async errors)

- Prompt summary: Follow the round-6 remediation plan: rotate the leaked credential (done by the
  author), fix the attachment-ownership resume gap and the `itPriority` creation defect
  (tests first), contain unhandled async errors in the auth handlers, apply the non-blocking
  hardening items, rewrite repository history, and regenerate the evidence at the final head.
- What was done with output:
  - **Credential rotation and history rewrite (infra action).** The exposed password was rotated
    at the source by the author. Repository history was rewritten with `git filter-repo` so the
    value is absent from every commit, and the evidence bundle was regenerated at the new head.
    No value is recorded in any document.
  - **P2 — `itPriority` on creation.** `service.ts::createTicket` now sets
    `itPriority: validated.requestedPriority` (never read from the request body). Added
    `TKT-PRIO-01/02/03` (tests written first and confirmed failing) and updated the Lab 2 tests
    that asserted the old NULL behavior.
  - **P1-2 — attachment ownership on resume.** Added `verifyAttachmentOwnership()` in
    `migrate-lab3.ts`, called on the resume path and immediately before Phase C, using
    `IS DISTINCT FROM` plus a User-resolution check for a non-null `removedByUserId`. Added
    `DB-MIG-08/09/10` (tests written first and confirmed failing).
  - **Unhandled async errors.** Wrapped `login`, `logout`, and the `changePasswordHandler`
    rethrow in `try/catch` returning the canonical `500 INTERNAL_ERROR`, and added a final JSON
    error middleware in `app.ts`. Added `API-AUTH-10/11/12`.
  - **Non-blocking hardening.** Rejected the known `.env.example` `SESSION_SECRET` placeholder
    (`SEC-AUTHZ-11`) and added a dummy bcrypt comparison for unknown emails to remove the
    account-existence timing oracle (`SEC-AUTHZ-12`).
  - **Documentation:** updated `docs/lab-03/tests.md` (new rows, AC mappings, round-6 Results
    Log), `README.md` §11.1 (attachment ownership verification), `docs/lab-03/reviewer.md`, and
    regenerated the `artifacts/lab-03/issue-35/` evidence bundle at the final head.
- Reflection: The two real defects were both "the guard checked the wrong thing" — the resume
  check verified that a shadow column *resolved* rather than that it *mirrored* its source, and
  the creation path simply never set a required field. Writing the tests first made both failures
  concrete before any code changed, and the mutation check (removing the guard and confirming
  DB-MIG-08/09 fail) proved the tests actually exercise the guard rather than passing vacuously.
  The async-error finding was the most consequential: a transient DB error at login could take
  the whole API down, which no existing test covered because every test used a healthy database.