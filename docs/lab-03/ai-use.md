# Lab 3 - AI Use and Reflection

**LLM/agent used:** GitHub Copilot (DeepSeek V4 Flash 0731)

## Issue #42 PR #56 documentation review response (2026-09-26)

- Prompt summary: coordinate the authorized response to human PR #56 review; preserve user-owned
  PDF and Kanban work; document the confirmed disposable E2E database and current evidence.
- Agent used: OpenAI Codex.
- Work performed: replaced grouped acceptance evidence with one row for each AC-01 through
  AC-26; reconciled historical browser totals by run and scope; updated verification, integration,
  and final-gate records; recorded the human changes-requested review and response; documented
  the focused responsive/keyboard results and the `kitti` `CREATEDB` / `lab3e2e` prerequisite.
  Preserved existing README and `.env.example` edits, including the explicit E2E URL.
- Verification: focused responsive run reported 12/12 and focused keyboard run reported 12/12
  across desktop, tablet, and mobile in the execution handoff. Full current-head server/client
  suites, full configured Playwright regression, and REL-12 were not run as part of this
  documentation pass. `git diff --check` exited 0. A static check confirmed 26 unique ordered
  acceptance rows and the required seven columns.
- Reflection: historical release artifacts remain useful only when their source boundary and
  run scope are explicit. Focused accessibility/responsive passes do not establish full release
  readiness.

## Issue #42 E2E review follow-up (2026-09-26)

- Prompt summary: address observed attachment download filename and mobile admin-dialog failures
  in the authorized Issue #42 E2E review packet; retain scope and do not commit or push.
- Agent used: OpenAI Codex.
- Work performed: Added API-ATT-05 assertions for configured-origin CORS, credentials, exposed
  `X-CSRF-Token`/`Content-Disposition`, and original filename. Exposed `Content-Disposition` in
  app CORS configuration. The two rejected admin-edit tests now cancel and close their dialogs
  before checking mobile navigation. Updated E2E-01..04 statuses after the complete passing run.
- Verification: the pre-fix API-ATT-05 assertion failed because `Content-Disposition` was not
  exposed; afterward API-ATT-05 passed 5/5 and the full attachment API file passed 41/41. A prior
  browser rerun had 34 passed/8 failed (six filename mismatches and two mobile overlay timeouts).
  Final `npx.cmd playwright test e2e/lab-03 --workers=1` passed 42/42 across desktop, tablet, and
  mobile. `git diff --check` exited 0 with Git line-ending normalization warnings. E2E_DATABASE_URL was derived for isolated `lab3e2e`, set
  only in the test process, and never printed. REL-12 was not run.
- Reflection: browser evidence now covers attachment filename access and dialog dismissal across
  all three projects; release/REL-12 gates remain separate.

## Issue #42 E2E safety and coverage (2026-09-25)

- Prompt summary: User requested review, fixes, and PR preparation for Issue #42. The authorized
  patch addresses the E2E database fallback, missing planned coverage, and unsupported Passed
  statuses without changing product behavior.
- Agent used: OpenAI Codex.
- Work performed: Removed Playwright's fallback from `DATABASE_URL` to `E2E_DATABASE_URL`;
  added inactive-login coverage, Staff sort/pagination and attachment-read assertions, Admin
  invalid-input/authorization/guard assertions, and Requester attachment and removed-selector
  assertions. Changed E2E-01..04 to Implemented and recorded this verification state.
- Verification: `npm.cmd exec playwright test -- --list` exited 1 at config load because
  `E2E_DATABASE_URL` was absent; test discovery did not begin. `npm.cmd --prefix server run build`
  passed. `npm.cmd --prefix client run build` passed when parent reran it outside the sandbox
  after an ancestor-directory access denial. `git diff --check` passed. Playwright execution and
  REL-12 remain not run without an isolated E2E database.
- Reflection: E2E rows now describe implemented assertions without claiming database-backed runs.

## Issue #42 final verification reconciliation (2026-09-25)

- Prompt summary: reconcile final Issue #42 verification documents using confirmed run evidence,
  preserve unresolved release gates, and do not report release/sign-off as green.
- Work performed: updated the newest-first test results entry, this AI-use log, regression summary,
  verification summary, acceptance matrix, and final gate. Recorded the latest full Playwright
  run at 183/183 across desktop/tablet/mobile, plus the test synchronization guard and other
  validated counts.
- Verification: full client suite 252/252 across 18 files; server 598/598 across 39 files;
  combined UI style 34 passed; focused style 18 passed; SEC-AUTHZ-07 52 passed; Lab 3 Playwright
  27/27; Test-DD §5 paths 32/32. Type checks, builds, and Prisma validation passed. Full browser
  raw output is `artifacts/lab-03/release/playwright-full-final.txt`.
- Caveats at the time: REL-12 could not start because the temporary DB role lacked `CREATEDB`;
  #38's historical smoke artifact gate remained unresolved. The user has since confirmed role
  `kitti` has `CREATEDB` and disposable database `lab3e2e` is available, but REL-12 remains
  unrun. Human review, submission, and post-merge checks remain outstanding. The §9.3 audit used
  the existing temporary Lab 3 DB and does not clear REL-12.
