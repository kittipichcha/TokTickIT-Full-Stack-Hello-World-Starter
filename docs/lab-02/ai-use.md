# Lab 2 - AI Use and Reflection

**LLM/agent used:** GitHub Copilot (GPT-5.3-Codex)

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Compare Lab 2 specification and current project, identify viability and conflicts | Reviewed code and docs, then produced a gap analysis showing current implementation is still Lab 1 baseline while Lab 2 is largely planned work. |
| 2 | Update README for Lab 2 requirements | Rewrote README to show Lab 2 scope, current implementation status, setup, current runnable commands, and phased implementation order. |
| 3 | Align `docs/lab-02/tests.md` with current structure/tooling | Replaced test doc with a phased plan tied to actual repo paths and current Vitest tooling, plus a newest-first results log section. |
| 4 | Create `agent.md` with strict working rules | Added workflow policy covering approval gates, FR/BR/AC mapping, test logging, AI-use updates, branch/worktree and PR approval requirements, and function-level commit strategy. |
| 5 | Create five GitHub issues with requirement mapping | Created issues #11 to #15 for requirement+AI baseline, user login surrogate, ticket creation, my tickets, and attachment lifecycle, each with FR/BR/AC traceability and acceptance criteria. |
| 6 | Refine documentation, review issue text for complete correctness, and prepare baseline commit | Audited doc files, fixed Lab 2 header in reviewer.md, cross-linked issues #11-#15 with prerequisite chains and FR/BR/AC criteria, updated tests.md results log, and committed baseline function-by-function. |
| 7 | Update agent.md PR target branch policy | Updated agent.md to specify that `lab2-staging` (created from current head of `main`) is the PR target for feature branches, and `main` is reserved for final release PR. |
| 8 | Address PR #16 peer/Copilot review findings and reconcile specifications, tests, and naming | Completed AC-to-test traceability matrix in `tests.md`, resolved AC-16 inactive requester lifecycle, scoped `X-Dev-Requester-Id` header, froze 5,000,000 byte attachment limit, defined deterministic sorting, renamed `ai-use.md`, and added worktree policy to `agent.md`. |
| 9 | Fix the remaining PR #16 review findings and check related agent/issue contracts | Reconciled the commit approval policy, added explicit Ticket Date authority, expanded Test-DD BR and Ticket Detail UI coverage, and synchronized downstream issue ownership and mappings. |
| 10 | Apply the final PR #16 re-review contract fixes to the Lab 2 baseline docs | Updated the planned-test table to include `Expected Result` and `Final`, preserved the Category `createdAt` migration contract, added the missing direct BR scenarios, and cleaned the traceability mappings that were still conflicting with the create-ticket rule. |
| 11 | Compare the Lab 2 project contract with the Lab 02 handout and correct formatting gaps | Verified the documents against the handout, retained the already-complete assumptions section, renamed Test-DD headings to match the required table terminology, recorded factual PR #16 review evidence, and removed the local PDF-text extraction artifact. |
| 12 | Fix the PR #16 re-review findings for migration/seed ownership, attachment UI/API evidence, traceability, and audit relations | Updated the specification with forward-migration and idempotent-seed decisions, added concrete DB/seed test paths, split API reason validation from UI confirmation/cancel coverage, corrected BR-only AC mappings, defined all Attachment states, and moved the final release gate to dedicated GitHub Issue #18. |
| 13 | Tighten the Lab 2 contract into a decision-free agent specification and formalize requirement precedence | Added explicit no-invention and precedence rules to the agent contract and specification so a future agent must follow the Lab 2 requirement order instead of making unsupported design decisions. |
| 14 | Re-review PR #16 for full contract consistency | Synchronized numeric BR IDs, page normalization, Empty/No-Results semantics, attachment UI/test layering, inherited API errors, evidence paths, seed preservation, and attachment compensation decisions. |
| 15 | Review Lab 2 as a no-context implementation agent, then close the discovered contract gaps | Resolved contradictory Empty/No-Results semantics with unfiltered metadata; defined canonical API errors/parsing, attachment signature and filename rules, deterministic attachment ordering, and concurrent-write behavior; expanded planned test coverage. |
| 16 | Apply the second PR #16 re-review's remaining contract/test-evidence fixes | Merged the duplicate `BR-23` into `BR-23`/`BR-30`, froze Ticket Number sequence semantics and a canonical `error.code` table, froze the attachment storage-access/persistence-compensation invariant as `BR-31`, added cross-requester attachment ownership and exact `410`/preview test evidence, closed the BR-02/BR-10/BR-25 Test-DD gaps, and split API vs UI responsibility for Empty/No-Results proof. |
| 17 | Review whether the request/response contract and planned tests still leave implementation decisions open | Froze the validation bounds, UTC Ticket Date display format, Unicode comparison semantics, create-then-upload orchestration, attachment-list response shape, download filename headers, `400` field behavior, DELETE parsing, and planned-versus-passing test evidence status. |
| 18 | Check codebase against Kanban & Lab 2 spec and remove Lab 1 health check leftovers | Checked Kanban alignment for Issue #12, confirmed Lab 1 `/api/health` and "System Overview" / "Check System" UI were leftovers, removed them, and updated test suites to test the Application Shell and Requester Selection. |
| 19 | Fix REQUESTER_STORAGE_KEY undefined error, update agent.md working agreement, and create DB/UI integration tests | Added missing `REQUESTER_STORAGE_KEY` export to `client/src/api.ts`, updated `agent.md` with real DB and UI integration rules, created server database integration test and client storage integration test. |
| 20 | Remove all health check system and Lab 1 leftover artifacts from the codebase | Removed `.health-box` CSS from `App.css`, removed `GET /api/health` from server and README, removed health test files, cleaned up unused imports in `App.test.tsx`, and verified no health references remain across the codebase. |
| 21 | Fix agent.md section hierarchy, narrow Tests.md cross-reference rule, and clean up unused imports | Fixed duplicate `## 4` heading and misplaced `3.3`/`3.4` sections, narrowed the Tests.md rule to apply only to Lab 2 contract matrix tests (excluding legacy Lab 1 tests), and removed unused `fireEvent`/`waitFor` imports from `App.test.tsx`. |
| 22 | Fix BLOCKING ISSUE #2 — Large finite `page` values can still produce an unsafe SQL offset | Added `Number.isSafeInteger()` guard in the controller to reject pages beyond the safe integer range; added early return in the service to return empty data with correct metadata when `page > totalPages` without executing a giant SQL `OFFSET`; added test cases for `MAX_SAFE_INTEGER`, `MAX_SAFE_INTEGER + 1`, large finite decimal strings, and overflow scenarios. |

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Aligning test documentation to real folder/tooling early prevents command drift and broken CI expectations later.
3. Splitting Lab 2 into focused issues with explicit prerequisite links improves branch discipline and review quality.
4. Resolving contract edge cases and establishing complete AC-to-test traceability during specification prevents downstream implementation churn.
5. Checking the process agreement and downstream issue mappings alongside the feature contracts prevents a local documentation fix from creating conflicting delivery rules.
6. A handout-alignment audit is most useful when it distinguishes present contract evidence from future implementation and final-submission evidence instead of implying unfinished work has passed.
7. A requirement baseline should freeze migration decisions and evidence ownership explicitly; a final release gate belongs to an integration issue that can remain open across downstream implementation work.
8. A decision-free requirement contract is essential for future agent work: when the contract is closed and precedence is explicit, the agent no longer needs to improvise behavior outside the approved scope.
9. Cross-document contract reviews must verify identifiers, edge cases, test layers, and evidence records together; a locally correct addition can still leave contradictory downstream wording.
10. A closed implementation contract needs explicit parsing, error-body, concurrency, and state-disambiguation rules; otherwise different correct-looking implementations and test suites still diverge.
11. Reusing the same rule ID for two different rules is as dangerous as an outright contradiction, since every citing test row silently inherits the ambiguity until the ID collision itself is fixed.
12. A closed contract must define exact response envelopes and transport headers, not only endpoint intent; planned test rows must also distinguish specified coverage from executed evidence.
13. Combining unit testing with live database integration tests and explicit UI storage persistence tests ensures end-to-end reliability across both backend database queries and frontend state transitions.
14. Removing legacy artifacts requires a systematic grep-based verification across all source directories to ensure no stale references remain — a single missed import or CSS class can silently break the build.
15. A governance change in agent.md that conflicts with the current repository state (e.g., a mandatory rule that existing files cannot satisfy) must be scoped correctly or it will immediately fail its own requirement; narrowing the rule to the relevant subset of files avoids false positives from intentional legacy files.
16. A safe-integer guard is necessary for any numeric input that could produce a large SQL offset, even when the `Infinity` case is already handled — `Number.isSafeInteger()` catches values that are finite but exceed JavaScript's precise integer range, preventing silent data corruption and runaway database queries.

