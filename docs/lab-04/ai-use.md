# Lab 4 — AI Use and Reflection

## Issue #51 Actions Taken foundation (2026-10-01)

- Prompt summary: implement the approved Issue #51 Actions Taken persistence/API foundation in `feature/lab4-actions-taken-foundation`, commit feature-by-feature, push it, and prepare a PR targeting `lab4-staging`.
- Agent used: GitHub Copilot.
- Work performed: added additive Action persistence and migration/recovery fixtures, authorized Action list/detail/create/update APIs with idempotency and concurrency handling, marker-owned seed Actions with immutable terminal revisions, and focused integration tests. The UI, Ticket workflow, dashboards, and final release work remain deferred.
- Verification: DB-MIG-01/02/03 passed (3 tests), DB-MIG-04 passed within the 26-test Lab 3 migration suite, Actions API/security/concurrency passed (18 tests), DB-SEED-01 passed (2 tests), Prisma validation/build passed, and full server regression passed with 42 files and 628 tests.
- Reflection: keeping persistence, API, seed, and evidence commits separate made each acceptance gate independently reviewable and exposed the missing seed slice before publishing.

## Issue #50 review-blocker fixes (B1–B3) and N1 release follow-up (2026-10-01)

- Prompt summary: fix the blocking review findings on the Lab 4 contract — Test DD authorization coverage (B1), the retired Lab 2 identity mechanism in `agent.md` (B2), and the contradictory `Planned` test-file rules (B3) — and record the non-blocking `ai-use.md` curation as a release follow-up (N1).
- Agent used: GitHub Copilot.
- Work performed: extended planned `API-DASH-01`, `API-DASH-02`, `SEC-ACT-01`, and `API-WF-04` with explicit AC-08/AC-18 authorization assertions and updated the AC-08/AC-18 coverage mappings; rewrote `agent.md §3.3` around authenticated Lab 3/4 identity and removed the retired Lab 2 `REQUESTER_STORAGE_KEY`/Dev-Requester requirements; froze one status-aware `Planned`/`Implemented`/`Passed` file rule across `agent.md §3.1`, §4.2, and §4.3; and added the final `ai-use.md` curation (6–10 key prompts plus “My Reflection”) to the specification release gate as an Issue #6 follow-up. No runtime implementation or executable Lab 4 test changed.
- Verification: `git diff --check` passed with only an LF-to-CRLF normalization notice. The inline audit passed: 41 unique `Planned` rows, AC-01 through AC-27 mapped, AC-08 and AC-18 mappings updated, and the three `agent.md` rules consistent. Executable tests: **0 run / 0 passed / 0 failed / 0 skipped**.
- Reflection: a nominal AC-to-test ID mapping is not coverage; the planned rows must name the exact authorization assertions, and a working agreement must not mandate a mechanism the frozen baseline removed.

## Issue #50 governance acceptance and AC-03 coverage correction (2026-10-01)

- Prompt summary: record the peer reviewer's acceptance of the `agent.md` workflow exception from direct discussion with the author, and correct the AC-03 coverage table.
- Agent used: GitHub Copilot.
- Work performed: recorded the scope acceptance in Issue #50 and PR #58, updated `specification.md` and `reviewer.md` to state that the `agent.md` exception was accepted off-platform on 2026-10-01 while formal GitHub PR approval remains pending, and retained the AC-03 mapping to `API-ACT-04`, `API-ACT-06`, and `UI-ACT-01`. No runtime implementation or executable Lab 4 test changed.
- Verification: `git diff --check` and focused governance/AC-03 traceability/status audit; all 41 Lab 4 rows remain `Planned`; AC-01 through AC-27 remain mapped. Executable tests: **0 run / 0 passed / 0 failed / 0 skipped**.
- Reflection: scope acceptance and formal PR approval are separate governance states; the reviewer record should state the off-platform scope acceptance while keeping the five GitHub reviews `CHANGES_REQUESTED` and formal re-review pending.

## Issue #50 PR #58 B2/B4 traceability correction (2026-10-01)

- Prompt summary: resolve the remaining AC-03/API-ACT-06 traceability gap and remove duplicated #5374801503 findings from the preceding human-review section.
- Agent used: GitHub Copilot.
- Work performed: extended AC-03 with the preserved ineligible-assignee state and explicit PATCH repair/clear rule; mapped `API-ACT-06` to `AC-03` and `BR-03`; and retained the three #5374801503 responses only under their dedicated heading. No runtime implementation or executable test changed.
- Verification: `git diff --check` and focused traceability/reviewer-section audits passed. All 41 Lab 4 rows remain `Planned`; AC-01 through AC-27 remain mapped; final GitHub PR approval remains absent. Executable tests: **0 run / 0 passed / 0 failed / 0 skipped**.
- Reflection: keeping the transition in the authoritative AC as well as the planned API row prevents the implementation contract from splitting across documents.