- Reflection: a clean full browser run resolves the earlier flaky-run gate, while database
  isolation and historical evidence requirements remain independent release blockers.

## Issue #41 cached authentication-state remediation (2026-09-25)

- Prompt summary: Follow the supplied detailed Issue #41 remediation plan for the stale
  `mustChangePassword` flag after a successful forced password change.
- Agent used: OpenAI Codex.
- Work performed: Reviewed the current Issue #41 worktree and Lab 3 requirements; added the
  `UI-AUTHGATE-05` lifecycle regression, traceability row, and factual review/evidence notes. The
  existing `AuthGate.handlePasswordChanged()` reconciliation was already present as a local
  uncommitted change and was retained.
- Verification: PowerShell's `npx.ps1` was blocked by execution policy, and the first `.cmd`
  invocation was blocked by the workspace sandbox while esbuild read an ancestor directory.
  Retried with bounded access: the regression failed against the unfixed handler as expected,
  then the focused AuthGate file passed 9/9, the three-file client set passed 42/42, the full
  client suite passed 234/234, and typecheck/build passed.
- Judgment/reflection: The test directly surfaces the user flag passed to `App`, so shell visibility
  alone cannot mask stale cached identity. Fresh human re-review remains pending.

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

## Issue #41/#38 Integration Follow-up (2026-09-24)

- Prompt summary: Merge the available Staff implementation into the Issue #41 worktree and
  follow the supplied post-merge integration and verification plan.
- Repository check: the local `lab3-staging` reference was already an ancestor of Issue #41 and
  lacked the Staff implementation; network access to refresh it was unavailable. Integrated the
  matching local `feature/issue-38-staff-ticket-operations` branch instead, preserving its Staff
  implementation and evidence.
- Implementation: retained Requester/Staff routing and added Administrator User Management as a
  third authorized view; reconciled self-edit identity from the successful PATCH response.
- Verification: focused Admin/Staff tests, full client/server suites, TypeScript checks, builds,
  and Git whitespace/conflict checks passed. Evidence is recorded in
  `artifacts/lab-03/issue-41/README.md`; E2E-03 remains owned by Issue #42.
- Human review/approval remains pending and is not recorded as complete.

## Issue #41 PR #48 Review Follow-up (2026-09-24)

- Prompt summary: Apply the supplied review remediation plan to the current Issue #41 branch.
- Scope gate: the worktree was clean. Its `origin/lab3-staging` ref already included the #49 merge
  and was an ancestor of this branch, so the Issue #41 triple-dot diff contains no Issue #38 files.
  A fresh fetch was unavailable because GitHub could not be reached; a local backup branch was
  created before checking the ancestry.
- Implementation: retained the existing Serializable target reread and deterministic
  inactive-to-active race regression. Self-reset now publishes `mustChangePassword` to AuthGate;
  Create/Edit show success status; user rows render as labeled cards below 768px; and the unsupported
  decision-20 citation was removed from the PATCH description.
- Verification: Admin API **39 passed**; focused client **39 passed**; full client **231 passed
  across 17 files**; full server **578 passed across 39 files**. Server/client type checks and
  builds passed, as did `git diff --check`; 0 tests skipped. The migration harness emitted its
  expected failure-path diagnostics. Evidence summaries are recorded in the Issue #41 bundle.
- E2E-03 remains owned by Issue #42. No approval or re-review is recorded as complete.

## Issue #41 Final PR #48 Remediation Verification (2026-09-24)

- Implementation SHA: `05b03516087d537944cbfe0f8020dca805abd347`.
- Replaced the narrow-width table restyling with a separate mobile card list, retaining the existing
  row handlers. Added structure/action assertions plus regressions for self-reset versus another
  user's reset and for AuthGate's ordinary identity-update path.
- Removed the unsupported PATCH semantics paragraph from `api-spec.md` §26 and corrected the
  service comment so implementation behavior is not attributed to specification decision 20.
- Focused client tests: 41/41; full client: 233/233 across 17 files; Admin API: 39/39; full server:
  578/578 across 39 files. Client/server type checks and builds passed.
- The mobile screenshot could not be refreshed because this environment has no browser or
  Playwright executable. The structural test does not claim to prove actual viewport rendering;
  fresh screenshot evidence and human PR re-review remain pending.

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Reusing the established Lab 2 documentation format avoids inventing new conventions and keeps the contract consistent.
3. Freezing the authorization and status matrices during specification prevents downstream implementation churn.
4. Every Acceptance Criterion must map to at least one planned test before implementation begins.
5. The contract must be reviewed and approved before dependent implementation issues begin.

## Issue #38 PR #49 Remediation Entry (2026-09-24)

- Prompt summary: Follow the Issue #38 PR #49 review-and-fix plan, closing the three missing
  verification gaps and the independently identified Staff Detail refresh-ordering defect.
- What was done with output: Added real-session Staff/Admin Public Comment authorization tests,
  direct literal-rendering DOM tests for both communication components, canonical backend failure
  containment and recovery tests for queue/priority/comment/note writes, and a guarded Staff
  Detail read path that rejects stale responses by mutation generation, read sequence, and ticket.
  Added a delayed-response regression test for a newer note surviving an older comment refresh.