## Issue #12 Implementation Entry

- Prompt summary: Implement Lab 2 Issue #12, Development Requester Selection and Context Switching, from the documented FR/BR/API/UI/test contract in a new worktree.
- What was done with output: Inspected the refreshed `lab2-staging` baseline, added the `DevRequester` schema/migration/seed data and active-requester API, implemented strict requester-context middleware and client session handling, built the selector and shell switching flow, and added focused API/UI tests.
- Reflection: The baseline has no requester-owned ticket endpoints yet, so context validation was implemented as a reusable boundary and tested through a protected fixture route. The evidence log distinguishes fully exercised selector behavior from context behavior awaiting downstream ticket resources.

## Issue #12 Integration & Reference Fix Entry

- Prompt summary: Fix `REQUESTER_STORAGE_KEY is not defined` error, update `agent.md` with integration testing rules, and create database & UI integration tests.
- What was done with output: Defined `REQUESTER_STORAGE_KEY` export in `client/src/api.ts`, added section 3.2 to `agent.md`, created `server/tests/lab-02/requester-selection.integration.test.ts` for live PostgreSQL assertions, created `client/src/lab-02-tests/RequesterSelection.integration.test.tsx` for component storage integration, and updated test logs.
- Reflection: Having explicit rules in `agent.md` for live DB integration tests and UI storage persistence ensures all agents follow identical validation standards without breaking test seed data or mocking critical client storage.

