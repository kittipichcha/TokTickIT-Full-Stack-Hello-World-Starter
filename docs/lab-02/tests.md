# Lab 2 Test Plan and Results - TokTickIT Requester Ticketing MVP

## 1. Purpose
This document is the Lab 2 testing contract for:
- `docs/lab-02/specification.md`
- `docs/lab-02/api-spec.md`

## 2. Current Tooling and Paths
Backend (configured now):
- Runner: Vitest
- Existing folder: `server/tests/`
- Planned Lab 2 folder: `server/tests/lab-02/`

Frontend (configured now):
- Runner: Vitest + React Testing Library
- Existing folder: `client/src/`
- Planned Lab 2 folder: `client/src/lab-02-tests/`

E2E/Responsive/Keyboard (planned):
- Runner: Playwright
- Planned folder: `e2e/lab-02/`

## 3. AC Retirement Note
- **AC-16 was retired** due to requester-context contract conflict.
- Historical tickets for inactive requesters are preserved in data but not reachable in Lab 2 requester-facing flows.

## 4. Coverage Completeness Gate
This test plan is intended to be a closed-contract test suite: every FR, BR, and AC must be traceable to at least one planned automated test, and all explicit edge-case permutations are enumerated in the requirements and planned tests. No implementation or future agent may add a hidden runtime decision when the behavior is already specified here.

### 4.1 FR coverage summary
- FR-01: covered by Requester Selection and requester-context tests (`UI-REQ-01`, `UI-REQ-02`, `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`).
- FR-02: covered by Create Ticket and validation tests (`API-TKT-NOR-01`, `API-TKT-NOR-02`, `API-TKT-01`, `UI-TKT-01..07`, `UI-ERR-01`).
- FR-03: covered by generated ticket number tests and concurrent allocation tests (`API-TKT-01`, `API-TKT-06`).
- FR-04 / FR-05 / FR-06 / FR-07 / FR-08: covered by My Tickets tests (`API-MY-01..08`, `UI-MY-01..05`).
- FR-09: covered by owner isolation and detail tests (`API-TKT-03`, `API-MY-01`, `UI-DETAIL-01`).
- FR-10 / FR-11 / FR-12 / FR-13: covered by Attachment tests (`API-ATT-01..10`, `API-ATT-12..15`, `API-ATT-OWN-01`, `ATT-PERSIST-01`, `UI-ATT-01..05`, `UI-DETAIL-01`).
- FR-14 / FR-15: covered by requester switching and inactive-requester tests (`UI-REQ-02`, `API-REQ-02`, `UI-MY-03`).
- FR-16: covered by Empty/No-Results tests (`UI-MY-01`, `UI-MY-02`, `API-MY-08`).
- FR-17: covered by create failure and state-preservation tests (`UI-TKT-05`, `UI-ERR-01`, `E2E-04`).

### 4.2 BR coverage summary
Every BR must be proven by at least one planned automated test row in Section 5, with one
narrow exception: BR-25 is a Lab 3 transition/process boundary rule with no Lab 2 runtime
behavior to execute, so it is proven by an explicit static/scope-verification row (`STATIC-01`)
instead of a functional test. No other BR may rely on the written requirement text alone as
its own evidence. The contract explicitly freezes the behaviors for summary/description
trimming, invalid IDs, filters, search, pagination, requester enforcement, attachment removal
metadata, and multi-file partial success.

### 4.3 AC coverage summary
Each acceptance criterion is mapped into the planned test matrix. The implementation must not treat any AC as “informal” because each AC is tied to a concrete API/UI test or a specified business rule.

### 4.4 Decision-free boundaries and invalid permutations
The following conditions are explicitly enumerated and must not be reinterpreted:
- Empty/blank/whitespace-only input for summary, description, search, and removal reason
- Malformed, nonexistent, inactive, and negative reference IDs
- Invalid enums for requestedPriority, status, sort, and order
- Valid but out-of-range pagination requests
- Multi-file partial success sequences and per-file reporting
- Empty vs No-Results logic based on `unfilteredTotalItems`
- Soft-delete metadata and `removedByRequesterId` enforcement
- Canonical error shape/codes and malformed header/path/body/query behavior
- Ticket-number and attachment-limit concurrent-write invariants

## 5. Test Traceability Matrix (Planned Contract)

`Final` describes evidence status, not the expected behavior: `Planned` means the test row
is specified but its automated test is not implemented; `Implemented` means the test exists
but has not yet passed in the current evidence log; `Passed` means the test exists and passed;
`Failed` means the latest run failed; and `Blocked` means it cannot run because its documented
prerequisite is unavailable. A row must not be marked `Passed` based on this plan alone.