## Issue #50 PR #58 B2–B4 contract revision (2026-10-01)

- Prompt summary: follow the supplied Issue #50 revision plan for temporal Action-assignee validity, explicit Action authorization/validation/UI Test DD coverage, and accurate human-review evidence.
- Agent used: GitHub Copilot.
- Work performed: made the intentional `agent.md` Lab 4 workflow inclusion explicit, pending its off-platform acceptance report; aligned `specification.md`, `api-spec.md`, and `ui-spec.md` on the assignee lifecycle; expanded existing Action API/security/UI rows without adding test IDs; and moved the cross-layer consistency-gate item out of human-review feedback. No runtime implementation, schema, migration, database operation, or executable test changed.
- Verification: documentation-only checks must confirm `API-ACT-01`, `API-ACT-04`, `API-ACT-06`, `API-ACT-DETAIL-01`, `SEC-ACT-01`, `SEC-ACT-02`, and `UI-ACT-01` remain `Planned`, all 41 rows are unique, AC-01 through AC-27 remain mapped, and formal GitHub PR approval is not claimed. Executable tests: **0 run / 0 passed / 0 failed / 0 skipped**.
- Reflection: separating assignment-time eligibility from later account lifecycle changes gives the implementation one deterministic repair path without rewriting historical/current Action state.

## Issue #50 PR #58 human review #5374801503 response (2026-10-01)

- Prompt summary: address the fifth human Changes Requested review and reconcile the local contract and evidence with PR #58's live body and submitted reviews.
- Agent used: GitHub Copilot.
- Work performed: clarified global Action-read authorization for Staff/Admin and owned-Ticket Requester reads; replaced the global non-negative integer wording with endpoint-owned positive/range constraints; recorded review #5374801503 and the live PR-body state; and added the requested final cross-layer consistency sweep to the available local `review-pr` skill draft. No runtime implementation, migration, schema, Test DD row, or executable test changed.
- Verification: `git diff --check` and focused audits confirm both Action GET endpoint rules and the authorization matrix agree with §1; endpoint-specific pagination, version, owner, and assignee constraints remain intact; all 41 Test DD rows remain `Planned`; AC-01 through AC-27 remain mapped; five live reviews are `CHANGES_REQUESTED`; and the live PR body says human review remains pending with no runtime implementation. Executable tests: **0 run / 0 passed / 0 failed / 0 skipped**.
- Reflection: explicit cross-layer gates make a global-versus-endpoint contradiction harder to miss during the final review pass.

## Issue #50 PR #58 human review #5374244874 record update (2026-10-01)

- Prompt summary: record the fourth human Changes Requested review on PR #58 and summarize the contract responses already present at head `473972d791f4787516fc50d5b8172bab535c198b`.
- Agent used: GitHub Copilot.
- Work performed: added @oangsa review #5374244874 and its verdict/link to the human review record; summarized exact owner/priority/status `expectedVersion` shapes, security/validation Test DD coverage, status-history UI pagination, and FR-02/BR-25 consistency. No runtime implementation or executable tests changed.
- Verification: `git diff --check` passed with only LF-to-CRLF normalization notices. Node.js inline focused review-record/response audit passed: all four review IDs and verdict summary present, all requested response topics recorded, 41 unique rows all `Planned`. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
- Reflection: the human-review record now agrees with the four submitted review events while preserving the approval gate.

## Issue #50 independent agent-review follow-up (2026-10-01)

- Prompt summary: resolve remaining independent agent feedback for the Issue 50 worktree; this feedback is not attributed to the human peer reviewer.
- Agent used: GitHub Copilot.
- Work performed: made `agent.md` requirements, test alignment, branch/worktree, PR target, and Standard Task Flow rules owning-Lab-aware; extended planned Test DD rows `API-ACT-02`, `API-ACT-06`, and `API-DASH-02` with canonical idempotency, PATCH validation, and Queue filter-exclusion assertions. The feedback was not added to the human-only `reviewer.md`. No runtime implementation or executable tests changed.
- Verification: `git diff --check` passed with only LF-to-CRLF normalization notices. Node.js inline focused ownership/API contract audit passed: Lab-specific docs/branches, three human review IDs, B6 assertions, and 41 unique rows all `Planned`. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
- Reflection: mapping the document set and integration branch to the owning Lab prevents a Lab 4 task from following a valid-looking but incorrect Lab 3 route.