- Validation: focused client tests passed **59/59** across 3 files; focused server tests passed
  **93/93** across 3 files, with no required skips. Full client tests passed **208/208** across
  16 files; full server tests passed **539/539** across 38 files; both builds passed. Browser/E2E
  evidence remains Issue #42-owned; human PR re-review remains pending.
- Reflection: The missing review evidence was best supplied at the same boundaries as the
  requirements: HTTP authorization/error responses and rendered DOM text. The only production
  change was the independently reproduced client state-ordering defect.

## Issue #38 PR #49 Accessibility Follow-up (2026-09-24)

- Prompt summary: Clean the remaining Issue #38 PR #49 evidence hygiene failure and prepare the
  branch for re-review.
- What was done with output: Removed only the trailing blank lines from the three committed
  evidence logs that caused `git diff --check` findings; no application behavior changed.
- Validation: `git diff --check lab3-staging` and the working-tree check passed; focused Staff
  Detail and Queue tests passed **67/67**. A separate commit/push approval remains required.

- Prompt summary: Follow the implementation plan for the two remaining PR #49 blockers, verify
  the result, and update the PR/Issue tracking.
- What was done with output: confirmed-transition focus now targets the mounted Back to Queue
  control after the status render; Queue and Staff Detail owner lookup errors now use conditional
  `aria-describedby` associations; focused and full client tests were expanded and run.
- Validation: focused client tests passed **67/67**; full client suite passed **205/205** across
  16 files; client build passed. Final browser-level accessibility and release evidence remains
  assigned to Issue #42.

- Prompt summary: Implement the five remaining PR #49 review findings for Issue #38: separate
  mutation success from refresh failure, surface owner lookup failures, associate composer errors
  accessibly, align validation with trimmed length, and add requester comment regression coverage.
- What was done with output: Updated Staff Queue and Staff Detail degraded states, committed all
  successful staff mutation responses locally before refresh, added `aria-describedby` error
  associations, removed raw comment/note `maxLength`, added focused partial-success and
  boundary tests, and guarded asynchronous owner lookups against stale or unmounted responses.
- Validation: focused client tests passed **86/86**; full client suite passed **204/204** across
  16 files; client build passed; server suite passed **533/533** across 38 files; server build
  passed. README was reviewed and did not require a change. Lab 3 E2E remains #42-owned.
- Reflection: The important contract boundary is the mutation response, not the synchronization
  request that follows it. Keeping those states separate also makes the UI warnings truthful and
  keeps append-only results visible when a refresh is unavailable.

- Prompt summary: Fix the six remaining PR #49 blockers from the uploaded review for Issue #38.
- What was done with output: Separated mutation success from refresh failure for comments and
  Appears Resolved, distinguished Staff Detail 403/404/unexpected states, completed Queue
  responsive information access and associated labels, replaced the circular status-matrix
  expectation with an independent frozen matrix, and added Queue sorting/pagination/loading plus
  Staff Detail regression coverage.
- Validation: focused client App/Queue/Staff Detail tests passed 69 tests; focused Staff Detail API
  tests passed 41 tests; full client suite passed 187 tests; client/server builds and touched-file
  diagnostics reported no errors; server suite excluding migration passed 514 tests; responsive
  Playwright regression passed 129 tests across desktop/tablet/mobile after installing the declared
  `@playwright/test` dependency and Chromium. The migration harness reached its deliberate failure
  probes without a Vitest summary. Lab 3 E2E remains #42-owned.
- Reflection: The existing Queue renders desktop and mobile representations together in jsdom, so
  the new tests use the established `findAllByText` pattern while browser-level layout remains an
  E2E evidence concern.

## Issue #38 Review Remediation Entry (2026-09-23)

- Prompt summary: Implement the five remaining PR #49 review findings for Issue #38, update
  related documentation, double-check blockers, then commit and push.
- What was done with output: Updated the Staff Queue tablet and forbidden states, disabled status
  controls for unassigned Tickets, preserved focus across status refetches, added full 8x8 status
  matrix API coverage, updated `ui-spec.md` and `tests.md`, and verified focused tests and builds.
- Validation: focused client tests 52 passed; focused server Staff Detail API tests 41 passed;
  the server suite excluding the migration harness passed 514 tests across 37 files; client and
  server builds succeeded; touched-file diagnostics reported no errors. The migration harness
  stopped after its deliberate collision probe without a Vitest summary and was recorded as an
  environment/test-runner limitation.
- Reflection: The final review caught and restored the existing Created-column sorting behavior
  after the tablet class was added, showing why a diff review after green tests still matters.

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
## Issue #35 PR #46 Review Follow-up Entry (Round 7 — User.id sequence sync after a post-backfill-commit crash)

- Prompt summary: Follow the round-7 remediation plan: reproduce the "backfill committed, `setval`
  never ran" state, write the failing tests first, replace the inline `setval` with one idempotent
  sync that runs on every path, add a post-check guard, and regenerate the evidence.