| Test ID | Type | What It Tests | Expected Result | Automated Test File | FR | BR | Requirement / AC | Final |
|---|---|---|---|---|---|---|---|---|
| API-REQ-01 | API | Selector returns only active development requesters | Returns only active requesters and excludes inactive ones from the selector payload. | `server/tests/lab-02/api-contract.api.test.ts` | FR-01, FR-15 | BR-03, BR-04 | AC-15 | Passed |
| UI-REQ-01 | UI | Route guard redirects to selector when requester context missing | Missing requester context redirects to the selector screen without crashing. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-21, BR-05 | AC-02 | Passed |
| UI-REQ-02 | UI | Stale/inactive requester context clears sessionStorage and shows explanatory message | Stored requester is cleared, the app redirects to selector, and the user sees a clear inactive-requester message. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-05, BR-21 | AC-02, AC-15 | Passed |
| API-REQ-02 | API | Requester-scoped endpoints reject missing/unknown/inactive `X-Dev-Requester-Id` with 422 while historical tickets remain persisted and unreachable through requester flows | Missing/invalid/inactive requester headers are rejected, while historical records remain persisted but non-reachable in requester flows. | `server/tests/lab-02/api-contract.api.test.ts` | FR-15 | BR-04, BR-05, BR-21, BR-29 | AC-15 | Passed |
| API-REQ-03 | API | Bootstrap/reference endpoints do not require requester headers | `GET /api/dev-requesters` and reference-data endpoints still function without `X-Dev-Requester-Id`. | `server/tests/lab-02/api-contract.api.test.ts` | FR-15 | BR-21 | — | Passed |
| API-CONTRACT-01 | API | Canonical error body and request parsing matrix for every endpoint class | Each requester-scoped endpoint rejects missing, malformed, duplicate, unknown, and inactive requester headers with the canonical `422` body; malformed route IDs/numbers return canonical `404`; JSON endpoints reject malformed JSON, non-object bodies, and wrong content type with canonical `400`; duplicate query keys use the first value; all `500` responses are safe. | `server/tests/lab-02/api-contract.api.test.ts` | FR-01, FR-09 | BR-21, BR-24 | AC-02, AC-03 | Passed |
| DB-01 | Integration | Fresh database migrates to the Lab 2 schema | Forward migration creates all required tables, fields, constraints, relations, and indexes without resetting the database. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Planned |
| DB-02 | Integration | Existing Lab 1 Category rows survive the Lab 2 migration | Existing Category `id`, `name`, and `createdAt` values remain unchanged and `isActive` is backfilled to `true`. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Planned |
| SEED-01 | Integration | Seed is idempotent when run twice | Running the seed twice creates no duplicate Requesters, Categories, or Related Systems and does not replace existing required Categories. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Planned |
| SEED-02 | Integration | Seed contains the required reference and requester records | Each of the four required Category names exists exactly once, unrelated pre-existing Categories are preserved, and there are at least six Related Systems, at least four active Requesters, and at least one inactive Requester. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Planned |
| API-REF-01 | API | GET /api/categories returns only active Categories with correct response shape | The endpoint returns an array of active Category objects with Lab 1 raw-array response shape (no `{ data: [...] }` envelope). | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Planned |
| API-REF-02 | API | GET /api/related-systems returns only active Related Systems with standard envelope | The endpoint returns `{ data: [...] }` with only active Related System objects. | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Planned |
| UI-REQ-03 | UI | Requester Selection loading state shows skeleton/spinner | The loading state displays while fetching active requesters from the API. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-04 | — | Passed |
| UI-REQ-04 | UI | Requester Selection empty state for zero active requesters | When no active requesters exist, a clear empty-state message is shown instead of a blank dropdown. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-04 | — | Passed |
| UI-REQ-05 | UI | Requester Selection API failure shows error with manual Retry button | API failure shows an error message and a Retry action; Continue remains disabled until selection succeeds. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | — | — | Passed |
| UI-REQ-06 | UI | Requester Selection stores selected requester in sessionStorage and sends X-Dev-Requester-Id header | The client persists the selected ID, sends the header, shows the selected Requester name in the application shell, and exposes an operable Change Requester action. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-14 | BR-14, BR-21 | — | Passed |
| UI-REQ-07 | UI | Requester Selection keyboard and post-selection flow | Testing-only explanatory text is visible; Continue is disabled before selection, enabled after selection, and keyboard-operable with visible focus; after Continue the selected name and Change Requester action are visible and Change Requester returns to selection. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-14 | BR-03, BR-14 | — | Passed |
| API-TKT-NOR-01 | API | Summary/Description trimming and boundary behavior | Summary and Description are trimmed before validation; trimmed values are validated and persisted. Boundary: 5/4/120/121 chars for summary; 10/9/2000/2001 chars for description (inclusive/exclusive). Whitespace-only input rejected. | `server/tests/lab-02/create-ticket-normalization.api.test.ts` | FR-02 | BR-08, BR-09 | — | Planned |
| API-TKT-NOR-02 | API | CategoryId/RelatedSystemId validation with malformed, nonexistent, and inactive cases | Malformed (non-integer) → 400; well-formed but nonexistent → 409; existing but inactive → 409. | `server/tests/lab-02/create-ticket-normalization.api.test.ts` | FR-02 | BR-07 | — | Planned |
| API-TKT-01 | API | Create ticket success: returns generated ticket number matching TKT-{YYYY}-{6-digit} format, verifies uniqueness | A valid create request creates exactly one ticket, returns the official backend-generated ticket number matching the format pattern, verifies two tickets receive different numbers, and explicitly asserts `currentStatus === "NEW"` in the response. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-03 | BR-01, BR-02 | AC-01 | Planned |
| API-TKT-07 | API | Requested Priority server-side validation | Missing `requestedPriority` → 400; invalid enum value (e.g. `URGENT`) → 400; `LOW`/`MEDIUM`/`HIGH` are each accepted and persisted as submitted. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-10 | — | Planned |
| API-TKT-06 | Integration | Ticket-number UTC allocation, concurrent uniqueness, and sequence exhaustion | Frozen UTC boundary timestamps produce the correct year; the first ticket created in a frozen year receives sequence `000001` and the next ticket in the same year receives `000002` (increment of exactly 1); a frozen rollover to a new UTC year resets the sequence to `000001`; concurrent creates all receive distinct numbers; an exhausted yearly sequence returns `409 TICKET_SEQUENCE_EXHAUSTED` and creates no ticket. | `server/tests/lab-02/ticket-number-concurrency.integration.test.ts` | FR-03 | BR-01 | AC-01 | Planned |
| STATIC-01 | Static/Doc | BR-25 Lab 3 authentication-transition boundary is a documented, non-runtime contract | Confirms no Lab 2 code path treats a client-supplied `X-Dev-Requester-Id` as authentication, and that the Lab 3 transition boundary is documented; verified by code/documentation review rather than an executable assertion. | `docs/lab-02/specification.md` (BR-25) | — | BR-25 | — | Planned |
| API-TKT-04 | API | Ownership is assigned from `X-Dev-Requester-Id` at creation | The server persists ownership from the validated caller header; the test does not introduce an undocumented `requesterId` request field. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-04 | BR-06, BR-21, BR-24 | — | Planned |
| API-TKT-05 | API | Requester-created tickets keep IT Priority and Ticket Owner null | `itPriority` and `ticketOwnerId` remain `null` on requester-created tickets. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-11 | — | Planned |
| UI-TKT-07 | UI | Requested Priority control is required and defaults to MEDIUM | The field defaults to `MEDIUM` and blocks submission if the value is missing from the form model. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-10 | — | Planned |
| UI-TKT-01 | UI | Empty summary blocks submit and shows field error | The summary field shows a direct validation error and no API call is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-04 | Planned |
| UI-TKT-02 | UI | Summary over 120 chars blocks submit with length error | A summary longer than 120 chars is rejected with a field-level message. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-05 | Planned |
| UI-TKT-03 | UI | Description under 10 chars blocks submit with field error | A description shorter than 10 chars is rejected before request submission. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-09 | AC-06 | Planned |
| UI-TKT-04 | UI | Submit busy state prevents duplicate submission | While a create request is in flight, the button is disabled and no second request is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-15 | AC-10 | Planned |
| UI-TKT-05 | UI | Case A — failed create keeps entered values and shows inline error | A failed create request preserves all form values and shows a manual-retry inline error without auto-retrying. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 | Planned |
| UI-TKT-06 | UI | Case B — partial success: ticket created but attachment upload failed shows Ticket Number, separate attachment error, and blocks ticket resubmission | The created ticket remains saved, a separate attachment failure is reported, and the user is not shown a duplicate create flow. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | Planned |
| UI-TKT-08 | UI | Valid and invalid pre-submit attachments | One valid and one invalid file shows the invalid file error, excludes the invalid file, and still submits the ticket with the valid file; evidence captures this state. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02, FR-10 | BR-12, BR-13 | AC-07 | Planned |
| API-TKT-02 | API | Inactive/stale category or related-system ID rejected with 409 | Replacing an active category or related system with a stale/inactive ID fails with `409 Conflict` and no ticket is saved. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-07 | AC-27 | Planned |
| API-TKT-03 | API | Ticket detail returns 404 for non-owner access | Requests for another Requester's ticket return `404 Not Found` and no data is exposed. | `server/tests/lab-02/ticket-detail.api.test.ts` | FR-09 | BR-24 | AC-03 | Planned |
| API-MY-01 | API | My Tickets returns only current requester-owned tickets (ownership isolation) | Only tickets belonging to the current requester are returned, even when other tickets exist. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-04 | BR-24 | AC-03 | Planned |
| API-MY-02 | API | Search by ticket number/summary substring | Search matches ticket numbers and summary substrings for the current requester only, after applying the BR-23 normalization rule. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05 | BR-23 | AC-17 | Planned |
| API-MY-03 | API | Category/Priority/Status filters are conjunctive | The list applies all selected filters together and returns only intersection matches. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-06 | BR-23 | AC-18 | Planned |
| API-MY-04 | API | Deterministic sort order with tie-breakers and priority ordering | Sort order is deterministic using selected field/direction and then `createdAt desc`, `id desc` as tie-breakers. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-07 | BR-22 | AC-19 | Planned |
| API-MY-05 | API | Pagination returns correct page metadata and slices | Page and pageSize metadata are returned accurately and the correct slice of results is delivered. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-08 | BR-22 | AC-20 | Planned |
| API-MY-06 | API | Default pagination/sort values and invalid-value fallback | Omitted pagination/sort params use `page=1`, `pageSize=10`, `sort=createdAt`, `order=desc`; invalid `sort`, `order`, `page`, or `pageSize` values fall back to these same documented defaults. (Invalid `categoryId`/`requestedPriority`/`status` filter values are validation errors, not fallback defaults — see `API-MY-07`.) | `server/tests/lab-02/my-tickets.api.test.ts` | FR-07, FR-08 | BR-22 | AC-19, AC-20 | Planned |
| API-MY-07 | API | Invalid filter parameter values and pagination | Malformed categoryId → 400; invalid requestedPriority/status enums → 400; page missing/malformed/non-positive uses page 1; valid out-of-range page → 200 with empty data and accurate metadata. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-06, FR-08 | BR-22, BR-23 | — | Planned |
| API-MY-08 | API | Search normalization and returned Empty/No-Results metadata values (API layer only) | Search is trimmed; blank-after-trim is inactive. Every list response includes accurate `totalItems` and `unfilteredTotalItems` values: a requester with no ticket history returns `unfilteredTotalItems=0` even with an active filter; a requester with ticket history and a zero-match filter returns `unfilteredTotalItems>0`. This test asserts only the returned numbers — which UI state those numbers should render is proven separately by `UI-MY-01`/`UI-MY-02`. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05, FR-16 | BR-22, BR-23 | — | Planned |
| API-ATT-09 | API | Attachment list ordering is deterministic (uploadedAt asc, id asc) | Attachment listing returns results in deterministic order for stable display ordering and reproducible tests. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | — | — | Planned |
| ATT-PERSIST-01 | Integration | Attachment metadata-persistence compensation on failure | Given the physical file write succeeds and metadata persistence then fails, the request fails safely, no Active attachment metadata row is created, and the newly written physical file is deleted (no orphaned file remains). | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-10 | BR-31 | — | Planned |
| API-ATT-OWN-01 | API | Cross-requester Attachment ownership enforcement | Requester B attempting upload, list, download, preview, or soft-remove against Requester A's ticket/attachment each receive `404 NOT_FOUND` with the same shape as a missing resource, and no data or file bytes are exposed. | `server/tests/lab-02/attachment-ownership.api.test.ts` | FR-09, FR-10, FR-11, FR-12, FR-13 | BR-24 | AC-03 | Planned |
| API-ATT-15 | API | Active-attachment limit counts only active rows after soft removal | With 5 active attachments, soft-removing 1 drops the active count to 4; uploading a new valid attachment is then accepted (`201`) and the active count returns to 5. | `server/tests/lab-02/attachments.api.test.ts` | FR-10, FR-11 | BR-12, BR-18 | AC-08 | Planned |
| API-ATT-10 | API | Removal reason normalization and boundary behavior | Omitted/blank-after-trim reason → null; 200-char reason → accepted; 201-char reason → rejected; non-string → 400 validation error. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | Planned |
| UI-ATT-05 | UI | Multi-file attachment partial success orchestration | The Create Ticket UI uploads A, B, and C sequentially; after B fails it continues to C, keeps A/C successful, reports B separately, and offers B retry from Ticket Detail. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-17 | BR-17 | — | Planned |
| API-ATT-12 | API | Soft-remove idempotency: removing twice returns 409 Conflict on second attempt | A removed attachment cannot be removed again; second DELETE returns 409 rather than silently succeeding. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | Planned |
| API-ATT-13 | API | Removal sets removedByRequesterId to the current requester | When soft-removing an attachment, `removedByRequesterId` is set to the `X-Dev-Requester-Id` of the caller. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | Planned |
| API-ATT-14 | Integration | Attachment signature/filename and concurrent-limit matrix | Fixed valid/corrupt fixtures verify the extension-to-signature matrix, case-insensitive extension handling, no/double extension rejection, safe stored/download filenames, and PDF-preview failure behavior. Concurrent uploads when four attachments are active yield exactly one success and never expose more than five active rows. | `server/tests/lab-02/attachment-concurrency.integration.test.ts` | FR-10, FR-12, FR-13 | BR-12, BR-13, BR-26, BR-27, BR-28 | AC-07, AC-08, AC-13, AC-24 | Planned |
| UI-MY-01 | UI | Empty state shown when `unfilteredTotalItems = 0`, even with an active normalized search/filter | Given `unfilteredTotalItems = 0`, with or without an active normalized search/filter, the UI renders the Empty state with the Create Ticket CTA. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-30 | AC-21 | Planned |
| UI-MY-02 | UI | No-results state shown when `unfilteredTotalItems > 0` and filtered results are zero | Given `unfilteredTotalItems > 0` and `totalItems = 0` after normalized search/filtering, the UI renders the No-Results state with the Clear Filters CTA. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-30 | AC-22 | Planned |
| UI-MY-03 | UI | Requester switch clears prior data and reloads new scope | Switching Requester clears the previous list and reloads the current Requester's tickets. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-14 | BR-14 | AC-14 | Passed |
| UI-MY-04 | UI | My Tickets loading and API failure states show skeleton/error with manual Retry | The list shows loading and failure states and requires a manual retry action instead of automatic reload. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-04, FR-17 | — | — | Planned |
| UI-MY-05 | UI | Valid out-of-range page does not display Empty or No-Results | When a valid page exceeds `totalPages`, the UI navigates to and reloads the last valid page; it does not mislabel the response as Empty or No-Results. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-08, FR-16 | BR-22, BR-30 | — | Planned |
| API-ATT-01 | API | Attachment type/content validation matrix | Allowed extension + invalid content is rejected; disallowed extension + valid content is rejected; allowed extension + matching content is accepted; a multipart request with no `file` part is rejected with `400 VALIDATION_ERROR` and creates no metadata or stored file. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12, BR-13 | AC-07 | Planned |
| UI-ATT-01 | UI | Disallowed attachment type rejected client-side | The client blocks an unsupported file type before upload and shows a clear explanation. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 | Planned |
| API-ATT-02 | API | Sixth active attachment rejected by server limit | Uploading the sixth active attachment is rejected with the server limit message. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-08 | Planned |
| UNIT-ATT-01 | Unit | Attachment size boundary validator: 4,999,999 / 5,000,000 accepted, 5,000,001 rejected | Boundary validation accepts 4,999,999 and 5,000,000 bytes and rejects 5,000,001. | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12 | AC-09 | Planned |
| API-ATT-03 | API | Oversized attachment upload rejected by server with 413 | An over-limit file is rejected by the API with the correct status and no storage. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 | Planned |
| UI-ATT-03 | UI | Selecting an oversized file shows size error immediately and prevents upload (client-side rejection) | Oversized files are rejected before upload with a size message and no network request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12 | AC-09 | Planned |
| API-ATT-04 | API | Soft remove marks removed metadata and disables access | A soft delete sets `isRemoved`, `removedAt`, `removalReason`, and `removedByRequesterId` and blocks preview/download. | `server/tests/lab-02/attachments.api.test.ts` | FR-11, FR-13 | BR-18, BR-19 | AC-12, AC-13 | Planned |
| API-ATT-05 | API | Preview/download endpoint behavior for active vs removed files | An active image attachment's preview returns `200` with inline image bytes; an active PDF attachment's preview returns `200` with a rendered first-page image; an active attachment's download returns `200` with the correct `Content-Type`/`Content-Disposition`; a removed attachment's preview and download both return exactly `410` (`ATTACHMENT_REMOVED`), never `404`/`400`/`409`. | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18, BR-28 | AC-13, AC-24 | Planned |
| API-ATT-08 | API | Removal reason validation | An omitted reason is accepted, a 200-character reason is accepted, and a 201-character reason is rejected. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | Planned |
| UI-ATT-04 | UI | Removal confirmation dialog and cancel behavior | Remove opens a confirmation dialog; Cancel closes it without sending a DELETE request; Confirm sends the removal request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-19 | — | Planned |
| UI-ATT-02 | UI | Removed attachment row shows Removed badge and disabled controls | A removed attachment remains listed with a de-emphasized Removed badge and disabled Download/Preview actions. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-20 | AC-12 | Planned |
| API-ATT-06 | API | BR-17 partial success: ticket POST succeeds, attachment upload fails, ticket persists and is not rolled back | The ticket remains persisted after attachment failure and no duplicate ticket is created. | `server/tests/lab-02/attachments.api.test.ts` | FR-02, FR-10 | BR-17 | AC-26 | Planned |
| API-ATT-07 | API | Attachment metadata is persisted and stored filename is generated safely with validated extension | Metadata is saved and the stored filename is generated using a sanitized UUID+extension pattern. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-26, BR-27 | — | Planned |
| UI-DETAIL-01 | UI | Ticket Detail renders read-only fields, loading/failure/not-found states, active and removed attachments, Preview/Download/Remove, and Add Attachment controls | The detail screen shows the frozen screen-level states (skeleton loading, safe 404 "not found" with no ownership leak, manual-retry failure banner) plus read-only ticket data, attachment state, and the correct controls for active vs removed attachments. | `client/src/lab-02-tests/RequesterTicketDetail.test.tsx` | FR-09, FR-10, FR-11, FR-12, FR-13, FR-17 | BR-18, BR-20, BR-24, BR-28 | AC-03, AC-12, AC-13, AC-24 | Planned |
| E2E-01 | E2E | Requester creates ticket and later finds it in My Tickets | The full requester flow ends with a visible ticket in the requester's My Tickets list. | `e2e/lab-02/requester-ticket-flow.spec.ts` | FR-02, FR-04 | BR-01, BR-22 | AC-01, AC-17 | Planned |
| E2E-02 | E2E | Ownership isolation across two requester contexts | Requester A and B cannot see each other's tickets and ownership enforcement works end-to-end. | `e2e/lab-02/ownership.spec.ts` | FR-09 | BR-24 | AC-03 | Planned |
| E2E-03 | E2E | Full attachment lifecycle (upload/preview/download/remove) | Users can add, preview, download, and remove attachments on their own tickets without breaking the ticket flow. | `e2e/lab-02/attachment-lifecycle.spec.ts` | FR-10, FR-11, FR-12, FR-13 | BR-12, BR-18, BR-28 | AC-07, AC-12, AC-13, AC-24 | Planned |
| E2E-04 | E2E | BR-17 partial success: ticket created, attachment upload fails, ticket persists, no duplicate, retry from Ticket Detail | Ticket creation succeeds, attachment failure is reported separately, and the user can retry the attachment without creating a duplicate. | `e2e/lab-02/partial-success-attachment.spec.ts` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | Planned |
| E2E-05 | E2E | Keyboard-only requester selection and create-ticket flow with visible focus indicators | Keyboard users can operate the testing-only Requester Selection, Continue, Change Requester, and complete Create Ticket with visible focus and no inaccessible inputs. | `e2e/lab-02/keyboard-access.spec.ts` | FR-01, FR-14 | BR-03, BR-14 | AC-25 | Planned |
| UI-ERR-01 | UI | Case A — ticket create API failure preserves form state and requires manual retry | A create failure leaves all form values populated and requires manual retry rather than auto-retrying. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 | Planned |
| UI-STYLE-01 | UI Style | Editable/read-only/invalid/disabled/busy field and button styles match Zen Green tokens | The visual system consistently distinguishes valid, invalid, disabled, busy, and read-only states. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | — | — | Planned |
| UI-STYLE-02 | UI Style | Required-field labels show red asterisk; validation messages render directly under fields | Required labels and inline validation match the accessibility and UI contract. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-08, BR-09 | AC-04, AC-06 | Planned |
| UI-STYLE-03 | UI Style | Priority/Status/Removed badge styling and non-color-reliant labels | Badges are styled with accessible labels and are understandable without relying on color alone. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-20 | AC-12 | Planned |
| VISUAL-01 | Visual | Zen Green screenshots across all Lab 2 screens at desktop/tablet/mobile viewports | Screenshots across all required screens demonstrate the required responsive visual style. | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 | Planned |
| E2E-06 | E2E | Responsive layout across all Lab 2 screens (Requester Selection, Create Ticket, My Tickets, Ticket Detail) at desktop/tablet/mobile — no horizontal scroll, stacked controls on mobile | The app renders without horizontal overflow and stacks content correctly across breakpoints. | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 | Planned |

