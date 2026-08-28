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

## Pull Request — My Tickets Feature (PR #28)

- **PR:** [#28 — feat: implement My Tickets feature](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/28)
- **Source branch:** `feature/lab2-my-tickets`
- **Target branch:** `lab2-staging`
- **Scope:** My Tickets list with search, filter, sort, pagination, and ownership enforcement (Issue #14).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — CHANGES_REQUESTED (2026-08-27, head `1a70c7da`) | **P1 — API response shape:** My Tickets response missing `itPriority` and adds undocumented `requesterId`. | **Fixed.** `itPriority: string | null` added to SQL query (`service.ts` line 481), service `MyTicketItem` interface, and client `api.ts` interface. `requesterId` is not included in the My Tickets API response — it is only present in the `service.ts` internal `TicketData` type for Ticket Detail. Response-shape verification test added to `my-tickets.api.test.ts` and `my-tickets-real-db.integration.test.ts`. |
| @oangsa — CHANGES_REQUESTED (2026-08-27, head `1a70c7da`) | **P1 — Literal search:** `ILIKE` treats `%` and `_` as SQL wildcards, violating BR-23 literal substring requirement. | **Fixed.** `ILIKE` replaced with `POSITION(LOWER($N) IN LOWER(column)) > 0` in `service.ts` line 393, which performs case-insensitive literal substring matching without SQL wildcard interpretation. Real-database tests added for literal `%`, `_`, and `\` search characters. |
| @oangsa — CHANGES_REQUESTED (2026-08-27, head `1a70c7da`) | **P1 — Stale responses:** No abort controller or request ID guard — a slow old request can overwrite newer results. | **Fixed.** Added `requestSeqRef` (monotonically increasing `useRef`) in `MyTickets.tsx` (line 52). Each `loadTickets()` call captures a sequence ID before the async fetch; state updates are guarded by `if (seqId !== requestSeqRef.current) return`. UI test `UI-MY-07` uses deferred promises to verify that a slow earlier request cannot overwrite a newer result. |
| @oangsa — CHANGES_REQUESTED (2026-08-27, head `1a70c7da`) | **P1 — Unsafe pagination:** Large finite `page` values can produce invalid SQL `OFFSET`; no early return when `page > totalPages`. | **Fixed.** Added `Number.isSafeInteger()` guard in controller (line 233) — pages exceeding `Number.MAX_SAFE_INTEGER` fall back to `page=1`. Added early return in service when `totalPages === 0 || params.page > totalPages` (line 448) — returns empty `data` with correct metadata without executing SQL `OFFSET`. Tests added for `Number.MAX_SAFE_INTEGER`, `Number.MAX_SAFE_INTEGER + 1`, and large finite decimal strings. |
| @oangsa — CHANGES_REQUESTED (2026-08-27, head `1a70c7da`) | **P1 — Insufficient test evidence:** Summary sorting not tested with distinct values; pagination only checks page lengths; `UI-MY-05` doesn't exercise the out-of-range redirect branch; Retry test doesn't click Retry. | **Fixed.** Distinct Summary values tested in ascending and descending order (`my-tickets-real-db.integration.test.ts` Test 4b). Pagination asserts exact, ordered, non-overlapping page slices. `UI-MY-05` directly simulates an out-of-range response for the currently requested page (component requests page > totalPages, detects it, redirects to last valid page). Retry test (`UI-MY-04`) proves no automatic retry (waits and counts calls) and verifies exactly one additional request after clicking Retry. |

### Review Evidence
- Review comments and discussions: [PR #28 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/28)
- Reviewer: @oangsa — review state: `CHANGES_REQUESTED` (2026-08-27)
- Current head at time of review: `1a70c7dab43831d82356b88fe6b520a00ebbe861`
- Current head after fixes: `0042f782857f2f2033e94a93621869005c589d1e`
- Review status: **Open; all five blocking findings have been addressed. Re-review pending.** This record must be updated with the final approval/merge evidence before the Lab 2 course submission.

---

## Pull Request — Attachment Lifecycle & Ticket Detail (PR #29)

- **PR:** [#29 — feat: Issue #15 — Attachment Lifecycle & Ticket Detail](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/29)
- **Source branch:** `feature/lab2-attachments`
- **Target branch:** `lab2-staging`
- **Scope:** Complete Issue #15 attachment lifecycle and Ticket Detail feature (upload/list/download/preview/soft-remove, secure filesystem storage with compensating persistence, Create Ticket Case B partial-success handling, client-side attachment validation and drag-and-drop).

### Review Comments Received and Responses

| Review source | Summary of feedback | Response / current evidence |
|---|---|---|
| @oangsa — CHANGES_REQUESTED (2026-08-28, head `9e5d41c4`) | **P1 — Failed attachment retry state is not scoped to its owning ticket/requester:** `failedAttachments`/`failedAddAttachment` stored globally in `App`; retry could upload a failed file to the wrong ticket; requester switching left stale state. | **Fixed.** Failed-attachment state is now scoped by `requesterId + ticketNumber` (`App.tsx`). Rendering filters by `fAtt.requesterId === activeRequester.id && fAtt.ticketNumber === detailTicketNumber` (lines 557–580). Retry uses the failed item's own `requesterId`/`ticketNumber` (lines 159, 595). State is cleared on requester switch (lines 135–136). Component tests `UI-ATT-RETRY-OWN` cover switching between tickets and switching requester after Case B. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Upload ownership masking happens after multipart/file validation:** Multer ran before ownership validation, so missing/wrong-type/oversized files could leak behavior differences for non-owned tickets. | **Fixed.** Added `requireTicketOwnership` pre-check in `controller.ts` (line 52) that runs BEFORE multer parses the body, draining the request body on non-owned tickets so the same `404 NOT_FOUND` is returned regardless of file payload. The transactional ownership check inside `uploadAttachment()` remains authoritative. Real-DB test `API-ATT-OWN-INT` proves identical `404` for valid, missing, oversized, and invalid-media files. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Soft removal is not concurrency-safe:** read-then-unconditional-update allowed two concurrent DELETEs to both succeed. | **Fixed.** `removeAttachment()` now uses a single conditional `UPDATE ... WHERE isRemoved = false` (service.ts line 996) so exactly one concurrent removal wins. Real-DB test `API-ATT-REM-CONC` proves exactly one `200` and one `409` with correct persisted removal metadata. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Compensation does not cover transaction commit failure:** a failure after `attachment.create` succeeded but before commit left an orphaned physical file. | **Fixed.** Transaction-wide filesystem compensation tracks every written file and deletes it if ANY part of the transaction fails, including post-insert/pre-commit failures (via `test-seams.ts`). Real-DB test `ATT-PERSIST-03` injects a post-insert transaction failure and verifies the physical file is deleted and the row rolled back. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Client does not enforce the five-active-attachment limit:** Create Ticket accepted unlimited files; Ticket Detail left Add Attachment enabled at five active. | **Fixed.** Create Ticket and Ticket Detail both enforce the five-active limit client-side; the sixth file is rejected and never reaches the upload API; Add Attachment is disabled at five active and re-enabled after removal. Tests `UI-TKT-CAP-01` and `UI-ATT-CAP-01` cover exactly five, selecting a sixth, full Ticket Detail, and slot reuse after removal. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Successful upload followed by refresh failure becomes retryable:** a failed refresh after a successful mutation could offer a duplicate retry. | **Fixed.** Mutation success is now terminal — a subsequent refresh failure is shown as a detail error, never as a retryable mutation failure. Test `UI-ATT-MUT-REF` covers upload-success + refresh-failure and remove-success + refresh-failure. |
| @oangsa — `CHANGES_REQUESTED` (2026-08-28, head `9e5d41c4`) | **P1 — Feature-level verification boundary incomplete:** `attachments.api.test.ts` mocked the service, so ownership, storage persistence, removed access, second removal, UUID filename persistence, and full compensation were not actually verified; `tests.md` had conflicting totals. | **Fixed.** Added real-DB integration coverage for ownership (`API-ATT-OWN-INT`), concurrent removal (`API-ATT-REM-CONC`), persistence compensation (`ATT-PERSIST-01/02/03`), UUID stored filename (`ATT-PERSIST-04`), and removed access (`ATT-PERSIST-05`). Deterministic PDF preview, exact `UI-TKT-08` flow, and complete Ticket Detail state matrix covered. `tests.md` corrected to match actual implementation (308 server / 64 client tests). |

### Minor Follow-ups (Non-blocking)
- Upload response contract and implementation disagree about `ticketId` — reconciled in the API contract.
- Oversized numeric attachment IDs validated before Prisma to avoid a possible `500`.
- Client prefers parsing `filename*` for downloads.
- Remove errors shown inside the removal dialog instead of under Add Attachment.

### Review Evidence
- Review comments and discussions: [PR #29 review conversation](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/29)
- Reviewer: @oangsa — review state: `CHANGES_REQUESTED` (2026-08-28)
- Current head at time of review: `9e5d41c4cdc535480152cc9c434e50ffd3514ef6`
- Review status: **Open; all seven blocking findings have been addressed. Re-review pending.** This record must be updated with the final approval/merge evidence before the Lab 2 course submission.