- What was done with output:
  - **The defect.** `runBackfill()` committed the explicit-ID `User` inserts inside
    `$transaction(...)`, then ran `setval` afterwards, outside the transaction. The
    `backfill-complete` resume branch skips `runBackfill()` entirely, so a crash in that window
    left the sequence behind `MAX(id)` and nothing ever repaired it. The failure was silent: every
    migration check passed, and the first insert relying on `@default(autoincrement())` (the app's
    user creation, and the seed) failed later with `duplicate key … User_pkey`.
  - **Tests first (red).** Added a test-only hook `maybeFailAfterBackfillCommit()`
    (`MIGRATION_TEST_FAIL_AFTER_BACKFILL_COMMIT=1` + `NODE_ENV=test`, matching the existing
    `MIGRATION_TEST_FAIL_PHASE_C_AT` guard) called right after the `$transaction(...)` returns.
    Added `DB-MIG-11` (crash → assert the broken precondition → resume → auto-ID create returns
    max+1, then +2), `DB-MIG-12` (normal path), and `DB-MIG-13` (zero legacy requesters). All three
    were confirmed failing before the fix: DB-MIG-11 with the real `duplicate key … User_pkey`
    error, DB-MIG-12 with next value 6 instead of 5, DB-MIG-13 with next value 2 instead of 1.
  - **Fix.** Removed the inline `setval` from `runBackfill()` and added `syncUserIdSequence()`,
    called on **every** entry path immediately before Phase C. It uses the three-argument `setval`
    form so the next id is exactly `MAX(id) + 1` (and `1` on an empty table); the previous
    two-argument call skipped a value and wrongly started at 2 on an empty table.
  - **Guard.** `postChecks()` now reads `last_value`/`is_called` from `User_id_seq` and throws if
    the next value is `<= MAX(id)`, so removing the sync later fails loudly at migration time.
  - **Doc nit.** Corrected the `service.ts` comment: spec §9.3 defines `itPriority` as nullable
    with a default of `requestedPriority`, not "required".
  - **Documentation:** added `DB-MIG-11/12/13` to `docs/lab-03/tests.md` (marked Passed only after
    the runs), added the sequence re-sync paragraph to `README.md` §11.1, and regenerated the
    `artifacts/lab-03/issue-35/` evidence bundle at the final head.
- Reflection: The bug was a transaction-boundary mistake, not a logic mistake — the `setval` was
  correct in isolation but sat outside the atomic unit and was skipped entirely on the resume path.
  The right fix was not a second `setval` in the resume branch (which would still leave the crash
  window open) but one idempotent sync on every path, so any crash is repaired by the next run and
  already-broken databases are repaired too. The mutation check (removing the sync call) confirmed
  DB-MIG-11 fails without it, and the new `postChecks` guard made that failure loud rather than
  silent.

## Issue #37 — Authorization + Requester Migration / Regression

- **LLM used:** GitHub Copilot (DeepSeek V4.1 Flash) in VS Code agent mode.
- **Prompts (paraphrased):** "Create a worktree and branch from `lab3-staging` (pull first),
  then implement the issue-37 plan step by step"; "double-check the work using review-pr,
  then commit, push, and open the PR."
- **What the agent did:**
  - Verified the #35 dependency gate against actual branch content (not issue/Kanban state):
    `requireAuth`/`requirePasswordChanged`/`requireCsrf`, the `User`/`Role` model, the
    renamed `uploaderUserId`/`removedByUserId` columns, the preserved `isRemoved` column,
    and the DM-17 compatibility set with its integration-gate and grep-gate evidence.
  - Created `server/src/authorization.ts` with `requireRole`,
    `requireTicketReadAccess`, and
    `authorizeAttachmentReadByRoleOrRequesterOwnership`.
  - Retrofitted `module.ts`, `controller.ts`, and `service.ts` to authenticated identity,
    including the service-layer `{userId, role}` access-context refactor.
  - Removed the Dev-Requester mechanism (server + client) and deleted
    `server/src/requester-context.ts`.
  - Created the two frozen test files at their exact frozen paths and executed the
    #37-owned rows.
  - Performed the RR-04 Lab 2 regression audit and applied the mapping.
- **Human decisions consumed (not re-decided):** the frozen `res.locals.userId/role/
  mustChangePassword` convention; the fresh-User session-authority rule; Option A for the
  DM-17 handoff; the landed 5–120 / 10–2,000 validation limits; the frozen test-file paths.
