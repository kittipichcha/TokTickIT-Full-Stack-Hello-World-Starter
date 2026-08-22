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
- FR-01: covered by Requester Selection and requester-context tests (`UI-REQ-01`, `UI-REQ-02`, `API-REQ-02`, `API-REQ-03`).
- FR-02: covered by Create Ticket and validation tests (`API-TKT-NOR-01`, `API-TKT-NOR-02`, `API-TKT-01`, `UI-TKT-01..07`, `UI-ERR-01`).
- FR-03: covered by generated ticket number tests (`API-TKT-01`).
- FR-04 / FR-05 / FR-06 / FR-07 / FR-08: covered by My Tickets tests (`API-MY-01..08`, `UI-MY-01..04`).
- FR-09: covered by owner isolation and detail tests (`API-TKT-03`, `API-MY-01`, `UI-DETAIL-01`).
- FR-10 / FR-11 / FR-12 / FR-13: covered by Attachment tests (`API-ATT-01..13`, `UI-ATT-01..04`, `UI-DETAIL-01`).
- FR-14 / FR-15: covered by requester switching and inactive-requester tests (`UI-REQ-02`, `API-REQ-02`, `UI-MY-03`).
- FR-16: covered by Empty/No-Results tests (`UI-MY-01`, `UI-MY-02`, `API-MY-08`).
- FR-17: covered by create failure and state-preservation tests (`UI-TKT-05`, `UI-ERR-01`, `E2E-04`).

### 4.2 BR coverage summary
All BR rules are represented either directly in a corresponding planned test or by a closed requirement statement in the specification and API contract. The contract explicitly freezes the behaviors for summary/description trimming, invalid IDs, filters, search, pagination, requester enforcement, attachment removal metadata, and multi-file partial success.

### 4.3 AC coverage summary
Each acceptance criterion is mapped into the planned test matrix. The implementation must not treat any AC as “informal” because each AC is tied to a concrete API/UI test or a specified business rule.

### 4.4 Decision-free boundaries and invalid permutations
The following conditions are explicitly enumerated and must not be reinterpreted:
- Empty/blank/whitespace-only input for summary, description, search, and removal reason
- Malformed, nonexistent, inactive, and negative reference IDs
- Invalid enums for requestedPriority, status, sort, and order
- Valid but out-of-range pagination requests
- Multi-file partial success sequences and per-file reporting
- Empty vs No-Results logic based on active filters/search state
- Soft-delete metadata and `removedByRequesterId` enforcement

## 5. Test Traceability Matrix (Planned Contract)