## Issue #50 PR #58 current-head re-review refinement (2026-10-01)

- Prompt summary: implement the review findings for current PR head `86d5a57921d525668eb6bf5ee9d6e759b1bc810e`, including the exact Ticket concurrency API shapes, missing planned security/validation assertions, and status-history UI pagination.
- Agent used: GitHub Copilot.
- Work performed: froze additive owner/priority/status `expectedVersion` request and response shapes while retaining Lab 3 omission compatibility; expanded planned tests for CSRF, Action idempotency-key and text bounds, Action pagination, dashboard filter validation, and exact workflow responses; specified status-history page navigation; aligned FR-02 and BR-25 wording. No runtime implementation or executable tests changed.
- Verification: `git diff --check` passed with only Git line-ending notices. The focused inline contract audit passed: all required review details are present, all 41 test rows remain `Planned`, and AC-01–AC-27 remain mapped. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
- Reflection: stating endpoint bodies and responses alongside compatibility assertions prevents later implementation from choosing a different version transport or response location.

## Issue #50 PR #58 contract re-review refinement (2026-09-30)

- Prompt summary: complete the specified contract refinements, clarify Lab-specific peer-review logging, and record current local verification without claiming remote PR publication or human approval.
- Agent used: OpenAI Codex.
- Work performed: clarified complete Ticket-state preservation for same-status conflicts; froze expired-key replacement behavior at exact expiry; specified fixed-size Actions pagination and page-boundary behavior; sharpened planned API/UI assertions; routed Lab 3 and Lab 4 review records to their owning directories; and changed the PR-body text to a local unpublished proposal. No runtime code or executable tests changed.
- Verification: `git diff --check` and the seven-path allowlist passed. The corrected matrix audit found 41 unique rows, all `Planned`, with AC-01–AC-27 mapped. The corrected whitespace-normalized cross-document audit passed after an earlier checker failed on line-wrapped Markdown. No Lab 4 executable tests were run. The proposed PR-body replacement remains unpublished.
- Reflection: whitespace-normalized checks handle wrapped Markdown without requiring edits to correct prose.

## Issue #50 PR #58 human-review revision (2026-09-30)

- Prompt summary: resolve the latest human review findings, record all human reviews, update the PR verification wording, and fix identified test traceability.
- Agent used: OpenAI Codex.
- Work performed: clarified same-value owner/priority writes versus forbidden same-status writes in BR-30, API §7, AC-27, and `API-WF-04`; defined Actions Taken pagination and its planned UI assertion; made expired-key behavior a fresh atomic create; corrected forged performer/time test expectations; updated Lab 4 test ownership and API detail AC coverage; recorded all three `@oangsa` reviews. No runtime code or executable tests changed.
- Verification: the earlier pass recorded documentation-only consistency checks and `git diff --check` in `docs/lab-04/tests.md`; this local revision adds a separate entry for checks actually run. No executable tests were run. The proposed PR-body replacement remains local and unpublished.
- Reflection: exact write outcomes, page navigation, and ownership make planned tests deterministic and reduce implementation choices.

## Issue #50 PR #58 re-review contract revision (2026-09-29)

- Prompt summary: resolve remaining uncertainty in role navigation, staff dashboard response and Action destinations, Action completion/cancellation and inactive-assignee behavior, status-history authorization, schema indexes/idempotency expiry, and final hardening evidence.
- Agent used: OpenAI Codex.
- Work performed: froze exact role navigation, active parent, and mobile-menu behavior; specified all eight status and three priority mappings; separated Action metric counts from per-Action destinations; defined same-Ticket complete/cancel outcomes and inactive-assignee HTTP 409 with no mutation and retained inputs; clarified status-history access and non-null-owner requirement; listed exact non-Ticket indexes, unique idempotency constraint, bounded expiry cleanup, and no new Ticket indexes; expanded planned UI/E2E assertions, including the ordered E2E-01 sequence of inactive-assignee rejection while B is Pending, blocked resolution while Actions remain Pending, completion of A, cancellation of B, and successful resolution; and added planned `HARDEN-01` for all five README rehearsal procedures. The supplied review excerpt did not establish reviewer provenance, so no human-review attribution was added. No runtime, schema, migration, or executable test changed.
- Verification: `git diff --check` passed; API JSON parse/key/destination audit passed; persistence/index/cleanup/authorization audit passed; 41-row Planned matrix, all 27 AC mappings, and exact five-path allowlist audits passed. No executable tests, browser, Prisma, migration, or database restore were run.
- Reflection: defining visible destinations and persistence constraints with test evidence reduces implementation choices that affect behavior.