## Issue #12 Re-review Fixes Entry

- Prompt summary: Fix the PR #21 re-review blockers: scope-truthfulness, X-Dev-Requester-Id header assertion, keyboard Change Requester activation, README overstatement, and add an agent.md rule to read requirements/issue before planning.
- What was done with output: Added `dev-requesters.service.test.ts` proving the active-filter query; captured fetch `init` headers in the integration test and asserted `X-Dev-Requester-Id === "1"`; added a keyboard-only Change Requester activation test; rewrote `tests.md` §5.1 to state that Issue #12 is not yet complete rather than redefining its required rows as downstream-owned; corrected README wording and test counts; added a step-0 rule to `agent.md` requiring the agent to read governing docs and the issue before planning.
- Reflection: Evidence truthfulness is as important as implementation correctness. Marking matrix rows `Passed` without the executable evidence for every part of their contract creates false confidence. The header-proof gap (mock returned success regardless of whether the header was actually sent) demonstrated how a test can be structurally sound yet miss its core behavioral assertion.

## Issue #12 Scope Amendment Entry

- Prompt summary: Amend Issue #12 to remove cross-feature acceptance rows that depend on downstream models/endpoints/screens, redistribute them to #13/#14/#18, and check #13-#15 for similar over-scoping.
- What was done with output: Read all five Lab 2 issues; determined only #12 was over-scoped. Amended #12 to remove `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, `E2E-05` from its required tests and acceptance criteria. Added `API-REQ-03` + `GET /api/related-systems` to #13. Added `API-REQ-02`, `UI-MY-03`, and BR-29 to #14. Added `API-CONTRACT-01`, `E2E-05` to #18. Rewrote `tests.md` §5.1 from "incomplete" language to a truth-table of redistribution. Updated README accordingly.
- Reflection: Issue scoping should follow feature-implementation order closely. When a test row depends on a model or endpoint that won't exist until a later issue, it belongs in that later issue. The fix was straightforward because #13/#14/#15 were already properly scoped to their own features — only #12 had been written before the full implementation dependency graph was clear.

## Issue #13 Scope Amendment Entry

- Prompt summary: Amend Issue #13 to remove attachment orchestration scope and move it to Issue #15, update tests.md redistribution table, and align all downstream issue ownership.
- What was done with output: Removed attachment panel, multi-file upload, and Case B partial-success UI from #13 scope. Reassigned `UI-TKT-06` and `UI-TKT-08` from #13 to #15. Updated #13 and #15 on GitHub with corrected scope, requirement mappings, and acceptance criteria. Added `tests.md` §5.2 documenting the redistribution. Added results log entry.
- Reflection: The attachment orchestration (pre-submit file validation panel, sequential upload after ticket creation, Case B partial-success UI) depends on the full attachment endpoints (`POST /api/tickets/:ticketNumber/attachments`, etc.) and storage infrastructure that only exist in #15. Keeping them in #13 would have created an untestable dependency. The split is clean: #13 owns the ticket creation form with text fields and reference selects; #15 owns everything file-related including the attachment panel on the create form.

## Issue #13 PR #25 Review Fixes Entry