| Test ID | Type | What It Tests | Expected Result | Automated Test File | FR | BR | Requirement / AC | Final |
|---|---|---|---|---|---|---|---|---|
| API-REQ-01 | API | Selector returns only active development requesters | Returns only active requesters and excludes inactive ones from the selector payload. | `server/tests/lab-02/dev-requesters.api.test.ts` | FR-01, FR-15 | BR-03, BR-04 | AC-15 | Planned |
| UI-REQ-01 | UI | Route guard redirects to selector when requester context missing | Missing requester context redirects to the selector screen without crashing. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-21, BR-05 | AC-02 | Planned |
| UI-REQ-02 | UI | Stale/inactive requester context clears sessionStorage and shows explanatory message | Stored requester is cleared, the app redirects to selector, and the user sees a clear inactive-requester message. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-05, BR-21 | AC-02, AC-15 | Planned |
| API-REQ-02 | API | Requester-scoped endpoints reject missing/unknown/inactive `X-Dev-Requester-Id` with 422 while historical tickets remain persisted and unreachable through requester flows | Missing/invalid/inactive requester headers are rejected, while historical records remain persisted but non-reachable in requester flows. | `server/tests/lab-02/requester-context.api.test.ts` | FR-15 | BR-04, BR-05, BR-21, BR-29 | AC-15 | Planned |
| API-REQ-03 | API | Bootstrap/reference endpoints do not require requester headers | `GET /api/dev-requesters` and reference-data endpoints still function without `X-Dev-Requester-Id`. | `server/tests/lab-02/requester-context.api.test.ts` | FR-15 | BR-21 | — | Planned |
| DB-01 | Integration | Fresh database migrates to the Lab 2 schema | Forward migration creates all required tables, fields, constraints, relations, and indexes without resetting the database. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Planned |
| DB-02 | Integration | Existing Lab 1 Category rows survive the Lab 2 migration | Existing Category `id`, `name`, and `createdAt` values remain unchanged and `isActive` is backfilled to `true`. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Planned |
| SEED-01 | Integration | Seed is idempotent when run twice | Running the seed twice creates no duplicate Requesters, Categories, or Related Systems and does not replace existing required Categories. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Planned |
| SEED-02 | Integration | Seed contains the required reference and requester records | Seed contains exactly four required Categories, at least six Related Systems, at least four active Requesters, and at least one inactive Requester. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Planned |
| API-REF-01 | API | GET /api/categories returns only active Categories with correct response shape | The endpoint returns an array of active Category objects with Lab 1 raw-array response shape (no `{ data: [...] }` envelope). | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Planned |
| API-REF-02 | API | GET /api/related-systems returns only active Related Systems with standard envelope | The endpoint returns `{ data: [...] }` with only active Related System objects. | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Planned |
| UI-REQ-03 | UI | Requester Selection loading state shows skeleton/spinner | The loading state displays while fetching active requesters from the API. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-04 | — | Planned |
| UI-REQ-04 | UI | Requester Selection empty state for zero active requesters | When no active requesters exist, a clear empty-state message is shown instead of a blank dropdown. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-04 | — | Planned |
| UI-REQ-05 | UI | Requester Selection API failure shows error with manual Retry button | API failure shows an error message and a Retry action; Continue remains disabled until selection succeeds. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | — | — | Planned |
| UI-REQ-06 | UI | Requester Selection stores selected requester in sessionStorage and sends X-Dev-Requester-Id header | The client directly demonstrates that `X-Dev-Requester-Id` header is sent on API calls and the requester ID is persisted in sessionStorage. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-21 | — | Planned |
| API-TKT-NOR-01 | API | Summary/Description trimming and boundary behavior | Summary and Description are trimmed before validation; trimmed values are validated and persisted. Boundary: 5/4/120/121 chars for summary; 10/9/2000/2001 chars for description (inclusive/exclusive). Whitespace-only input rejected. | `server/tests/lab-02/create-ticket-normalization.api.test.ts` | FR-02 | BR-08, BR-09 | — | Planned |
| API-TKT-NOR-02 | API | CategoryId/RelatedSystemId validation with malformed, nonexistent, and inactive cases | Malformed (non-integer) → 400; well-formed but nonexistent → 409; existing but inactive → 409. | `server/tests/lab-02/create-ticket-normalization.api.test.ts` | FR-02 | BR-07 | — | Planned |
| API-TKT-01 | API | Create ticket success: returns generated ticket number matching TKT-{YYYY}-{6-digit} format, verifies uniqueness | A valid create request creates exactly one ticket, returns the official backend-generated ticket number matching the format pattern, and verifies two tickets receive different numbers. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-03 | BR-01, BR-02 | AC-01 | Planned |
| API-TKT-04 | API | Ownership is assigned from `X-Dev-Requester-Id` at creation and cannot be changed by the client | The server assigns ownership from the caller header and ignores any client-provided mismatch. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-04 | BR-06, BR-21, BR-24 | — | Planned |
| API-TKT-05 | API | Requester-created tickets keep IT Priority and Ticket Owner null | `itPriority` and `ticketOwnerId` remain `null` on requester-created tickets. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-11 | — | Planned |
| UI-TKT-07 | UI | Requested Priority control is required and defaults to MEDIUM | The field defaults to `MEDIUM` and blocks submission if the value is missing from the form model. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-10 | — | Planned |
| UI-TKT-01 | UI | Empty summary blocks submit and shows field error | The summary field shows a direct validation error and no API call is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-04 | Planned |
| UI-TKT-02 | UI | Summary over 120 chars blocks submit with length error | A summary longer than 120 chars is rejected with a field-level message. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-05 | Planned |
| UI-TKT-03 | UI | Description under 10 chars blocks submit with field error | A description shorter than 10 chars is rejected before request submission. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-09 | AC-06 | Planned |
| UI-TKT-04 | UI | Submit busy state prevents duplicate submission | While a create request is in flight, the button is disabled and no second request is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-15 | AC-10 | Planned |
| UI-TKT-05 | UI | Case A — failed create keeps entered values and shows inline error | A failed create request preserves all form values and shows a manual-retry inline error without auto-retrying. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 | Planned |
| UI-TKT-06 | UI | Case B — partial success: ticket created but attachment upload failed shows Ticket Number, separate attachment error, and blocks ticket resubmission | The created ticket remains saved, a separate attachment failure is reported, and the user is not shown a duplicate create flow. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | Planned |
| API-TKT-02 | API | Inactive/stale category or related-system ID rejected with 409 | Replacing an active category or related system with a stale/inactive ID fails with `409 Conflict` and no ticket is saved. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-07 | AC-27 | Planned |
| API-TKT-03 | API | Ticket detail returns 404 for non-owner access | Requests for another Requester's ticket return `404 Not Found` and no data is exposed. | `server/tests/lab-02/ticket-detail.api.test.ts` | FR-09 | BR-24 | AC-03 | Planned |
| API-MY-01 | API | My Tickets returns only current requester-owned tickets (ownership isolation) | Only tickets belonging to the current requester are returned, even when other tickets exist. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-04 | BR-24 | AC-03 | Planned |
| API-MY-02 | API | Search by ticket number/summary substring | Search matches ticket numbers and summary substrings for the current requester only. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05 | BR-22 | AC-17 | Planned |
| API-MY-03 | API | Category/Priority/Status filters are conjunctive | The list applies all selected filters together and returns only intersection matches. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-06 | BR-22 | AC-18 | Planned |
| API-MY-04 | API | Deterministic sort order with tie-breakers and priority ordering | Sort order is deterministic using selected field/direction and then `createdAt desc`, `id desc` as tie-breakers. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-07 | BR-22 | AC-19 | Planned |
| API-MY-05 | API | Pagination returns correct page metadata and slices | Page and pageSize metadata are returned accurately and the correct slice of results is delivered. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-08 | BR-22 | AC-20 | Planned |
| API-MY-06 | API | Default list values and invalid parameter fallback | Omitted list params use `page=1`, `pageSize=10`, `sort=createdAt`, `order=desc`; invalid values fall back to the safe documented defaults. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05, FR-06, FR-07, FR-08 | BR-22 | AC-17, AC-18, AC-19, AC-20 | Planned |
| API-MY-07 | API | Invalid filter parameter values: malformed categoryId, invalid enums, out-of-range pagination | Malformed categoryId (non-integer) → 400; invalid requestedPriority/status enums → 400; out-of-range page → 200 with empty data array and accurate pagination metadata. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05, FR-06, FR-08 | BR-22, BR-23-FILTER-INVALID | — | Planned |
| API-MY-08 | API | Search normalization: trimming, blank-after-trim, and Empty vs No-Results | Search is trimmed; blank-after-trim search is treated as no filter active. Results with no filters = Empty state; results with active filters = No-Results. | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05 | BR-23-SEARCH, BR-23-STATES | — | Planned |
| API-ATT-09 | API | Attachment list ordering is deterministic (uploadedAt asc, id asc) | Attachment listing returns results in deterministic order for stable pagination and reproducible tests. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | — | — | Planned |
| API-ATT-10 | API | Removal reason normalization and boundary behavior | Omitted/blank-after-trim reason → null; 200-char reason → accepted; 201-char reason → rejected; non-string → 400 validation error. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | Planned |
| API-ATT-11 | API | Multi-file attachment partial success: sequential upload, failure isolation, continuation, per-file reporting | When uploading multiple files, failed attachments do not roll back successful ones; remaining files continue; failures are reported per file. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-17-MULTI-ATTACH | — | Planned |
| API-ATT-12 | API | Soft-remove idempotency: removing twice returns 409 Conflict on second attempt | A removed attachment cannot be removed again; second DELETE returns 409 rather than silently succeeding. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | Planned |
| API-ATT-13 | API | Removal sets removedByRequesterId to the current requester | When soft-removing an attachment, `removedByRequesterId` is set to the `X-Dev-Requester-Id` of the caller. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | Planned |
| UI-MY-01 | UI | Empty state shown for requester with zero tickets ever | A requester with no tickets ever sees the Empty state and a Create Ticket call to action. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23-STATES | AC-21 | Planned |
| UI-MY-02 | UI | No-results state shown for active filters yielding zero rows | Filters/search with zero matches show the No-Results state and Clear Filters action. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23-STATES | AC-22 | Planned |
| UI-MY-03 | UI | Requester switch clears prior data and reloads new scope | Switching Requester clears the previous list and reloads the current Requester's tickets. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-14 | BR-14 | AC-14 | Planned |
| UI-MY-04 | UI | My Tickets loading and API failure states show skeleton/error with manual Retry | The list shows loading and failure states and requires a manual retry action instead of automatic reload. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-04, FR-17 | — | — | Planned |
| API-ATT-01 | API | Attachment type/content validation matrix | Allowed extension + invalid content is rejected; disallowed extension + valid content is rejected; allowed extension + matching content is accepted. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12, BR-13 | AC-07 | Planned |
| UI-ATT-01 | UI | Disallowed attachment type rejected client-side | The client blocks an unsupported file type before upload and shows a clear explanation. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 | Planned |
| API-ATT-02 | API | Sixth active attachment rejected by server limit | Uploading the sixth active attachment is rejected with the server limit message. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-08 | Planned |
| UNIT-ATT-01 | Unit | Attachment size boundary validator: 4,999,999 / 5,000,000 accepted, 5,000,001 rejected | Boundary validation accepts 4,999,999 and 5,000,000 bytes and rejects 5,000,001. | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12 | AC-09 | Planned |
| API-ATT-03 | API | Oversized attachment upload rejected by server with 413 | An over-limit file is rejected by the API with the correct status and no storage. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 | Planned |
| UI-ATT-03 | UI | Selecting an oversized file shows size error immediately and prevents upload (client-side rejection) | Oversized files are rejected before upload with a size message and no network request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12 | AC-09 | Planned |
| API-ATT-04 | API | Soft remove marks removed metadata and disables access | A soft delete sets `isRemoved`, `removedAt`, `removalReason`, and `removedByRequesterId` and blocks preview/download. | `server/tests/lab-02/attachments.api.test.ts` | FR-11, FR-13 | BR-18, BR-19 | AC-12, AC-13 | Planned |
| API-ATT-05 | API | Preview/download endpoint behavior for active vs removed files | Active attachments preview/download normally; removed attachments are denied and return error responses. | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18, BR-28 | AC-13, AC-24 | Planned |
| API-ATT-08 | API | Removal reason validation | An omitted reason is accepted, a 200-character reason is accepted, and a 201-character reason is rejected. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | Planned |
| UI-ATT-04 | UI | Removal confirmation dialog and cancel behavior | Remove opens a confirmation dialog; Cancel closes it without sending a DELETE request; Confirm sends the removal request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-19 | — | Planned |
| UI-ATT-02 | UI | Removed attachment row shows Removed badge and disabled controls | A removed attachment remains listed with a de-emphasized Removed badge and disabled Download/Preview actions. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-20 | AC-12 | Planned |
| API-ATT-06 | API | BR-17 partial success: ticket POST succeeds, attachment upload fails, ticket persists and is not rolled back | The ticket remains persisted after attachment failure and no duplicate ticket is created. | `server/tests/lab-02/attachments.api.test.ts` | FR-02, FR-10 | BR-17 | AC-26 | Planned |
| API-ATT-07 | API | Attachment metadata is persisted and stored filename is generated safely with validated extension | Metadata is saved and the stored filename is generated using a sanitized UUID+extension pattern. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-26, BR-27 | — | Planned |
| UI-DETAIL-01 | UI | Ticket Detail renders read-only fields, loading/failure/not-found states, active and removed attachments, Preview/Download/Remove, and Add Attachment controls | The detail screen shows read-only ticket data, attachment state, and the correct controls for active vs removed attachments. | `client/src/lab-02-tests/RequesterTicketDetail.test.tsx` | FR-09, FR-10, FR-11, FR-12, FR-13, FR-17 | BR-18, BR-20, BR-24, BR-28 | AC-03, AC-12, AC-13, AC-24 | Planned |
| E2E-01 | E2E | Requester creates ticket and later finds it in My Tickets | The full requester flow ends with a visible ticket in the requester's My Tickets list. | `e2e/lab-02/requester-ticket-flow.spec.ts` | FR-02, FR-04 | BR-01, BR-22 | AC-01, AC-17 | Planned |
| E2E-02 | E2E | Ownership isolation across two requester contexts | Requester A and B cannot see each other's tickets and ownership enforcement works end-to-end. | `e2e/lab-02/ownership.spec.ts` | FR-09 | BR-24 | AC-03 | Planned |
| E2E-03 | E2E | Full attachment lifecycle (upload/preview/download/remove) | Users can add, preview, download, and remove attachments on their own tickets without breaking the ticket flow. | `e2e/lab-02/attachment-lifecycle.spec.ts` | FR-10, FR-11, FR-12, FR-13 | BR-12, BR-18, BR-28 | AC-07, AC-12, AC-13, AC-24 | Planned |
| E2E-04 | E2E | BR-17 partial success: ticket created, attachment upload fails, ticket persists, no duplicate, retry from Ticket Detail | Ticket creation succeeds, attachment failure is reported separately, and the user can retry the attachment without creating a duplicate. | `e2e/lab-02/partial-success-attachment.spec.ts` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | Planned |
| E2E-05 | E2E | Keyboard-only create-ticket flow with visible focus indicators | Keyboard users can complete the flow with visible focus and no inaccessible inputs. | `e2e/lab-02/keyboard-access.spec.ts` | — | — | AC-25 | Planned |
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

