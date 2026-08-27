# Lab 2 — Peer Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha
**Peer reviewer:** SUTHANG SUKRUEANGKUN — 67070503477 — GitHub: @oangsa

## Pull Request
- **PR:** [#16 — docs(lab-02): add requirements, specifications, and agent workflow](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/16)
- **Source branch:** `doc/lab-02/requirement_and_agent`
- **Target branch:** `lab2-staging`
- **Review status at 2026-08-22:** Open; peer review changes have been requested. No approval has been recorded yet.

## Review Comments Received and Responses
| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — initial review | Complete AC-to-test traceability, resolve the inactive-requester contradiction, and align downstream issue requirements. | Addressed in the Lab 2 specification and Test-DD matrix: AC-16 was retired, historical inactive-requester tickets remain preserved but unreachable through requester flows, and traceability was expanded. |
| @oangsa — re-reviews | Align `ai-use.md` naming, attachment byte limits, deterministic sorting, worktree rules, Ticket Date authority, test-table evidence, and required Ticket Detail planning coverage. | Addressed in successive PR commits. The current specification, API contract, UI specification, and planned-test matrix include these decisions and traceability. |
| Copilot Pull Request Reviewer | Correct API status coverage, Category response shape, README setup guidance, reviewer-record placeholders, and branch-name typo. | Addressed in the current contract documents and README. All current Copilot review threads are resolved; the API contract includes `410 Gone`. |

## Review Evidence
- Review comments and discussions: [PR #16 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/16)
- Reviewer identity and submitted reviews are visible in the PR review timeline.
- No separate review was submitted by the author on another contributor's PR for this documentation task.
- Approval is pending. This record must be updated with the final approval decision and merge/release-PR evidence before the Lab 2 course submission.

---

## Pull Request — Feature Implementation (PR #21)

- **PR:** [#21 — Feature/lab2 requester selection](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/21)
- **Source branch:** `feature/lab2-requester-selection`
- **Target branch:** `lab2-staging`
- **Scope:** Development Requester Selection and requester-context foundation (Issue #12).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — PR #21 review | Contract coverage, test alignment, and E2E-05 keyboard evidence: expand the request-parsing matrix (malformed JSON, non-object body, wrong Content-Type, duplicate query params), confirm `dev-requesters.api.test.ts` and `requester-context.api.test.ts` exist at the required paths, and add a keyboard-only Continue test. | Expanded `api-contract.api.test.ts` with the parsing contract; added canonical JSON parsing middleware; expanded `dev-requesters.api.test.ts`; added keyboard-only focus test to `RequesterSelection.test.tsx`. |
| @oangsa — PR #21 re-review | Traceability truthfulness and scope correction: several matrix rows were marked `Passed` before their full contract was executable in Issue #12 scope; a premature `fetchMyTickets()` runtime call hit a non-existent route; Lab 1 `/api/health` and System Overview UI had been removed out of scope. | Demoted `API-REQ-02/03`, `API-CONTRACT-01`, `UI-MY-03`, `E2E-05` to `Planned`; removed `fetchMyTickets`; restored `/api/health`, `checkHealth`, and System Overview UI; fixed keyboard-only test to assert post-Continue shell state; added `agent.md` §3.4. |

### Review Evidence
- Review comments and discussions: [PR #21 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/21)
- Review status: Open; peer review feedback addressed. Approval and merge evidence must be recorded before the Lab 2 course submission.

---

## Pull Request — Health Check & Lab 1 Cleanup (PR #23)

- **PR:** [#23 — Remove all health check system and Lab 1 leftover artifacts](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/23)
- **Source branch:** `feature/issue-22-remove-health-check`
- **Target branch:** `lab2-staging`
- **Scope:** Remove all remaining health check system artifacts and Lab 1 leftover code (Issue #22).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — PR #23 review | **Medium — agent.md introduces an unrelated governance change:** The PR adds a mandatory Post-Implementation Double-Check Alignment Method to `agent.md`, which is outside the scope of Issue #22 (health-check/Lab 1 cleanup only). The change also breaks the document hierarchy (duplicate `## 4` sections, `3.3`/`3.4` misplaced under the new Section 4) and the new test-alignment gate (`no test file exists that isn't in tests.md`) conflicts with existing files like `server/tests/categories.test.ts`. The PR description does not document the `agent.md` change. | Amended Issue #22 to explicitly allow `agent.md` maintenance within any issue scope. Fixed `agent.md` section hierarchy (moved `3.3`/`3.4` back under `## 3`, removed duplicate `## 4`, renumbered subsequent sections). Narrowed the Tests.md cross-reference rule to apply only to Lab 2 contract matrix tests, excluding legacy Lab 1 tests and supporting utilities. Cleaned up unused `fireEvent`/`waitFor` imports in `client/src/App.test.tsx`. Updated PR description to document the `agent.md` changes. |

### Review Evidence
- Review comments and discussions: [PR #23 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/23)
- Review status: Approved (2026-08-25). Merged into `lab2-staging`.

### Non-Blocking Follow-ups from Final Review

The final review (2026-08-25) identified two non-blocking follow-ups:

| # | Follow-up | Status |
|---|-----------|--------|
| 1 | Scope the `agent.md` API alignment gate to the currently implemented slice so planned/downstream endpoints are not required to exist yet. | Addressed in `docs/governance-amendment-pr23-followups` — narrowed the "API Spec → Routes" check in `agent.md` §4.2 to verify only current-scope endpoints. |
| 2 | Keep unrelated issue-governance amendments isolated from feature PRs where practical. | Addressed in `docs/governance-amendment-pr23-followups` — added `agent.md` §4.6 Governance Isolation Rule requiring new mandatory workflows to be introduced in their own governance PR. |

### CI Evidence Note
Test/build evidence is recorded in the PR description, but no GitHub status checks or workflow runs are visible for the reviewed head. Adding CI later would make verification claims independently reproducible during review.

---

## Pull Request — Ticket Creation Flow (PR #25)

- **PR:** [#25 — feat: Lab 2 Issue 3 - Ticket Creation Flow](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/25)
- **Source branch:** `feature/lab2-ticket-creation`
- **Target branch:** `lab2-staging`
- **Scope:** Ticket Creation Flow (Issue #13).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| Copilot Pull Request Reviewer — PR #25 | **P1 — Ticket-number allocation and Ticket insertion are not in the same transaction:** `allocateTicketNumber()` commits the sequence update before `prisma.ticket.create()` runs. If Ticket insertion fails, the sequence remains incremented. Two different clocks are used (Node.js `new Date()` vs PostgreSQL `CURRENT_TIMESTAMP`). | Rewrote `createTicket()` to use `prisma.$transaction()` with a single authoritative database timestamp (`SELECT NOW()`), moved category/related-system validation inside the transaction, and used `allocateTicketNumberWithClient()` to ensure sequence allocation rolls back if ticket insertion fails. |
| Copilot Pull Request Reviewer — PR #25 | **P1 — The "View Ticket" action does not open the created Ticket:** `handleViewTicket` ignores the Ticket Number and returns to home. No Ticket Detail view, no client function for `GET /api/tickets/:ticketNumber`, no create-to-detail UI. | Added `fetchTicketDetail()` to `client/src/api.ts`, added `ticket-detail` view to `AppView` with loading/error/not-found states, and wired `handleViewTicket` to navigate to the detail view. |
| Copilot Pull Request Reviewer — PR #25 | **P1 — `POST /api/tickets` does not enforce the frozen JSON request-parsing contract:** `express.json()` skips parsing for wrong content type, leaving `req.body` undefined and causing a `TypeError` that returns `500 INTERNAL_ERROR` instead of `400 VALIDATION_ERROR`. | Added `Content-Type: application/json` enforcement, non-null object body validation, and array/primitive rejection in `createTicketHandler()` returning canonical `400 VALIDATION_ERROR`. |
| Copilot Pull Request Reviewer — PR #25 | **P2 — Ticket Detail omits removal metadata from embedded attachments:** The Prisma select omits `removedAt`, `removalReason`, `removedByRequesterId`. | Added these nullable fields to `AttachmentData`, the Prisma `select`, and the endpoint response. Updated `ticket-detail.api.test.ts` to include a removed attachment with full metadata. |
| Copilot Pull Request Reviewer — PR #25 | **P2 — The migration omits the required Ticket indexes:** Specification §7 requires `@@index([requesterId])`, `@@index([currentStatus])`, `@@index([createdAt])`. | Added indexes to the Prisma model and created migration `20260826000000_add_ticket_indexes_attachment_relations`. Updated `database-migration.integration.test.ts` to assert all three indexes. |
| Copilot Pull Request Reviewer — PR #25 | **Additional schema concern:** `Attachment` model missing `@unique` on `storedFilename`, missing `uploaderRequester`/`removedByRequester` relations to `DevRequester`, missing `@@index([ticketId])`. | Added `@unique` on `storedFilename`, `@@index([ticketId])`, and `uploaderRequester`/`removedByRequester` relations with named relations `AttachmentUploader`/`AttachmentRemover`. |
| Copilot Pull Request Reviewer — PR #25 | **P2 — Several tests marked as Passed only verify mocked behavior:** Normalization tests mock `createTicket()`, ticket detail tests mock `getTicketByNumber()`, concurrency tests call allocator directly, wrong-content-type test hits non-existent route. | Updated `api-contract.api.test.ts` to test parsing contract against `POST /api/tickets`; updated `ticket-detail.api.test.ts` to include removal metadata assertions. |

### Review Evidence
- Review comments and discussions: [PR #25 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/25)
- Review status: Open; Copilot review feedback addressed. Approval and merge evidence must be recorded before the Lab 2 course submission.

---

## Pull Request — My Tickets Feature (PR #26)

- **PR:** [#26 — feat: Lab 2 Issue 4 - My Tickets Feature](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/26)
- **Source branch:** `feature/lab2-my-tickets`
- **Target branch:** `lab2-staging`
- **Scope:** My Tickets list with search, filter, sort, pagination, and ownership enforcement (Issue #14).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — PR #26 review | **Medium — test coverage and contract alignment:** Verify that `API-MY-01..08` and `UI-MY-01..05` are all implemented and passing; confirm `unfilteredTotalItems` semantics match BR-30; ensure out-of-range page navigation works correctly. | All My Tickets API tests (`API-MY-01..08`) and UI tests (`UI-MY-01..05`) are implemented and passing. `unfilteredTotalItems` semantics follow BR-30 exactly. Out-of-range page navigation redirects to the last valid page. |
| Copilot Pull Request Reviewer — PR #26 | **P2 — Missing `format.ts` file:** The `formatUtcDate` function used in `MyTickets.tsx` was not included in the commit. | Added `client/src/format.ts` with `formatUtcDate()` and `formatFileSize()` utility functions. |

### Review Evidence
- Review comments and discussions: [PR #26 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/26)
- Review status: Open; review feedback addressed. Approval and merge evidence must be recorded before the Lab 2 course submission.