- Prompt summary: Fix all P1 and P2 findings from the PR #25 review against the Issue 3 (Ticket Creation Flow) implementation.
- What was done with output:
  1. **P1 — Atomic ticket-number + ticket creation**: Rewrote `createTicket()` to use `prisma.$transaction()` with a single authoritative database timestamp (`SELECT NOW()`), moved category/related-system validation inside the transaction, and used `allocateTicketNumberWithClient()` to ensure sequence allocation rolls back if ticket insertion fails.
  2. **P1 — View Ticket opens Ticket Detail**: Added `fetchTicketDetail()` to `client/src/api.ts`, added `ticket-detail` view to `AppView`, implemented loading/error/not-found states, and wired `handleViewTicket` to navigate to the detail view instead of returning home.
  3. **P1 — JSON request-parsing contract**: Added `Content-Type: application/json` enforcement, non-null object body validation, and array/primitive rejection in `createTicketHandler()` returning canonical `400 VALIDATION_ERROR`.
  4. **P2 — Attachment removal metadata**: Added `removedAt`, `removalReason`, `removedByRequesterId` to `AttachmentData` interface and Prisma select in `getTicketByNumber()`.
  5. **P2 — Ticket indexes**: Added `@@index([requesterId])`, `@@index([currentStatus])`, `@@index([createdAt])` to the Ticket model and created migration `20260826000000_add_ticket_indexes_attachment_relations`.
  6. **Schema fixes**: Added `@unique` on `storedFilename`, `@@index([ticketId])` on Attachment, and `uploaderRequester`/`removedByRequester` relations to `DevRequester`.
  7. **Test updates**: Updated `api-contract.api.test.ts` to test against `POST /api/tickets`; updated `ticket-detail.api.test.ts` to include removal metadata; added index assertions to `database-migration.integration.test.ts`.
  8. **Documentation**: Updated `README.md`, `tests.md`, `ai-use.md`, and `reviewer.md`.
- Reflection: The review identified critical contract violations that were invisible in the mocked test suite. The atomic transaction fix is the most impactful — without it, sequence gaps and year mismatches would silently violate BR-01. The JSON parsing contract enforcement prevents `TypeError` crashes from non-object bodies. The View Ticket fix completes the create-to-detail flow that was stubbed out. All changes are backward-compatible with the existing test suite.

## Issue #14 Implementation Entry

- Prompt summary: Implement Lab 2 Issue #14, My Tickets feature, from the documented FR/BR/API/UI/test contract.
- What was done with output: Implemented `GET /api/tickets` endpoint with search, filter, sort, pagination, and ownership enforcement. Added `getMyTickets()` service function with Prisma query supporting case-insensitive substring search, conjunctive category/priority/status filters, deterministic sort with tie-breakers, and pagination with `unfilteredTotalItems`. Created `MyTickets.tsx` frontend component with sortable table, mobile card layout, loading/empty/no-results/error states, pagination footer, and requester-switch data reset. Added `format.ts` with `formatUtcDate()` and `formatFileSize()` utilities. Wrote `my-tickets.api.test.ts` (8 API test suites) and `MyTickets.test.tsx` (5 UI test suites). Updated `tests.md` traceability matrix with `Passed` status for all My Tickets rows.
- Reflection: The My Tickets feature was well-specified with clear BR-22/BR-23/BR-30 rules for sort defaults, search normalization, and Empty/No-Results semantics. The `unfilteredTotalItems` distinction was critical for correct UI state rendering. The out-of-range page navigation (redirect to last valid page) required careful state management to avoid infinite re-render loops.

## Issue #14 BLOCKING ISSUE #1 Fix — Exact Response-Shape Assertion Entry

- Prompt summary: Fix BLOCKING ISSUE #1 — Replace `toMatchObject()` with exact `Object.keys(item).sort()` assertion in the My Tickets response-shape test so the test fails if any undocumented field is added to the API response.
- What was done with output: Replaced `toMatchObject()` with `expect(Object.keys(item).sort()).toEqual(DOCUMENTED_KEYS)` in `my-tickets-real-db.integration.test.ts`. Removed redundant individual `not.toHaveProperty()` checks. Verified 55/55 My Tickets real-DB tests and 256/256 full lab-02 server tests pass.
- Reflection: `toMatchObject()` only checks that documented properties exist — it does not fail when undocumented properties are added. An exact key-set assertion using `Object.keys().sort()` is the correct approach for response-shape verification, as it enforces both completeness and the absence of extra fields.

## Issue #14 Review Fix — Stale-Response Protection Entry

- Prompt summary: Fix BLOCKING ISSUE #1 — Stale My Tickets requests can overwrite newer results. Add a monotonically increasing request sequence ID (`useRef`) to guard against stale async responses. Apply the same guard to error-state updates. Add a UI test (`UI-MY-07`) that uses deferred promises to verify the race condition is resolved.
- What was done with output: Added `requestSeqRef` (useRef) to MyTickets.tsx, incremented before each `loadTickets()` call, and checked `seqId !== requestSeqRef.current` after fetch resolves (and again after potential `setPage` redirect) before updating state. Error-state updates are also guarded. Added `UI-MY-07` test verifying that a slow request A (search="old") resolving after fast request B (search="new") does not overwrite the newer result. All 15 tests pass. TypeScript: 0 errors.
- Reflection: The `useRef`-based request sequence ID approach is lightweight and avoids the complexity of `AbortController` (which could introduce a separate problem where aborting an obsolete request incorrectly triggers the error handler). The guard-after-setPage pattern was necessary because the out-of-range redirect triggers a new `loadTickets` via state change, which invalidates the current request's sequence ID before it can proceed to update state. The deferred-promise test pattern is a clean way to verify race conditions in unit tests without introducing arbitrary timers.