## Issue #50 migration fixture contract revision 3 (2026-09-29)

- Prompt summary: close ambiguity in the Lab 3 Prisma fixture override validation and specify tests for both isolated historical and full normal migration paths.
- Agent used: OpenAI Codex.
- Work performed: required exactly `NODE_ENV=test`, a verified fixture-root historical schema override, and a safe disposable URL; specified rejection before Prisma execution for invalid environments, paths, URLs, or missing `--schema`. Added explicit unset of the override before normal migration history, server-local Prisma status/deploy commands, and pending/up-to-date expectations. Extended planned `DB-MIG-04`. No application, database, migration, or executable test was changed.
- Verification: `git diff --check` passed. PowerShell fixture contract audit passed; 40 unique Lab 4 test rows remain `Planned`; AC-19 maps DB-MIG-01/02/03/04 and DB-SEED-01. No executable test, Prisma command, database restore, or attachment operation was run.
- Reflection: testing rejection and normal deployment paths makes schema isolation and standard migration behavior independently verifiable.

## Issue #50 migration continuity contract (2026-09-29)

- Prompt summary: freeze migration recovery and define database, function, and test continuity from Lab 3 to Lab 4.
- Agent used: OpenAI Codex.
- Work performed: documented the verified Lab 3 Phase A/backfill/Phase C prerequisite; paired full PostgreSQL and attachment snapshots; separate-database restore rehearsal; pre-write paired restore; post-write forward recovery; preserved Lab 3 routes/functions; dashboard navigation continuity; and prior-lab test execution/adaptation rules. Added planned `DB-MIG-03` and mapped AC-19 to migration, recovery, and seed coverage. No application/database/test implementation was changed.
- Verification: `git diff --check` passed. PowerShell contract audit passed with 39 unique Planned test rows, complete AC-19 mapping, one recovery strategy, and no runtime-path changes. No executable tests, migration, database restore, or attachment operation was run.
- Reflection: defining the accepted-write boundary removes the unsafe choice between restoring stale snapshots and preserving newly accepted Lab 4 data.

## Issue #50 PR #58 human-review revision (2026-09-29)

- Prompt summary: revise the Lab 4 documentation contract and log routing in response to human
  review #5341087376 on PR #58.
- Agent used: OpenAI Codex.
- Work performed: specified Staff/Admin status history, shared Ticket version concurrency,
  durable normalized Action-create idempotency, Action detail coverage, canonical Ticket example,
  and a deterministic dashboard performance threshold. Added AC-26/27 and Planned test rows,
  documented the six review responses with re-review still pending, and routed Lab 4 logs to
  Lab 4 documents while preserving historic Lab 3 evidence. No product code or executable tests
  were changed.
- Verification: documentation-only diff, allowlist, endpoint/identifier/status, and Planned-row
  checks are recorded in `docs/lab-04/tests.md`. No executable tests were run.
- Reflection: explicit version and idempotency rules make retry and concurrent-write behavior
  testable without claiming implementation evidence.

## Issue #50 contract drafting (2026-09-27)

- Prompt summary: coordinate Issue #50 documentation work from `SE+Lab+4.pdf` and the existing
  Lab 4 drafts; complete four Lab 4 contract files; preserve Lab 3 behavior and log only this
  documentation audit in Lab 3 records.
- Agent used: OpenAI Codex.
- Work performed: copied the user-provided Lab 4 specification and planned test draft into the
  issue worktree, reconciled them with the integrated Lab 3 contracts and the Issue #50 scope,
  and drafted API/UI contracts. Recorded server-set Pending Action status, immutable Action
  revisions and Ticket status history, Reopened-to-In Progress, compatible optional
  `expectedVersion` on the status API with mandatory use by the Lab 4 UI, and dashboard filter
  and drill-down behavior. Added planned tests for status-version compatibility and dashboard
  filter predicates. No product code or executable test files were changed.
- Verification: documentation-only checks recorded in `docs/lab-04/tests.md`; no executable
  tests were run. Human contract review remains pending in `docs/lab-04/reviewer.md`.
- Reflection: explicit request/response shapes and history rules reduce implementation choices
  that could otherwise diverge between API, UI, and tests.