### My Tickets invalid filter and pagination behavior (BR-22, BR-23-FILTER-INVALID, BR-23-SEARCH, API-MY-07, API-MY-08)
**Invalid filter parameters:**
- Malformed `categoryId` (e.g., `categoryId=abc` or `categoryId=0.5`) → 400 validation error
- Well-formed but nonexistent `categoryId` → 409 Conflict (referenced record doesn't exist)
- Existing but inactive `categoryId` → 409 Conflict (referenced record is inactive)
- Invalid `requestedPriority` enum (e.g., `requestedPriority=URGENT`) → 400 validation error
- Invalid `status` enum (e.g., `status=CLOSED`) → 400 validation error
- Invalid `sort` field → fallback to default (`createdAt`)
- Invalid `order` value → fallback to default (`desc`)

**Pagination edge cases:**
- `page=0` or negative → fallback to 1
- `page=999` when totalPages=3 → 200 with empty data array; totalPages=3 in metadata
- `pageSize=0` → fallback to 10
- `pageSize=51` → fallback to 10 (max is 50)
- `pageSize=-1` → fallback to 10

**Search normalization:**
- `?search=` (empty string) → treated as no search filter active
- `?search=     ` (whitespace only) → trimmed, treated as no search filter active
- `?search=%20laptop%20` (trimmed to "laptop") → substring match on "laptop"
- Empty result with no filters → Empty state (totalItems=0, no filters active)
- Empty result with filters → No-Results state (totalItems=0, filters active)

### Ticket Number format validation (BR-01, API-TKT-01, API-TKT-NOR-01)
- Must match pattern: `TKT-{YYYY}-{6-digit sequence}` (e.g., `TKT-2026-000001`)
- Two created tickets must have different ticket numbers
- Year in format must match the current calendar year
- Sequence must be exactly 6 digits, zero-padded

### Create Ticket reference validation error matrix (BR-07, API-TKT-NOR-02)
**For `categoryId` and `relatedSystemId`:**
- Missing field → 400 validation error
- Non-integer value (e.g., `"abc"` or `3.14`) → 400 validation error
- Negative or zero value → 400 validation error (or 409, depending on DB constraint)
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

**Case C — Multi-file attachment partial success (BR-17-MULTI-ATTACH, API-ATT-11)**
- File A uploads successfully → stored, not rolled back
- File B upload fails → reported separately
- File C continues to upload (does not stop after B's failure)
- Failed File B can be retried from Ticket Detail without affecting File A or C

Planned coverage: `UI-TKT-06`, `API-ATT-06`, `E2E-04`, `API-ATT-11`.

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
- Tests added/updated: Updated documentation-only contract language in `AGENT.md` and `docs/lab-02/specification.md`; no executable tests changed.
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