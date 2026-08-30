# Lab 2 — Peer Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha
**Peer reviewer:** SUTHANG SUKRUEANGKUN — 67070503477 — GitHub: @oangsa


## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#16 — docs(lab-02): add requirements, specifications, and agent workflow](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/16) | `doc/lab-02/requirement_and_agent` | Pending |
| [#21 — Feature/lab2 requester selection](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/21) | `feature/lab2-requester-selection` | Pending |
| [#23 — Remove all health check system and Lab 1 leftover artifacts](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/23) | `feature/issue-22-remove-health-check` | Approved (2026-08-25) |
| [#25 — feat: Lab 2 Issue 3 - Ticket Creation Flow](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/25) | `feature/lab2-ticket-creation` | Approved |
| [#28 — feat: implement My Tickets feature](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/28) | `feature/lab2-my-tickets` | Approved |
| [#29 — feat: Issue #15 — Attachment Lifecycle & Ticket Detail](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/29) | `feature/lab2-attachments` | Approved |
| [#30 — feat: Lab 2 Final Integration and Release Verification](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/30) | `feature/issue-18-integration-verification` | Approved |

**PR 16**
Reviewer comment I received: Complete AC-to-test traceability, resolve the inactive-requester contradiction, and align downstream issue requirements.
How I responded: Addressed in the Lab 2 specification and Test-DD matrix: AC-16 was retired, historical inactive-requester tickets remain preserved but unreachable through requester flows, and traceability was expanded.

Reviewer comment I received: Align `ai-use.md` naming, attachment byte limits, deterministic sorting, worktree rules, Ticket Date authority, test-table evidence, and required Ticket Detail planning coverage.
How I responded: Addressed in successive PR commits. The current specification, API contract, UI specification, and planned-test matrix include these decisions and traceability.

**PR #21**
Reviewer comment I received: Contract coverage, test alignment, and E2E-05 keyboard evidence: expand the request-parsing matrix (malformed JSON, non-object body, wrong Content-Type, duplicate query params), confirm `dev-requesters.api.test.ts` and `requester-context.api.test.ts` exist at the required paths, and add a keyboard-only Continue test.
How I responded: Expanded `api-contract.api.test.ts` with the parsing contract; added canonical JSON parsing middleware; expanded `dev-requesters.api.test.ts`; added keyboard-only focus test to `RequesterSelection.test.tsx`.

Reviewer comment I received: Traceability truthfulness and scope correction: several matrix rows were marked `Passed` before their full contract was executable in Issue #12 scope; a premature `fetchMyTickets()` runtime call hit a non-existent route; Lab 1 `/api/health` and System Overview UI had been removed out of scope.
How I responded: Demoted `API-REQ-02/03`, `API-CONTRACT-01`, `UI-MY-03`, `E2E-05` to `Planned`; removed `fetchMyTickets`; restored `/api/health`, `checkHealth`, and System Overview UI; fixed keyboard-only test to assert post-Continue shell state; added `agent.md` §3.4.

**PR #23**
Reviewer comment I received: **Medium — agent.md introduces an unrelated governance change:** The PR adds a mandatory Post-Implementation Double-Check Alignment Method to `agent.md`, which is outside the scope of Issue #22 (health-check/Lab 1 cleanup only). The change also breaks the document hierarchy (duplicate `## 4` sections, `3.3`/`3.4` misplaced under the new Section 4) and the new test-alignment gate (`no test file exists that isn't in tests.md`) conflicts with existing files like `server/tests/categories.test.ts`. The PR description does not document the `agent.md` change.
How I responded: Amended Issue #22 to explicitly allow `agent.md` maintenance within any issue scope. Fixed `agent.md` section hierarchy (moved `3.3`/`3.4` back under `## 3`, removed duplicate `## 4`, renumbered subsequent sections). Narrowed the Tests.md cross-reference rule to apply only to Lab 2 contract matrix tests, excluding legacy Lab 1 tests and supporting utilities. Cleaned up unused `fireEvent`/`waitFor` imports in `client/src/App.test.tsx`. Updated PR description to document the `agent.md` changes.

**PR #25**
Reviewer comment I received: **P1 — Ticket-number allocation and Ticket insertion are not in the same transaction:** `allocateTicketNumber()` commits the sequence update before `prisma.ticket.create()` runs. If Ticket insertion fails, the sequence remains incremented. Two different clocks are used (Node.js `new Date()` vs PostgreSQL `CURRENT_TIMESTAMP`).
How I responded: Rewrote `createTicket()` to use `prisma.$transaction()` with a single authoritative database timestamp (`SELECT NOW()`), moved category/related-system validation inside the transaction, and used `allocateTicketNumberWithClient()` to ensure sequence allocation rolls back if ticket insertion fails.

Reviewer comment I received: **P1 — The "View Ticket" action does not open the created Ticket:** `handleViewTicket` ignores the Ticket Number and returns to home. No Ticket Detail view, no client function for `GET /api/tickets/:ticketNumber`, no create-to-detail UI.
How I responded: Added `fetchTicketDetail()` to `client/src/api.ts`, added `ticket-detail` view to `AppView` with loading/error/not-found states, and wired `handleViewTicket` to navigate to the detail view.

Reviewer comment I received: **P1 — `POST /api/tickets` does not enforce the frozen JSON request-parsing contract:** `express.json()` skips parsing for wrong content type, leaving `req.body` undefined and causing a `TypeError` that returns `500 INTERNAL_ERROR` instead of `400 VALIDATION_ERROR`.
How I responded: Added `Content-Type: application/json` enforcement, non-null object body validation, and array/primitive rejection in `createTicketHandler()` returning canonical `400 VALIDATION_ERROR`.

**PR #28**
Reviewer comment I received: **P1 — API response shape:** My Tickets response missing `itPriority` and adds undocumented `requesterId`.
How I responded: **Fixed.** `itPriority: string | null` added to SQL query (`service.ts` line 481), service `MyTicketItem` interface, and client `api.ts` interface. `requesterId` is not included in the My Tickets API response — it is only present in the `service.ts` internal `TicketData` type for Ticket Detail. Response-shape verification test added to `my-tickets.api.test.ts` and `my-tickets-real-db.integration.test.ts`.

Reviewer comment I received: **P1 — Literal search:** `ILIKE` treats `%` and `_` as SQL wildcards, violating BR-23 literal substring requirement.
How I responded: **Fixed.** `ILIKE` replaced with `POSITION(LOWER($N) IN LOWER(column)) > 0` in `service.ts` line 393, which performs case-insensitive literal substring matching without SQL wildcard interpretation. Real-database tests added for literal `%`, `_`, and `\` search characters.

Reviewer comment I received: **P1 — Stale responses:** No abort controller or request ID guard — a slow old request can overwrite newer results.
How I responded: **Fixed.** Added `requestSeqRef` (monotonically increasing `useRef`) in `MyTickets.tsx` (line 52). Each `loadTickets()` call captures a sequence ID before the async fetch; state updates are guarded by `if (seqId !== requestSeqRef.current) return`. UI test `UI-MY-07` uses deferred promises to verify that a slow earlier request cannot overwrite a newer result.

**PR #29**
Reviewer comment I received: **P1 — Failed attachment retry state is not scoped to its owning ticket/requester:** `failedAttachments`/`failedAddAttachment` stored globally in `App`; retry could upload a failed file to the wrong ticket; requester switching left stale state.
How I responded: **Fixed.** Failed-attachment state is now scoped by `requesterId + ticketNumber` (`App.tsx`). Rendering filters by `fAtt.requesterId === activeRequester.id && fAtt.ticketNumber === detailTicketNumber` (lines 557–580). Retry uses the failed item's own `requesterId`/`ticketNumber` (lines 159, 595). State is cleared on requester switch (lines 135–136). Component tests `UI-ATT-RETRY-OWN` cover switching between tickets and switching requester after Case B.

Reviewer comment I received: **P1 — Upload ownership masking happens after multipart/file validation:** Multer ran before ownership validation, so missing/wrong-type/oversized files could leak behavior differences for non-owned tickets.
How I responded: **Fixed.** Added `requireTicketOwnership` pre-check in `controller.ts` (line 52) that runs BEFORE multer parses the body, draining the request body on non-owned tickets so the same `404 NOT_FOUND` is returned regardless of file payload. The transactional ownership check inside `uploadAttachment()` remains authoritative. Real-DB test `API-ATT-OWN-INT` proves identical `404` for valid, missing, oversized, and invalid-media files.

Reviewer comment I received: **P1 — Soft removal is not concurrency-safe:** read-then-unconditional-update allowed two concurrent DELETEs to both succeed.
How I responded: **Fixed.** `removeAttachment()` now uses a single conditional `UPDATE ... WHERE isRemoved = false` (service.ts line 996) so exactly one concurrent removal wins. Real-DB test `API-ATT-REM-CONC` proves exactly one `200` and one `409` with correct persisted removal metadata.

**PR #30**
Reviewer comment I received: **P1 — `attachment-unavailable` visual evidence does not depict the real unavailable state.** The screenshot must genuinely show the Unavailable badge with Preview/Download disabled and no Retry for a serving failure.
How I responded: **Fixed.** `e2e/lab-02/responsive-visual.spec.ts` now forces the Preview request to return `500` (route interception), asserts the Unavailable badge is visible, Preview/Download are disabled, and no Retry is exposed for a serving failure, then screenshots the real unavailable state.

Reviewer comment I received: **P1 — Responsive E2E-06 does not cover the full Issue #18 §19 requirements.** Must include Ticket Detail responsive, My Tickets table→card conversion, ≥44px mobile touch targets for required controls, required-control visibility, no horizontal scroll, and no clipped labels / no overlapping controls.
How I responded: **Fixed.** `e2e/lab-02/responsive-visual.spec.ts` expanded E2E-06 to the full §19 set: Ticket Detail responsive, table→card conversion per breakpoint, ≥44px touch targets for required controls, required-control visibility, no horizontal scroll at any viewport, and no-clipped-label / no-overlapping-control checks for all four screens. Also added the mobile hamburger navigation tests.

Reviewer comment I received: **P1 — E2E-05 keyboard-only flow conflicts with the specification-required native requester dropdown.** The four-key-only restriction (`Tab`/`Shift+Tab`/`Enter`/`Space`) cannot operate a native `<select>` to a non-default option, and auto-selecting the first requester violates "Continue disabled until selection" (ui-spec §5.2).
How I responded: **Fixed.** Issue #18 §24 was amended to permit `ArrowDown`/`ArrowUp` — the only keyboard mechanism that can operate a native dropdown to a non-default option. The requester control is the specification-required native `<select>` (id `requester-select`), loaded from `GET /api/dev-requesters`, showing only active requesters, with a disabled placeholder so Continue is disabled until a selection is made. The mandatory E2E-05 flow uses `Tab`/`Shift+Tab`/`Enter`/`Space`/`ArrowDown`/`ArrowUp` (no mouse, no `selectOption()`).


## Pull Requests I reviewed for my partner
**PR #27 — feature/17-lab2-engineering-contract**
My comment: Everything can work correctly and pass the criteria but there is a few note and ambiguity.

Test Execution Status Ambiguity
Location: docs/lab-02/tests.md Section 2, Section 8+, Section 14

Issue: The traceability matrix shows test IDs (UNIT-01, API-01, etc.) with a Final column containing "Not Run" for all entries. This is correct for planned tests, but the document does not explicitly state:

Are these tests already implemented, or are they being planned for future implementation?

Location: specification.md BR-21–24, api-spec.md Section 8.5, tests.md PG-11

Issue: Multiple locations describe the stale-claim boundary as "five minutes" but use inconsistent comparison operators:

BR-21: "at exactly five minutes stale same hash atomically reclaims"
api-spec.md 8.2: "freshness uses now < processingStartedAt + 5 minutes; stale begins at exact equality"
PG-11: Tests claim "at exact equality and afterward same hash atomically reclaims"
Partner's response: Alright krub. I will change and merge directly since you already approved.

**PR #31 — feature/18-lab2-data-model**
My comment: All requirement, criteria. issue align with the actual system in the app.
Partner's response: Alright, krub

**PR #32 — feature/19-zen-green-ui-foundation**
My comment: Approve no need to change.
Partner's response: >merge the pr

**PR #33 — feature/20-requester-context**
My comment: >approve 
Partner's response: -

**PR #34 — feature/21-create-ticket**
My comment: Everything can work correctly and all test are passed as expected, no collision as I saw.
Partner's response: >merge the pr

**PR #42 — feature/22-my-tickets**
My comment: This pr can be approved, no conflict as I found and everything is aligned
Partner's response: >merge the pr

**PR #43 — feature/23-ticket-detail**
My comment: Approve
Partner's response: >merge the pr

**PR #43 — feature/23-ticket-detail**
My comment: Approve
Partner's response: >merge the pr

**PR #44 — feature/24-attachments**
My comment: erdict
⚠️ Changes Requested

Merge decision
PR #44 has a strong implementation and appears to cover the Issue #24 functional scope comprehensively. The linked Issue #24 is explicit about the Attachment lifecycle, backend/API behavior, PostgreSQL concurrency, cleanup, frontend flows, and required focused tests.

However, I would not approve it yet because the current PR does not have independently verifiable CI/test evidence attached to the current head. The PR description reports extensive successful local verification, but GitHub's current combined commit status for bb348b570c9129cc914ca9204298a7baa370a616 contains no status checks, while the only workflow run associated with the head is the successful Project Automation workflow—not the application test/build suite.

This is particularly important because Issue #24 explicitly makes the focused Attachment/maintenance/API/PostgreSQL/UI tests a prerequisite for completion.
Partner's response: >fix the issue 

My comment : >Approve and merge

**PR #45 — feature/25-lab2-verification**
My comment: ⚠️ REQUEST CHANGES — Fix the blocking issues above before merge

The implementation/tooling itself is in good shape and the server/client verification is independently green. The required Playwright specs and database-safety mechanisms are also present.

Acceptance condition: deliver or otherwise make independently accessible the required screenshot evidence for Create Ticket, My Tickets, and Ticket Detail at 1440x900, 820x1180, and 390x844, and make tests.md accurately reflect the actual evidence-delivery mechanism.

Once that is resolved, I would consider the PR merge-ready, with adding Playwright to CI remaining a recommended improvement rather than a blocker.

Partner's response: >fix 

My comment: Previously there's a conflict between requirement and the issue however I see you have fixed it. >approve and merge. >Approve and merge

**PR #46 — feature/26-lab2-release-evidence**
My comment: Verdict
⚠️ Changes Requested

Merge decision
PR #46 is substantially complete and the documented evidence is consistent. The Kanban/Project state has been manually verified as correct, so there is no longer a blocker there.

However, one blocking release-gate item remains: Lab 2 needs to be revalidated on the resulting lab2-staging after PR #46 is merged. This is required to prove that the final staging state being promoted to main actually works.

Partner's response: Acknowledged. I recorded the manual Project/Kanban verification as PASS. The only remaining release gate is validation of the resulting lab2-staging after PR #46 merges; I will not open the lab2-staging → main release PR until that check passes.

Partner's response: >fix
Partner's response: Post-merge gate complete. PR #46 is merged into lab2-staging at ed1f107c469e5469c78575f9a0a6c7ee2115404b; exact tree matched the reviewed tree. Server regression: 31 files/674 tests passed. Client: 10 files/258 passed. Server/client builds, Prisma validation/status/drift, seed/maintenance, and pinned Playwright E2E (12/12, 19.0s) passed against disposable synthetic PostgreSQL targets. Issue #26 now records this result and the manual Project/Kanban PASS. No application implementation changed.

My response: >Approve