### Required boundary assertions for `MAX_ATTACHMENT_BYTES = 5,000,000`
- `4,999,999` bytes → accepted
- `5,000,000` bytes → accepted
- `5,000,001` bytes → rejected

### Summary and Description trimming boundary assertions (BR-08, BR-09, API-TKT-NOR-01)
**Summary (5–120 chars after trim):**
- 4 chars after trim → rejected
- 5 chars after trim → accepted
- 120 chars after trim → accepted
- 121 chars after trim → rejected
- Whitespace-only input → rejected

**Description (10–2,000 chars after trim):**
- 9 chars after trim → rejected
- 10 chars after trim → accepted
- 2,000 chars after trim → accepted
- 2,001 chars after trim → rejected
- Whitespace-only input → rejected

### Removal reason normalization boundary assertions (BR-19, API-ATT-10)
- Omitted field → stored as null
- Empty string (`""`) → trimmed, stored as null
- Whitespace-only string (e.g., `"     "`) → trimmed, stored as null
- Non-string value (e.g., `123` or `true`) → 400 validation error
- 200-char string after trim → accepted and persisted
- 201-char string after trim → rejected with 400 validation error

### My Tickets invalid filter and pagination behavior (BR-22, BR-23, API-MY-07, API-MY-08)
**Invalid filter parameters:**
- Malformed `categoryId` (e.g., `categoryId=abc` or `categoryId=0.5`) → 400 validation error
- Well-formed but nonexistent `categoryId` → 409 Conflict (referenced record doesn't exist)
- Existing but inactive `categoryId` → 409 Conflict (referenced record is inactive)
- Invalid `requestedPriority` enum (e.g., `requestedPriority=URGENT`) → 400 validation error
- Invalid `status` enum (e.g., `status=CLOSED`) → 400 validation error
- Invalid `sort` field → fallback to default (`createdAt`)
- Invalid `order` value → fallback to default (`desc`)

**Pagination edge cases:**
- missing, malformed, non-integer, `page=0`, or negative → fallback to 1
- `page=999` when totalPages=3 → 200 with empty data array; totalPages=3 in metadata
- `pageSize=0` → fallback to 10
- `pageSize=51` → fallback to 10 (max is 50)
- `pageSize=-1` → fallback to 10

**Search normalization:**
- `?search=` (empty string) → treated as no search filter active
- `?search=     ` (whitespace only) → trimmed, treated as no search filter active
- `?search=%20laptop%20` (trimmed to "laptop") → substring match on "laptop"
- Requester with zero tickets ever, with or without normalized filters → Empty state (`totalItems=0`, `unfilteredTotalItems=0`)
- Requester with ticket history and filters yielding zero rows → No-Results state (`totalItems=0`, `unfilteredTotalItems>0`)

### Canonical parsing and error assertions (API-CONTRACT-01)
- Every non-2xx response matches `{ error: { code, message } }`; every `400` includes `fields`, including `fields.file` for `ATTACHMENT_LIMIT_REACHED`; non-`400` responses omit `fields`.
- `500` is exactly `INTERNAL_ERROR` with the safe generic message and no internal details.
- Requester headers: missing, `abc`, `1.0`, `+1`, whitespace-padded, duplicate, unknown, and inactive all return `422 REQUESTER_CONTEXT_INVALID`.
- Path parameters: malformed attachment IDs and ticket numbers return `404 NOT_FOUND` without resource data.
- JSON endpoints reject malformed JSON, `null`, arrays, scalar JSON, and non-JSON content type with `400 VALIDATION_ERROR`.
- Duplicate query parameters use the first occurrence; query parsing tests cover zero/negative IDs and duplicate values.

### Ticket Number format validation (BR-01, API-TKT-01, API-TKT-NOR-01)
- Must match pattern: `TKT-{YYYY}-{6-digit sequence}` (e.g., `TKT-2026-000001`)
- Two created tickets must have different ticket numbers
- Year in format must match the current calendar year
- Sequence must be exactly 6 digits, zero-padded
- Year is based on a frozen UTC clock at a year boundary
- Concurrent creates must each receive a distinct ticket number
- Sequence exhaustion returns `409 TICKET_SEQUENCE_EXHAUSTED` and persists no ticket

### Create Ticket reference validation error matrix (BR-07, API-TKT-NOR-02)
**For `categoryId` and `relatedSystemId`:**
- Missing field → 400 validation error
- Non-integer value (e.g., `"abc"` or `3.14`) → 400 validation error
- Negative or zero value → 400 validation error
- Positive integer but ID doesn't exist → 409 Conflict (`INACTIVE_REFERENCE`)
- Existing ID but record is inactive (`isActive: false`) → 409 Conflict

### BR-17 partial-success failure cases (must be tested separately)
The UI and tests must distinguish two failure cases — they are **not** the same flow:

**Case A — Ticket creation fails (BR-16, AC-11)**
- No ticket exists.
- Keep all entered form data.
- Show inline error.
- Allow Submit again (manual retry of the full create flow).

**Case B — Ticket creation succeeds but attachment upload fails (BR-17, AC-26)**
- The ticket already exists — do **not** resubmit the ticket (no duplicate).
- Show the generated Ticket Number.
- Report the attachment failure separately.
- Provide a View Ticket / retry-attachment path from Ticket Detail.

**Case C — Multi-file attachment partial success (BR-17, UI-ATT-05)**
- File A uploads successfully → stored, not rolled back
- File B upload fails → reported separately
- File C continues to upload (does not stop after B's failure)
- Failed File B can be retried from Ticket Detail without affecting File A or C

Planned coverage: `UI-TKT-06`, `UI-TKT-08`, `API-ATT-06`, `E2E-04`, `UI-ATT-05`.

### Attachment signature, filename, and concurrency assertions (API-ATT-14)
- Valid fixtures use the exact extension/signature pairs in `api-spec.md`; corrupt or mismatched fixtures return `415 UNSUPPORTED_MEDIA_TYPE` and persist neither storage nor metadata.
- Uppercase allowed extensions are accepted; no extension and an unsupported final extension are rejected.
- Stored names use the generated safe name; original names with path separators/control characters are sanitized before persistence and download disposition.
- A failed PDF first-page render returns the canonical safe `500` response.
- With four active attachments, two concurrent valid uploads yield exactly one `201` and one `400 ATTACHMENT_LIMIT_REACHED`; the final active count is five.

### UI Style / Visual coverage note
Per the Lab 2 handout, planned testing must cover Unit, API/Integration, UI Component,
**UI Style**, Responsive, and E2E levels. UI Style rows (`UI-STYLE-01..03`) assert required
CSS classes, field states, labels, required asterisks, validation messages, button states,
and badge styling. Visual rows (`VISUAL-01`, `E2E-06`) capture Playwright screenshots at
desktop (≥992px), tablet (768–991px), and mobile (<768px) for every Lab 2 screen
(Requester Selection, Create Ticket, My Tickets, Ticket Detail), satisfying AC-23's
"any Lab 2 screen" requirement.

## 5. Commands

Current commands:
```bash
cd server && npm test
cd client && npm test
```

Planned Lab 2 subset commands:
```bash
cd server && npx vitest run tests/lab-02
cd client && npx vitest run src/lab-02-tests
npx playwright test e2e/lab-02
```

Playwright note: run the E2E command only after Playwright scaffolding/dependencies are added for this branch.

## 6. Results Log (Newest First)

### 2026-08-23 - Fix REQUESTER_STORAGE_KEY, agent.md working agreement, and Integration Tests
- Scope: Fixed `REQUESTER_STORAGE_KEY` reference issue in `client/src/api.ts`. Updated `agent.md` working agreement to mandate real-database backend integration testing and client UI storage integration rules. Added real database integration test `server/tests/lab-02/requester-selection.integration.test.ts` and UI storage integration test `client/src/lab-02-tests/RequesterSelection.integration.test.tsx`.
- Tests added/updated: Added `server/tests/lab-02/requester-selection.integration.test.ts`, added `client/src/lab-02-tests/RequesterSelection.integration.test.tsx`, updated `client/src/api.ts`, updated `agent.md`.
- Command(s) run:
  - `cd server && npm test -- --run`
  - `cd client && npm test -- --run`
- Result:
  - Passed: 25 server tests across 5 test files; 11 client tests across 4 test files
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - All unit and integration tests for both client and server are passing against the live database connection and storage APIs.

### 2026-08-23 - Clean up Lab 1 health check leftover endpoint and UI components
- Scope: Removed obsolete `/api/health` endpoint, controller, service logic, client `checkHealth` API method, and Lab 1 "System Overview" / "Check System" UI from `App.tsx`. Updated client and server test suites to focus strictly on Lab 2 Application Shell and Requester Selection.
- Tests added/updated: Updated `client/src/App.test.tsx` for Application Shell navigation and identity display; updated `client/src/lab-02-tests/MyTickets.test.tsx` to remove obsolete health check invocation; deleted obsolete `server/tests/health.test.ts` and `server/tests/health.integration.test.ts`.
- Command(s) run:
  - `cd server && npm test`
  - `cd client && npm test`
- Result:
  - Passed: 21 server tests across 4 test files; 9 client tests across 3 test files
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - The codebase now exclusively serves Lab 2 endpoints and UI components, ensuring full compliance with the closed Lab 2 specification.

### 2026-08-23 - Real database connection, migrations, seed, and active-category contract
- Scope: Verified the configured PostgreSQL connection, applied the pending forward migrations, regenerated Prisma Client, verified active-category filtering against the real database, and checked seed write access and idempotency.
- Tests added/updated: Added `server/tests/categories.service.test.ts` to assert the active-category query includes `where: { isActive: true }`. Existing real-database tests in `server/tests/categories.integration.test.ts` and `server/tests/health.integration.test.ts` were used for connection/API verification.
- Command(s) run:
  - `npx prisma generate`
  - `npx prisma migrate deploy`
  - `npm run prisma:seed` (run twice)
  - `npx prisma migrate status`
  - `npm test -- --run tests/categories.integration.test.ts tests/health.integration.test.ts tests/categories.service.test.ts`
  - `npm run build` (server)
  - `git diff --check`
- Result:
  - Passed: 5 focused tests; 2 seed runs; migration status up to date; 1 server build
  - Failed: 0
  - Skipped/Disabled: 0 in the focused database run
- Notes and follow-up:
  - The configured database is PostgreSQL `tocktick` on `localhost:5432`; credentials are intentionally not logged.
  - The database now has all three migrations in this branch applied.
  - This verifies only the models currently present in `schema.prisma` (`Category` and `DevRequester`). The remaining Lab 2 models and their migration/seed requirements are still planned work for the dependent issues.

### 2026-08-23 - Lab 2 Issue #12 requester selection and context foundation
- Scope: Implemented active Development Requester bootstrap, strict reusable requester-context validation, sessionStorage helpers, requester selection guard, stale-context handling, requester switching, and accessible Zen Green shell states.
- Tests added/updated: Added `server/tests/lab-02/api-contract.api.test.ts` (covers API-REQ-01, API-REQ-02, API-REQ-03, API-CONTRACT-01) and `client/src/lab-02-tests/RequesterSelection.test.tsx` (covers UI-REQ-01 through UI-REQ-07); adapted `client/src/App.test.tsx` for mandatory requester context.
- Command(s) run:
  - `npm test -- --run tests/lab-02/api-contract.api.test.ts`
  - `npm run build` (server)
  - `npm test -- --run src/lab-02-tests/RequesterSelection.test.tsx src/App.test.tsx`
  - `npm run build` (client)
- Result:
  - Passed: 18 focused tests; 2 production builds
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - API-REQ-01 and selector UI rows have executable passing evidence through the files listed above. API-REQ-02 and UI-REQ-06 are marked Implemented where this baseline proves the reusable boundary but does not yet have downstream ticket endpoints to exercise.
  - Full-suite validation and `git diff --check` remain required before commit/push.

### 2026-08-23 - PR #16 re-review contract synchronization (BR-23 duplicate, error codes, attachment lifecycle evidence)
- Scope: Resolved the second PR #16 re-review pass — merged the duplicate `BR-23` into a canonical `BR-23`/`BR-30` pair, froze Ticket Number sequence semantics, added a canonical `error.code` table, froze the attachment storage-access and persistence-compensation invariants (new `BR-31`), and closed the remaining Test-DD gaps (BR-02 currentStatus assertion, backend BR-10 coverage, BR-25 static-verification row, cross-requester attachment ownership, exact `410`/preview assertions, active-count-after-soft-removal boundary, missing-multipart-file case, and split API vs UI responsibility for Empty/No-Results evidence).
- Tests added/updated: Added planned rows `API-TKT-07`, `STATIC-01`, `ATT-PERSIST-01`, `API-ATT-OWN-01`, `API-ATT-15`; tightened `API-TKT-01`, `API-TKT-06`, `API-MY-06`, `API-MY-08`, `API-ATT-01`, `API-ATT-05`, `UI-DETAIL-01`; retargeted `UI-MY-01`, `UI-MY-02`, `UI-MY-05` from `BR-23` to `BR-30`. Updated `specification.md` (BR-01, BR-20/BR-31, BR-23/BR-30, AC-21/AC-22), `api-spec.md` (error-code table, storage-access boundary, 409 code wording), `ui-spec.md` (Unavailable trigger/recovery, Ticket Detail screen-level states), and `agent.md` (branch example).
- Command(s) run:
  - `git status`
- Result:
  - Passed: 0
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - This is a documentation/planned-test contract pass only; the referenced automated test files remain future implementation work.
  - No executable tests exist yet in this repository for Lab 2, so no test run was performed.

### 2026-08-23 - Lab 2 implementation-contract closure
- Scope: Resolved the Empty/No-Results contradiction; standardized API errors and request parsing; specified attachment signatures, filename handling, ordering, and preview failure; and documented ticket/attachment concurrent-write invariants.
- Tests added/updated: Added planned rows `API-CONTRACT-01`, `API-TKT-06`, and `API-ATT-14`; expanded My Tickets, ticket-number, parser, attachment-signature, and concurrency assertions.
- Command(s) run:
  - `git diff --check -- docs/lab-02/api-spec.md docs/lab-02/specification.md docs/lab-02/ui-spec.md docs/lab-02/tests.md`
  - stale-contract phrase scan with `grep`
- Result:
  - Passed: 2
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - This branch contains documentation and planned-test contract changes only; the listed automated test files remain future implementation work.
  - The initial stale-phrase command attempted `rg`, which is unavailable in this shell; the equivalent `grep` scan completed successfully.

Template:
```md
### YYYY-MM-DD - <issue/branch>
- Scope:
- Tests added/updated:
- Command(s) run:
- Result:
  - Passed:
  - Failed:
  - Skipped/Disabled:
- Notes and follow-up:
```

### 2026-08-23 - Lab 2 decision-free agent contract tightening
- Scope: Tightened the requirement contract so a future agent cannot invent product behavior outside the approved Lab 2 scope and must follow explicit precedence rules.
- Tests added/updated: Updated documentation-only contract language in `agent.md` and `docs/lab-02/specification.md`; no executable tests changed.
- Command(s) run:
  - `git diff --check`
- Result:
  - Passed: 1
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - Added a Decision-Free Execution Contract and requirement precedence order to reduce implementation drift.
  - Clarified that missing or contradictory requirements require stopping and requesting approval instead of choosing a design.
  - This keeps the Lab 2 documents aligned to the PDF handout and prevents future agents from improvising beyond the contract.

### 2026-08-22 - PR #16 re-review alignment pass
- Scope: Resolved the remaining Lab 2 contract gaps around migration ownership, seed evidence, attachment confirmation coverage, traceability, UI attachment states, and audit relationships.
- Tests added/updated: Updated planned Test-DD rows and documentation contract only; no executable test files changed.
- Command(s) run:
  - `git diff --check`
  - targeted marker validation for the updated specification
- Result:
  - Passed: 1
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - Added DB-01/DB-02 and SEED-01/SEED-02 with concrete planned test paths.
  - Split API-ATT-08 from UI-ATT-04 and removed unrelated AC mappings from BR-only rows.
  - Added explicit Uploading and Unavailable attachment states and visual evidence paths.
  - GitHub Issue #11 now delegates the final release gate to Issue #18, the dedicated integration/release issue.

### 2026-08-22 - Lab 2 handout alignment audit
- Scope: Verified the Lab 2 engineering-contract documents against `Lab_02_labsheet.pdf` and aligned the planned-test table terminology with the required handout format.
- Tests added/updated: Updated Test-DD table headings only; no executable test files changed.
- Command(s) run:
  - `pdftotext -layout Lab_02_labsheet.pdf Lab_02_labsheet.txt`
  - static markdown structure validation of Lab 2 documents
- Result:
  - Passed: 1
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - The table now explicitly uses `Type`, `What It Tests`, `Automated Test File`, and `Requirement / AC` while retaining FR/BR traceability.
  - Product implementation, executable Lab 2 tests, screenshots, and the final Answer Part 1-9 PDF remain future delivery work.

### 2026-08-22 - PR #16 re-review contract fixes
- Scope: Restored the Category migration contract, extended the planned-test table to the handout-required shape, and added the remaining direct BR coverage needed for the Lab 2 baseline.
- Tests added/updated: Updated the planned Test-DD matrix and traceability rows only; no executable test files changed.
- Command(s) run:
  - static markdown validation of the Lab 2 requirement docs
- Result:
  - Passed: 1
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - Added `Expected Result` and `Final` to the planned-test table.
  - Preserved `Category.createdAt` in the schema baseline and documented the migration-safe contract.
  - Added explicit direct scenarios for BR-05, BR-13, BR-19, BR-21, BR-22 and removed BR-16 from non-create ticket rows.
  - Final issue lifecycle/owner cleanup remains a GitHub issue-level follow-up rather than a repo-doc contract fix.

### 2026-08-22 - PR #16 follow-up review fixes
- Scope: Reconciled agent approval policy, Ticket Date ownership, Test-DD BR coverage, and required Ticket Detail UI planning coverage.
- Tests added/updated: Updated planned traceability rows only; no executable test files changed.
- Command(s) run:
  - markdown structure and required-string validation
- Result:
  - Passed: 1
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - Added `RequesterTicketDetail.test.tsx` coverage for read-only, loading, failure/not-found, attachment, and control states.
  - Added explicit scenarios for BR-06, BR-10, BR-11, BR-26, BR-27, BR-29, My Tickets loading/failure, and Ticket Date authority.
  - Commit and push still require separate explicit user approval.

### 2026-08-22 - issue-1 review fixes (PR #16)
- Scope: Addressed reviewer findings on `tests.md` traceability, UI-style/visual coverage, BR-17 partial-success flow, and BR ID normalization.
- Tests added/updated: No executable test files changed (planning rows only).
- Command(s) run:
  - static validation of edited markdown files
- Result:
  - Passed: 0
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - Added UI-STYLE-01..03, VISUAL-01, E2E-06 (responsive across all screens), UI-TKT-06 / API-ATT-06 / E2E-04 (BR-17 partial success), UI-ATT-03 (client-side oversized rejection for AC-09).
  - Corrected API-TKT-02 → AC-27, API-MY-01 → AC-03, split API-ATT-03 into UNIT-ATT-01 + API-ATT-03.
  - Normalized BR-03a→BR-21, BR-Attach-metadata→BR-26, BR-Attach-storage→BR-27, BR-Attach-preview→BR-28, BR-inactive→BR-29.

### 2026-08-22 - issue-1 requirement baseline docs
- Scope: Documentation/process baseline updates for Lab 2.
- Tests added/updated: No executable test files changed.
- Command(s) run:
  - static validation of edited markdown files
- Result:
  - Passed: 0
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - This was a documentation alignment step only.

## 7. Known Gaps and Risks
- Playwright scaffolding is not yet in this starter branch.
- Root-level `test:lab02` orchestration script is not yet added.
- Lab 2 models/endpoints are not yet implemented, so matrix rows are contractual planning rows.