- **Notable engineering judgment:**
  - The Lab 2 suites injected identity with a header and never exercised the session path.
    Rather than rewrite ~200 tests around real logins, the agent added a `testSeams`
    identity fixture (mirroring the repository's existing `testSeams` pattern) for the
    mocked suites, and real logins for the real-DB integration suites. The real
    authentication boundary is covered by #35's auth suite and by #37's frozen
    authorization/requester API tests, which use real logins.
  - The real-DB fixture (`registerSession`) snapshots and restores the `User` rows it
    mutates, because Lab 2 integration suites reuse the seeded requesters and the
    migration suite asserts on their original state. An earlier version was destructive
    and caused two migration-test failures; the fix was to make the fixture
    non-destructive rather than to relax the migration assertions.
  - Class (b) retirements were replaced with authenticated-identity assertions rather than
    deleted outright, and every change is recorded in
    `artifacts/lab-03/regression/lab2-test-audit.md`.
- **Reflection:** The largest risk in this issue was not the authorization logic but the
  regression surface: 205 Lab 2 server tests and 93 client tests failed at the cutover.
  Classifying each one before touching it (RR-04) was what kept the change honest — it
  forced a distinction between "this test asserts behavior we deliberately removed" and
  "this test caught a real break", and it prevented the tempting shortcut of deleting
  failing tests to reach green. The second lesson was that a test fixture which mutates
  shared seed data is a latent cross-suite bug; snapshotting and restoring the row is the
  correct fix, not weakening the downstream assertion.

## Issue #37 — Remediation Round (agent review follow-up)

- **LLM used:** GitHub Copilot (DeepSeek V4.1 Flash) in VS Code agent mode.
- **Prompts (paraphrased):** "Apply this remediation plan (B-1, B-2, N-1..N-6) on the same
  branch, then commit, push, and update the related docs and issue; the review came from an
  agent, so do not log it in `reviewer.md`."
- **What the agent did:**
  - **B-2:** aligned `docs/lab-03/api-spec.md` §11 with the landed bare-array attachment-list
    shape (decision D-18 / RR-02) and documented `removedByUserId` in §11/§14.
  - **B-1:** migrated the whole `e2e/lab-02/` Playwright suite from the removed Dev-Requester
    selector/header to real authenticated login, added a Playwright `globalSetup` that seeds
    two E2E Requester accounts (`mustChangePassword = false`), and extended the RR-04 audit
    with an E2E section and an extended grep gate.
  - **N-3:** gated the `testSeams.sessionIdentity` reads on `NODE_ENV === "test"` and added
    `UNIT-AUTHZ-02` proving the seam is inert in production.
  - **N-2:** reworded the `SEC-AUTHZ-07` claim to match the executed assertions.
  - **N-1:** captured raw server/client/E2E run output into `artifacts/lab-03/regression/`
    and wired the pointers into `cutover-gate.md` and `tests.md`.
  - **N-4/N-6:** corrected the stale README statements and removed the dead `.requester-select`
    CSS rule.
- **Notable engineering judgment:**
  - Migrating the E2E suite to a real login surfaced a genuine class (c) regression that no
    mocked test caught: `fetchCategories` read `payload.data` from an endpoint that returns a
    bare array, so the shell crashed as soon as it rendered for an authenticated user. Per the
    plan's rule ("a genuine regression means you fix the code, never the test"), the code was
    fixed and the client test mock was aligned to the same shape.
  - The direct-API ownership checks in `ownership.spec.ts` needed two identities authenticated
    at once; a single shared Playwright request context clobbers the first cookie on the second
    login, so each Requester gets its own isolated `request` context (separate cookie jar).
- **Reflection:** The remediation confirmed the same theme as the original issue — the
  dangerous surface is the one that is not exercised by mocked tests. The `fetchCategories`
  bug lived behind a login and only appeared once an authenticated session actually rendered
  the shell; the E2E migration was the first thing to drive that path. It also reinforced that
  a "test seam" that bypasses production gates is a liability unless it is provably inert
  outside the test environment, which is exactly what the N-3 guard adds.

## Issue #37 Review Follow-up Entry (Round 2 — My Tickets status/sort contract alignment)

- Prompt summary: Read the P2 finding that My Tickets diverges from the frozen Lab 3 filtering
  and sorting contract, fix the accepted status set and sort keys in the backend and frontend,
  add a clarifying note for the mismatched-`requesterId` behavior, extend `API-REQ-02`, update
  all related documentation, verify with the review-pr skill, then commit and push.
- What was done with output:
  - **P2 — status filter and sort keys (real defect, fixed in the code).**
    `server/src/controller.ts` now validates `status` against the full frozen `TicketStatus`
    enum instead of only `NEW`, and accepts the documented sort keys
    (`createdAt`/`ticketNumber`/`summary`/`status`/`priority`), keeping `requestedPriority` as a
    Lab 2 compatibility alias for `priority`. `server/src/service.ts` orders `status` by the
    logical workflow sequence and `priority` by `LOW < MEDIUM < HIGH` rather than
    alphabetically. `client/src/MyTickets.tsx` offers all eight statuses in the filter dropdown
    and makes the Requested Priority and Current Status columns sortable with the documented
    keys; `client/src/App.css` gained badge styles for the seven previously unstyled statuses.
  - **Scope decision — invalid-value behavior left unchanged.** The finding also proposed
    applying safe-default fallback to *all* invalid query values. That would contradict the
    frozen Lab 2 contract (`docs/lab-02/api-spec.md`; `tests.md` `API-MY-06`/`API-MY-07`), which
    classifies an out-of-enum `status`/`requestedPriority` and a malformed `categoryId` as
    `400 VALIDATION_ERROR` (nonexistent/inactive `categoryId` → `409 INACTIVE_REFERENCE`), and
    #37's plan locks "existing `getMyTickets` search/filter/sort/pagination behavior is
    preserved". The two classes are now documented explicitly in `api-spec.md` §8.
  - **`requesterId` clarification (documentation only).** Issue #37's checklist says a mismatched
    client-supplied `requesterId` must be "rejected"; the implementation **ignores** it and
    assigns ownership to the authenticated user — the frozen convention (unknown JSON properties
    are ignored; BR-03) and what `SEC-AUTHZ-01` asserts. `api-spec.md` §0 now states this
    explicitly and records that the implementation must not be changed without reconciling §0.
  - **Tests.** Extended the frozen `API-REQ-02` row with non-`NEW` status filtering, the five
    documented sort keys in both directions, logical-order assertions for `sort=status` and
    `sort=priority`, the retained `requestedPriority` alias, invalid-`sort` fallback, and the
    preserved `400` behavior for out-of-enum filter values. Added supplementary `UI-MY-08` for
    the frontend status dropdown and sort keys.
  - **Documentation:** updated `docs/lab-03/api-spec.md` (§0 requesterId clarification, §8 query
    semantics and invalid-value classes), `ui-spec.md` §5.4 (status filter and sortable columns),
    `tests.md` (`API-REQ-02` row + Results Log), and `reviewer.md` (Issue #37 review record).
- **Notable engineering judgment:**
  - The finding bundled a genuine contract mismatch (status set, sort keys) with a proposal that
    would have broken a frozen contract (safe defaults for filter enums). The two were separated:
    the mismatch was fixed in the code, and the proposal was declined with the Lab 2 authority
    cited and the distinction documented rather than silently applied.
  - `requestedPriority` was kept as an accepted sort alias rather than removed. The Lab 2
    contract and its real-DB tests sort by `requestedPriority`, so dropping it would have been a
    regression; the Lab 3 key `priority` was added alongside it.
- **Reflection:** The defect existed because the Lab 2 handler was carried forward verbatim while
  the Lab 3 contract widened the enum and the sort vocabulary. The `API-REQ-02` row was marked
  `Passed` on tests that only exercised `status=NEW` and the four legacy sort keys, so the gap was
  invisible to the suite — a reminder that a `Passed` row is only as strong as the values its
  assertions actually exercise.

## Issue #38 — IT Staff Ticket Operations

- **Scope implemented:** the IT Staff ticket-operations workflow end to end — the responsive
  Ticket Queue (`GET /api/staff/queue`), the Staff Ticket Detail (`GET /api/staff/tickets/:n`),
  ownership claim/reassign, IT Priority, the frozen status-transition matrix, Public Comments,
  Internal Notes, and the Requester "Problem Appears Resolved" indication (including the
  Requester Ticket Detail retrofit required by handout §8.2).
- **Single shared transition module (frozen Revision 7 Option B).** The transition matrix is
  authored exactly once at `server/src/ticket-status.ts` (pure, dependency-free). The server
  imports it normally; the client imports the *same source* through the absolute
  `@shared/ticket-status` Vite alias plus `server.fs.allow` and a narrow tsconfig `paths`
  mapping. There is no second hand-authored copy and no sync test. Both smoke gates were run
  before any feature code consumed the module: the server build emitted `dist/src/ticket-status.js`
  with the layout unchanged and booted; the client built, the dev server served the module with
  no `/@fs/` 403, and the runtime matrix behaved as frozen.
- **Atomic status transitions (Revision 10).** `applyStatusTransition` pre-validates for precise
  errors, then writes with a conditional `updateMany` guarded on the persisted from-state
  (`ticketNumber`, `ticketOwnerId`, `currentStatus`). A `count === 0` re-reads and classifies
  404 / 409 (unowned) / 409 (raced), so the frozen matrix holds under concurrency rather than
  only against a previously-read snapshot.
- **Owner error split (Revision 7; Rev 9 §17 resolution).** `setTicketOwner` follows the frozen
  order — ticket 404 → `ownerId` shape 400 → User lookup 409 (a nonexistent User is not an active
  IT Staff/Administrator, per `api-spec.md` §17) → eligibility 409 → plain last-write-wins UPDATE.
  No unassign operation exists.
- **Queue (M-38-3).** `getStaffQueue` mirrors `getMyTickets`'s raw-SQL style but binds `status`
  as `$n::"TicketStatus"` and `priority` (IT Priority) as `$n::"Priority"`; `sort`/`order` come
  only from the frozen allow-list. `parseQueueQuery` never throws — invalid values fall back to
  defaults and never return `400`.
- **Comments/Notes/appears-resolved.** One shared `validateCommentContent` (trim, whitespace-only
  rejected, 1–2,000 after trim) backs both. Author and timestamp are always server-derived;
  a client-supplied `authorId` is ignored. `setAppearsResolved` is a dedicated single-column
  update that can never touch `currentStatus`. Internal Notes never reach a Requester payload.
- **Requester Ticket Detail retrofit (M-38-1).** The Lab 2 Requester detail is the inline
  `view === "ticket-detail"` block of `client/src/App.tsx` (there is no separate component file).
  The shared `<CommentThread/>` and the "Problem Appears Resolved" control were inserted after the
  attachments section; the attachment upload/remove/preview logic and dialog focus handling were
  left untouched. The requester detail fetch was extended additively with `appearsResolved` and
  `publicComments` (optional in the client type so Lab 2 fixtures remain valid).
- **Tests.** New frozen files: `staff-queue.api.test.ts` (API-QUE-01/02),
  `comments-notes.api.test.ts` (API-STAFF-05/10, API-REQ-03, SEC-AUTHZ-02/08),
  `comments-notes.unit.test.ts` (UNIT-COMMENT-01), `staff-ticket-detail.api.test.ts`
  (API-STAFF-01..09), `StaffTicketQueue.test.tsx` (UI-QUE-01/02), and
  `StaffTicketDetail.test.tsx` (UI-STAFF-01/02). `requester.api.test.ts` was appended with
  API-REQ-04 (file created by #37; never renamed). Migrated Lab-2-shaped data assertions were
  added inside the existing frozen files (M-38-5).
- **Notable engineering judgment:**
  - The Lab 2 `AttachmentSection.test.tsx` "read-only ticket fields" assertion scoped its
    no-editable-inputs check to the whole `.ticket-detail` block. The new Public Comments compose
    box is an intentional addition, so the assertion was narrowed to the `.ticket-info` region —
    preserving the test's intent (ticket fields are read-only) without weakening it.
  - The requester detail response was extended additively rather than by adding a second fetch,
    keeping one round-trip and one source of truth for the detail screen.
- **Reflection:** the shared-module wiring was the highest-risk item because the repo has no
  `workspaces` field and the server tsconfig has no explicit `rootDir`. Running both smoke gates
  before writing feature code turned an empirical build risk into a verified fact, and the
  Option-B placement kept the server's emitted layout unchanged by construction.

## Issue #38 — Review-Driven Completion (Queue owner filter, Queue information, reassignment UI)

- **Prompt summary:** a review of PR #49 found three material gaps against the frozen contract —
  the Queue had no owner filter (`ui-spec.md` §5.6), the Queue did not expose Category or Last
  Updated (§5.6), and the Detail ownership control could only claim/reassign to the current user,
  not to another eligible owner (FR-16, §5.7). Close exactly those three gaps without redesigning
  the backend.
- **What was done with output:**
  - **Owner filter (B-01).** Added `ownerId` state to `StaffTicketQueue.tsx`, rendered a
    `Filter by owner` select, passed `ownerId` into the existing `fetchStaffQueue()` (the client
    type and serializer already supported it), reset to page 1 on change, and included it in
    Clear Filters. Filtering stays server-side so it combines with search/status/priority under
    the frozen AND semantics.
  - **Queue information (B-02).** Added `categoryName` to the queue response — the SQL projection
    now joins `Category` and the row mapping carries the name — and rendered Category and Last
    Updated on both the desktop table and the mobile card. The desktop table keeps the core
    columns and adds the two secondary ones, per §5.6's allowance for condensing secondary
    information.
  - **Reassignment (B-03).** Added an owner selector plus an Assign/Reassign action to
    `StaffTicketDetail.tsx`, submitting through the existing CSRF-protected
    `setTicketOwner()`. The "Claim / Reassign to me" convenience action is retained. On failure
    the selection is cleared and the detail is re-fetched, so the UI never shows an owner that
    was not persisted.
  - **Eligible-owner source (contract addition).** The frozen contract exposed no
    staff-accessible user list: `GET /api/admin/users` (§24) is Administrator-only and
    `GET /api/app/context` returns only the caller's own identity. Deriving owners from the queue
    rows would have made it impossible to assign a Ticket to a staff member who owns none, which
    would leave FR-16's "claim, **assign**, or reassign" only partially satisfied. A minimal
    read-only `GET /api/staff/owners` was therefore added, returning only `{id, name, role}` for
    active IT Staff/Administrators. It is recorded as `specification.md` §13 decision 20 and
    `api-spec.md` §17a under the closed-contract edge-case policy, and as the new `tests.md` row
    `API-OWN-01`. No frozen Test-ID meaning was changed.
  - **Tests.** Added `API-OWN-01` (eligibility, exclusion of Requesters/inactive users, no
    credential field, `403` for a Requester caller, `401` unauthenticated) and a `categoryName`
    assertion to `staff-queue.api.test.ts`; added owner-filter, combined-filter, Clear Filters,
    required-information (desktop + mobile), assign/reassign, and ineligible-owner-failure
    coverage to the two frozen UI test files.
  - **Results:** server suite **516 passed** across 38 files; client suite **153 passed** across
    14 files; both builds succeed.
- **Notable engineering judgment:** the backend was left as the final authorization boundary. The
  owner dropdown filters for UX only; `setTicketOwner` still rejects ineligible targets with
  `409 CONFLICT`, and the new endpoint grants no authority of its own. The contract addition was
  documented rather than made silently, because the Lab 3 contract is explicitly closed and
  additions must be recorded in the Assumptions and Decisions section.
- **Reflection:** the review's framing was correct — the backend already supported `ownerId`
  filtering and arbitrary eligible-owner assignment, so the work was completing the UI contracts
  and proving them with executable tests rather than redesigning anything. The one genuine
  contract gap was the eligible-owner source, and resolving it required an explicit, auditable
  documentation trail rather than a silent endpoint.

## Issue #38 — Review-Driven Fix (B-1: status change required the acting user to be the specific owner)

- **Prompt summary:** a second review of PR #49 found that `applyStatusTransition` required
  `ticket.ticketOwnerId === actingUserId`, i.e. only the Ticket's *specific* owner could change
  its status. The frozen contract grants "Perform permitted status changes" to the whole
  IT Staff/Administrator group (`specification.md` §6) and the Status Transition Matrix's
  validation column reads "Ticket owned" — non-null — not "owned by the acting user" (§7).
  Fix the behavior and close the test-coverage gap that hid it.
- **What was done with output:**
  - **Behavior fix.** `applyStatusTransition` now rejects only when `ticketOwnerId === null`
    (the genuine claim-before-status-change rule, §13 decision 14). The acting user is no longer
    required to be the Ticket's specific owner. The atomic conditional `updateMany` guard was
    narrowed to the persisted from-state (`id` + `currentStatus`) so it cannot re-introduce the
    same-actor restriction; the `count === 0` re-read classifies 404 / 409 (unowned) / 409
    (raced) as before. The now-unused `actingUserId` parameter was removed from the service
    signature and its controller call site.
  - **Ownership is never mutated by a status change** — the update still writes only
    `currentStatus`.
  - **Tests.** Added two cases to `API-STAFF-03` in `staff-ticket-detail.api.test.ts`: a
    *different* active IT Staff member, and an Administrator, each changing status on a Ticket
    owned by staff A — asserting `200`, the new status, and that `ticketOwnerId` is unchanged.
    These are exactly the cases the original suite never exercised (every prior transition test
    acted as the ticket's own owner).
  - **Contract clarification.** Recorded the resolved reading in `specification.md` §7 and §13
    decision 14, and in `api-spec.md` §19, so the narrower interpretation cannot be
    re-introduced silently. Updated the `tests.md` `API-STAFF-03` row to describe the added
    cross-actor coverage.
  - **Results:** `staff-ticket-detail.api.test.ts` **30 passed**; full server suite **518 passed**
    across 38 files; `tsc --noEmit` clean.
- **Notable engineering judgment:** the fix was verified to be a real regression test rather than
  a tautology — with the old service behavior temporarily restored, the new cross-actor case
  fails with `409` where `200` is expected. The contract was clarified rather than left
  ambiguous, because the Decision-free implementation rule requires an ambiguity to be resolved
  in the frozen documents rather than silently baked into `service.ts`.
- **Reflection:** the original implementation was defensible as "extra safety," but it narrowed a
  capability the Authorization Matrix grants to an entire role group, and the test suite's habit
  of always acting as the ticket's own owner meant no test could ever have caught it. The
  coverage gap, not the code, was the deeper defect.

## Issue #38 — PR #49 Review Follow-Up (49-B1..B4, 49-D1)

- **Prompt summary:** a review of PR #49 raised four actionable blockers plus one contract
  decision: (49-B1) Staff/Admin landed on the Requester `My Tickets` screen; (49-B2) the Staff
  Ticket Detail did not expose the Ticket's existing Attachments; (49-B3) `pageSize` did not
  implement the documented 1–50 clamp; (49-B4) the status confirmation modal lacked the required
  keyboard/focus behavior; (49-D1) the status-ownership contract needed an explicit decision.
- **What was done with output:**
  - **49-D1 — resolved, not coded around.** The frozen wording ("Ticket owned") and the
    Authorization Matrix grant status changes to the whole IT Staff/Administrator group, so the
    acting user need not be the Ticket's specific owner. The implementation already matched this
    after the earlier review fix; the decision was recorded in `specification.md` §7 and §13
    decision 14 and in `api-spec.md` §19, and is proven by the cross-actor `API-STAFF-03` cases.
  - **49-B1 — role-specific entry/routing.** `App.tsx` derives the initial view from the role
    and renders only role-permitted views, redirecting stale state to the role's initial view.
    Backend authorization was deliberately left untouched. Five new cases (UI-49-01..05) were
    added and verified to fail against the pre-fix behavior.
  - **49-B2 — Staff Detail Attachments.** `getStaffTicketDetail` now returns the Ticket's
    Attachments using the established `AttachmentData` shape; the Staff screen renders a
    read-only list with Preview/Download and no upload/remove controls. No new endpoint was
    created — the shared §11–§13 read routes are consumed as-is.
  - **49-B3 — `pageSize` clamp.** `parseQueueQuery` now clamps a well-formed integer to 1–50
    (`0` → `1`, `51`/`999` → `50`) while malformed input keeps the default of `10`. The frozen
    integer grammar `0|[1-9][0-9]*` was the key detail: `0` is well-formed and must clamp, not
    fall back.
  - **49-B4 — modal focus behavior.** The confirmation modal captures the invoking control,
    focuses inside on open, traps Tab/Shift+Tab, closes on Escape without calling the API, and
    restores focus on close.
  - **Results:** server suite **531 passed, 0 skipped** across 38 files; client suite
    **174 passed, 0 skipped** across 14 files; both builds succeed.
- **Notable engineering judgment:** for 49-B1 the fix was placed in navigation/rendering rather
  than by relaxing the Requester-only API authorization — the review explicitly warned against
  weakening the backend. For 49-B3 the temptation was to change the test to accept `10`; that
  would have laundered a contract violation, so the parser was fixed instead.
- **Reflection:** three of the four blockers were "the contract said X and the code did Y" —
  the recurring failure mode was implementing a plausible behavior instead of re-reading the
  frozen wording. The `pageSize` case is the clearest example: the code's "out of range → 10"
  was reasonable but directly contradicted the documented clamp.
