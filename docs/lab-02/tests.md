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

## 2a. Execution Evidence (2026-08-27)

### Server My Tickets tests
- **Command**: `npx vitest run tests/lab-02/` (from `server/`)
- **Result**: 18 test files, 256 tests passed, 0 failed
- **Real-DB suite**: Executed with `DATABASE_URL` present — all `itIfDb` tests ran (not skipped)
- **Real-DB My Tickets tests**: All 12 test groups executed against real database, including literal search semantics for `%`, `_`, `\`, response shape verification, summary ordering with distinct values, pagination slice correctness, empty/no-results metadata, zero-totalPages giant-page safety, and duplicate query parameter handling

### Safe-integer page guard tests (BLOCKING ISSUE #1 — 2026-08-27)
- **Added `Number.isSafeInteger()` guard** in the controller: pages exceeding `Number.MAX_SAFE_INTEGER` now fall back to `page=1` instead of being passed to the service
- **Added early return in the service**: when `totalPages === 0` or `page > totalPages`, returns empty `data` with correct pagination metadata — no SQL `OFFSET` is executed
- **Consolidated the early-return condition**: the original `page > totalPages && totalPages > 0` was merged with `totalPages === 0` into a single branch: `totalPages === 0 || params.page > totalPages`. This ensures that when `totalPages === 0` (no matching data), the service returns immediately without calculating a potentially huge `OFFSET`.
- **New test cases added to `my-tickets-real-db.integration.test.ts`**:
  - `Number.MAX_SAFE_INTEGER` (9007199254740991) with a requester having zero tickets (`totalPages=0`) — returns `200` with empty data and correct metadata, no SQL OFFSET executed
  - `Number.MAX_SAFE_INTEGER` (9007199254740991) with a requester having tickets but a filter that matches nothing (`totalItems=0`, `unfilteredTotalItems>0`) — also returns `200` with empty data and correct metadata
- All new tests verify the service returns early without executing a SQL query containing a giant `OFFSET`

### Client My Tickets tests
- **Command**: `npx vitest run src/lab-02-tests/MyTickets.test.tsx` (from `client/`)
- **Result**: 15 tests passed, 0 failed
- **All tests executed**: No tests skipped unexpectedly
- **Mobile expansion tests**: All 5 tests (initially collapsed, expansion, collapse, keyboard activation, independent per-card state) executed and passed
- **Out-of-range page test**: Executes the intended branch — component requests page > totalPages, detects out-of-range, redirects to last valid page
- **Retry test**: Proves no automatic retry (waits and counts calls) and exactly one additional request after clicking Retry
- **Stale-response test (UI-MY-07)**: Uses deferred promises to verify that a slow earlier request cannot overwrite a newer result

### Execution Evidence (2026-08-28) — Post-Review Fixes and Issue #15 Completion

All seven blocking issues from the code review have been resolved. Below is the final execution evidence.

#### Server attachment tests (API-layer mocked)
- **Command**: `npx vitest run tests/lab-02/attachments.api.test.ts tests/lab-02/attachment-validation.unit.test.ts` (from `server/`)
- **Result**: 2 test files, 51 tests passed, 0 failed
- **Covers**: API-ATT-01—10, API-ATT-11 (DELETE content-type), API-ATT-12—15, API-ATT-16 (attachment ID range), API-ATT-OWN-01, UNIT-ATT-01, UNIT-ATT-02 (extension matrix), UNIT-ATT-03 (signature matrix), ATT-SIZE-01, ATT-SIZE-02
- **API-ATT-03 fix**: Now uses a real 5,000,001-byte buffer that triggers multer's `LIMIT_FILE_SIZE` instead of a mocked 400 path. Asserts 413 with `FILE_TOO_LARGE` and verifies `uploadAttachment` was never called.
- **ATT-SIZE-01**: Explicitly verifies 4,999,999 bytes is accepted (201).
- **ATT-SIZE-02**: Explicitly verifies 5,000,000 bytes is accepted (201) — the Multer transport limit was raised above the business maximum so the service-level validator can accept it.
- **UNIT-ATT-02/03**: The extension and content-signature validators are now tested directly against the production functions (`validateExtension`, `validateContentSignature`) — allowed extensions, upper/mixed case, unsupported/no/double extensions, and the JPG/JPEG/PNG/WEBP/PDF signature matrix plus wrong-signature and truncated-buffer rejection.
- **API-ATT-11**: DELETE content-type handling per api-spec §0 — omitted body (no content type) and JSON body with `application/json` are accepted; a body with a non-JSON content type or no content type returns `400 VALIDATION_ERROR` and never reaches the removal service.
- **API-ATT-16**: Attachment ID range validation — a normal valid ID reaches the service; an ID above the PostgreSQL `INTEGER` max (`2147483647`) or a sufficiently large digit-only ID returns `404 NOT_FOUND` (never a `500`) and never reaches Prisma; the same guard applies to download, preview, and delete.

#### Server attachment integration tests (real database — `itIfDb` all executed)
- **Command**: `npx vitest run tests/lab-02/attachment-concurrency.integration.test.ts tests/lab-02/attachment-persistence-compensation.integration.test.ts tests/lab-02/attachment-ownership.integration.test.ts` (from `server/`)
- **Result**: 3 test files, 11 tests passed, 0 failed
- **Real-DB suite**: Executed with `DATABASE_URL` present — all `itIfDb` tests ran (not skipped)
- **Concurrency test** (`API-ATT-14`): Creates a real ticket, populates 4 active attachments, sends 2 concurrent uploads via `Promise.all`. Asserts exactly 1 succeeds (201) and exactly 1 receives `ATTACHMENT_LIMIT_REACHED` (400). Queries the real database to verify active count never exceeds 5. This proves the `SELECT ... FOR UPDATE` row lock works.
- **Ownership isolation** (`API-ATT-OWN-INT`): Non-owned uploads return identical `404 NOT_FOUND` for valid, missing, oversized, and invalid-media files — proving the ownership pre-check runs before multipart validation.
- **Cross-requester ownership matrix** (`API-ATT-OWN-MATRIX`): Requester B cannot list, download, preview, or delete Requester A's attachment — each returns the safe `404 NOT_FOUND` shape with no file bytes, and the database record remains unchanged (still active, owned by A). Requester A can still download the attachment afterward.
- **Concurrent removal** (`API-ATT-REM-CONC`): Two simultaneous DELETEs produce exactly one `200` and one `409`, with correct persisted `isRemoved`, `removedAt`, `removedByRequesterId`, and `removalReason` metadata.
- **Persistence compensation** (`ATT-PERSIST-01`): Uploads a valid JPEG to a real ticket, asserts 201 with correct metadata, verifies the attachment row exists in the database, and confirms `storedFilename` is not API-exposed.
- **Persistence compensation** (`ATT-PERSIST-02`): Injects a deterministic metadata-persistence failure after the physical file write, asserts 500 INTERNAL_ERROR, verifies the physical file was deleted (filesystem count unchanged), confirms no Attachment row exists in the database, and verifies the failed attachment is not API-exposed via the list endpoint. Uses a shared test seam (`test-seams.ts`) rather than mocking Prisma.
- **Transaction-wide compensation** (`ATT-PERSIST-03`): Injects a failure AFTER the metadata insert succeeds but BEFORE the transaction commits, and verifies the physical file is deleted and the Attachment row is rolled back — proving compensation covers the entire transaction, not just the metadata insert.
- **UUID stored filename** (`ATT-PERSIST-04`): Inspects the real Attachment row to verify the stored filename is a UUID + allowed extension, the original filename is preserved as metadata, the physical file exists on disk, and `storedFilename` is never API-exposed.
- **Removed access** (`ATT-PERSIST-05`): Soft-removes a real attachment and verifies download/preview return `410 ATTACHMENT_REMOVED` while the list still shows the removed metadata.

#### Client attachment UI tests
- **Command**: `npx vitest run src/lab-02-tests/AttachmentSection.test.tsx src/lab-02-tests/CreateTicket.test.tsx src/lab-02-tests/format.test.ts` (from `client/`)
- **Result**: 3 test files, 60 tests passed, 0 failed
- **Covers**: UI-ATT-01 (disallowed type rejection), UI-ATT-02 (removed badge + disabled controls), UI-ATT-03 (oversized rejection), UI-ATT-04 (removal dialog cancel), UI-ATT-05 (multi-file A/B/C partial success), UI-ATT-06 (failed attachment retry from Ticket Detail), UI-ATT-07 (removal dialog accessibility — focus trap, Escape, focus restore), UI-ATT-08 (Unavailable state on Preview/Download failure + Add Attachment upload failure retry), UI-TKT-CAP-01 (Create Ticket five-file capacity), UI-ATT-CAP-01 (Ticket Detail five-file capacity), UI-ATT-RETRY-OWN (retry scoped to requester + ticket), UI-ATT-MUT-REF (mutation success is terminal — refresh failure is not a mutation failure), UI-ATT-RETRY-TERMINAL (retry upload success is terminal — refresh failure must not restore the retry row), UI-DETAIL-01 (Ticket Detail screen-level state matrix), UI-TKT-08 (valid + invalid pre-submit attachments submit the ticket with only the valid file), format.test (RFC 5987 `filename*` parsing)
- **UI-ATT-07**: The Escape test now actually dispatches an `Escape` keyboard event against the dialog (not Cancel), and the focus-restoration test asserts `document.activeElement === originalRemoveButton`.
- **UI-ATT-RETRY-OWN**: Proves the failed-attachment retry state is scoped by `requesterId + ticketNumber`. Two executable tests: (1) a failed attachment from Ticket A is absent when viewing Ticket B (ticket switching), and (2) after a failed retry is present on requester 1's ticket detail, changing requester to requester 2 clears the stale failed-attachment state — `a-switch.jpg` and its `Retry` row never resurface in requester 2's shell.
- **UI-ATT-RETRY-TERMINAL**: Proves that after an initial upload failure, a successful retry upload permanently clears the failed row even when the subsequent refresh fails — `uploadAttachment` runs exactly once during the retry and the refresh failure is shown as a separate detail error.
- **UI-TKT-08**: Proves the full valid + invalid submission orchestration — the invalid file is visibly rejected, the valid file remains accepted, submitting calls `createTicket()` exactly once and `uploadAttachment()` exactly once with the valid file (never the invalid one), and the success state is displayed.
- **UI-DETAIL-01**: Directly verifies the required screen-level matrix — read-only fields (no editable inputs), loading skeleton, safe 404 with no data leak, error state with a Retry control that refetches, active attachment with Preview/Download/Remove, removed attachment with disabled controls, preview/download API invocation, removal through the confirmation dialog, and Add Attachment capacity.
- **format.test**: `parseContentDispositionFilename` prefers the RFC 5987 `filename*` value (decoded) over the ASCII `filename` fallback, falls back correctly when only `filename=` exists, and returns null when neither is present.

#### Full server suite with real database
- **Command**: `npx vitest run` (from `server/`)
- **Result**: 26 test files, 335 tests passed, 0 failed — all 8 `itIfDb` integration test files executed
- **Key additions**: real-DB ownership, concurrent-removal, transaction-wide compensation, UUID stored-filename, and cross-requester list/download/preview/delete ownership integration tests
- **No regressions**: All prior #13/#14 tests continue to pass alongside new #15 attachment tests

#### Full client suite
- **Command**: `npx vitest run` (from `client/`)
- **Result**: 8 test files, 100 tests passed, 0 failed
- **Key additions**: `AttachmentSection.test.tsx` and `CreateTicket.test.tsx` expanded to cover the full attachment state matrix, five-file capacity, retry ownership scoping (ticket + requester switch), mutation/refresh separation, retry terminal-state, the UI-DETAIL-01 matrix, UI-TKT-08, and RFC 5987 filename parsing.

#### Client build verification
- **Command**: `npm run build` (from `client/`)
- **Result**: TypeScript compilation passes, Vite production build succeeds

#### Server build verification
- **Command**: `npm run build` (from `server/`)
- **Result**: TypeScript compilation passes

### PR #28 Review Status (2026-08-27)

**Reviewer:** @oangsa — **State:** `CHANGES_REQUESTED`

@oangsa reviewed PR #28 at head `1a70c7dab43831d82356b88fe6b520a00ebbe861` and raised five blocking (P1) findings. All five have been addressed at the current head `0042f782857f2f2033e94a93621869005c589d1e`:

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | **API response shape** — My Tickets response missing `itPriority`, adds undocumented `requesterId` | ✅ **Fixed** | `itPriority: string \| null` added to SQL query (`service.ts` line 481), service `MyTicketItem`, and client `api.ts` interface. Response-shape verification tests in both `my-tickets.api.test.ts` and `my-tickets-real-db.integration.test.ts`. |
| 2 | **Literal search** — `ILIKE` treats `%` and `_` as SQL wildcards, violating BR-23 | ✅ **Fixed** | Replaced `ILIKE` with `POSITION(LOWER($N) IN LOWER(column)) > 0` (`service.ts` line 393). Real-DB tests for literal `%`, `_`, and `\` added. |
| 3 | **Stale responses** — No guard against slow old requests overwriting newer results | ✅ **Fixed** | Added `requestSeqRef` (monotonically increasing `useRef`) in `MyTickets.tsx` (line 52). Every state update checks `if (seqId !== requestSeqRef.current) return`. `UI-MY-07` test verifies with deferred promises. |
| 4 | **Unsafe pagination** — Large finite `page` values can produce invalid SQL `OFFSET` | ✅ **Fixed** | `Number.isSafeInteger()` guard in controller (line 233). Early return in service when `totalPages === 0 \|\| params.page > totalPages` (line 448). Tests for `MAX_SAFE_INTEGER`, `MAX_SAFE_INTEGER + 1`, large finite decimal strings. |
| 5 | **Insufficient test evidence** — Summary sort not tested with distinct values; pagination not slice-correct; `UI-MY-05` doesn't exercise redirect; Retry test doesn't click Retry | ✅ **Fixed** | Distinct Summary ascending/descending ordering tested. Pagination asserts exact non-overlapping slices. `UI-MY-05` simulates out-of-range page redirect. Retry test (`UI-MY-04`) verifies no auto-retry + exactly one additional request on click. |

**Current verdict:** All five blocking findings resolved. Awaiting re-review from @oangsa. No approval has been recorded yet.

### PR #29 Review Status (2026-08-28)

**Reviewer:** @oangsa — **State:** `CHANGES_REQUESTED`

@oangsa reviewed PR #29 (Attachment Lifecycle & Ticket Detail) at head `9e5d41c4cdc535480152cc9c434e50ffd3514ef6` and raised seven blocking (P1) findings. All seven have been addressed at the current head:

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | **Failed attachment retry state not scoped to owning ticket/requester** — global `failedAttachments`/`failedAddAttachment` could retry a file to the wrong ticket | ✅ **Fixed** | Scoped by `requesterId + ticketNumber` in `App.tsx`; rendering filtered by `fAtt.requesterId === activeRequester.id && fAtt.ticketNumber === detailTicketNumber`; retry uses the failed item's own ticket; state cleared on requester switch. Test `UI-ATT-RETRY-OWN` covers ticket switching and requester switching after Case B (both executable). |
| 2 | **Upload ownership masking after multipart validation** — multer ran before ownership check, leaking behavior differences for non-owned tickets | ✅ **Fixed** | Added `requireTicketOwnership` pre-check before multer in `controller.ts`; drains request body on non-owned tickets so identical `404 NOT_FOUND` is returned regardless of file payload. Real-DB test `API-ATT-OWN-INT` proves identical `404` for valid, missing, oversized, and invalid-media files. |
| 3 | **Soft removal not concurrency-safe** — read-then-unconditional-update allowed two concurrent DELETEs to both succeed | ✅ **Fixed** | `removeAttachment()` uses a single conditional `UPDATE ... WHERE isRemoved = false`. Real-DB test `API-ATT-REM-CONC` proves exactly one `200` and one `409` with correct removal metadata. |
| 4 | **Compensation does not cover transaction commit failure** — post-insert/pre-commit failure left orphaned physical file | ✅ **Fixed** | Transaction-wide filesystem compensation via `test-seams.ts`. Real-DB test `ATT-PERSIST-03` injects post-insert transaction failure and verifies file deletion + row rollback. |
| 5 | **Client does not enforce five-active-attachment limit** — Create Ticket accepted unlimited files; Ticket Detail left Add Attachment enabled at five | ✅ **Fixed** | Both Create Ticket and Ticket Detail enforce the limit client-side; sixth file rejected before reaching the API; Add Attachment disabled at five and re-enabled after removal. Tests `UI-TKT-CAP-01` and `UI-ATT-CAP-01`. |
| 6 | **Successful upload followed by refresh failure becomes retryable** — could offer duplicate retry | ✅ **Fixed** | Mutation success is terminal; refresh failure shown as detail error, never retryable. Test `UI-ATT-MUT-REF` covers upload-success + refresh-failure and remove-success + refresh-failure. |
| 7 | **Feature-level verification boundary incomplete** — mocked API tests didn't verify ownership, storage persistence, removed access, second removal, UUID filename, full compensation; `tests.md` had conflicting totals | ✅ **Fixed** | Added real-DB integration tests: ownership (`API-ATT-OWN-INT`), concurrent removal (`API-ATT-REM-CONC`), persistence compensation (`ATT-PERSIST-01/02/03`), UUID stored filename (`ATT-PERSIST-04`), removed access (`ATT-PERSIST-05`). `tests.md` was corrected and now records the current full-suite evidence: **335 server tests across 26 files** and **100 client tests across 8 files** (see §2 full-suite results). |

### PR #29 Re-review Remediation (2026-08-28)

A follow-up re-review identified additional gaps. All have been addressed:

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | **Retrying a failed Ticket Detail attachment upload can duplicate a persisted attachment** — the retry handler wrapped upload + refresh in one failure boundary, so a refresh failure after a successful retry upload restored the retry row and allowed the same file to be uploaded again | ✅ **Fixed** | Both retry handlers in `App.tsx` (`handleRetryFailedAttachment` and the inline Add-Attachment retry) now separate the mutation boundary from the refresh boundary: a successful retry upload is terminal (clears the row permanently); a refresh failure is shown as a detail error and never restores the retry row. Regression test `UI-ATT-RETRY-TERMINAL` proves the failed row stays cleared and `uploadAttachment` runs exactly once during the retry. |
| 2 | **UI-TKT-08 claimed passed without executable proof of the complete valid+invalid submission flow** | ✅ **Fixed** | `CreateTicket.test.tsx` now proves the full orchestration: the invalid file is visibly rejected, the valid file remains accepted, submitting calls `createTicket()` exactly once and `uploadAttachment()` exactly once with the valid file (never the invalid one), and the success state is displayed. |
| 3 | **Feature-level attachment verification incomplete while `tests.md` overstates coverage** — the API test mocked the upload service, so the real validation matrix, cross-requester ownership for list/download/preview/delete, and the complete UI-DETAIL-01 matrix were not directly exercised | ✅ **Fixed** | Added `UNIT-ATT-02/03` (extension + signature matrix against the production validators), `API-ATT-OWN-MATRIX` (real-DB cross-requester list/download/preview/delete ownership), and the complete `UI-DETAIL-01` screen-level matrix (read-only fields, loading, safe 404, failure/retry, active/removed attachments, preview/download/remove, Add Attachment capacity). |
| 4 | **Accessibility tests did not actually exercise the claimed behavior** — the Escape test clicked Cancel, and the focus-restoration test did not assert the original Remove button regained focus | ✅ **Fixed** | The Escape test now dispatches an actual `Escape` keyboard event against the dialog; the focus-restoration test asserts `document.activeElement === originalRemoveButton`. |
| 5 | **DELETE non-JSON body/content-type validation relied solely on `req.body`** | ✅ **Fixed** | Verified against the api-spec §0 contract and locked in with `API-ATT-11`: omitted body (no content type) and JSON body with `application/json` are accepted; a body with a non-JSON content type or no content type returns `400 VALIDATION_ERROR` and never reaches the removal service. |
| 6 | **Attachment IDs lacked safe-integer / PostgreSQL `INTEGER` range validation** — oversized digit strings could reach Prisma and produce a `500` | ✅ **Fixed** | Added a shared `parseAttachmentId` helper in `controller.ts` that validates the decimal grammar, `Number.isSafeInteger`, and the PostgreSQL `INTEGER` max (`2147483647`); used by download, preview, and delete. `API-ATT-16` proves oversized IDs return `404 NOT_FOUND` (never a `500`) and never reach Prisma. |
| 7 | **Client download filename parsing did not prefer RFC 5987 `filename*`** | ✅ **Fixed** | Added `parseContentDispositionFilename` in `format.ts` that prefers the `filename*` UTF-8 value (decoded) over the ASCII `filename` fallback. `FORMAT-01` unit tests cover precedence, fallback, and malformed-encoding handling. |
| 8 | **Client upload-result TypeScript type did not match the server response contract** — `storedFilename` present, `ticketId` missing | ✅ **Fixed** | Aligned `AttachmentUploadResult["data"]` with the server contract (adds `ticketId`, removes `storedFilename`); updated all test mocks; `npx tsc --noEmit` passes. |

**Current verdict:** All seven original blocking findings and all eight re-review remediation findings resolved. Awaiting re-review from @oangsa. No approval has been recorded yet.

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
- FR-10 / FR-11 / FR-12 / FR-13: covered by Attachment tests (`API-ATT-01..10`, `API-ATT-11`, `API-ATT-12..16`, `API-ATT-OWN-01`, `API-ATT-OWN-MATRIX`, `ATT-PERSIST-01`, `UNIT-ATT-01..03`, `UI-ATT-01..05`, `UI-ATT-RETRY-TERMINAL`, `UI-TKT-08`, `FORMAT-01`, `UI-DETAIL-01`).
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
| API-REQ-01 | API | Selector returns only active development requesters | Returns only active requesters and excludes inactive ones from the selector payload. | `server/tests/lab-02/dev-requesters.api.test.ts`, `server/tests/lab-02/dev-requesters.service.test.ts` | FR-01, FR-15 | BR-03, BR-04 | AC-15 | Passed |
| UI-REQ-01 | UI | Route guard redirects to selector when requester context missing | Missing requester context redirects to the selector screen without crashing. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-21, BR-05 | AC-02 | Passed |
| UI-REQ-02 | UI | Stale/inactive requester context clears sessionStorage and shows explanatory message | Stored requester is cleared, the app redirects to selector, and the user sees a clear inactive-requester message. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-05, BR-21 | AC-02, AC-15 | Passed |
| API-REQ-02 | API | Requester-scoped endpoints reject missing/unknown/inactive `X-Dev-Requester-Id` with 422 while historical tickets remain persisted and unreachable through requester flows | Missing/invalid/inactive requester headers are rejected, while historical records remain persisted but non-reachable in requester flows. The real-DB test verifies: inactive requester remains persisted; historical ticket remains persisted; requester context returns `422`; My Tickets returns `422`; the historical ticket remains in the database after rejection. | `server/tests/lab-02/requester-context.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-15 | BR-04, BR-05, BR-21, BR-29 | AC-15 | Passed |
| API-REQ-03 | API | Bootstrap/reference endpoints do not require requester headers | `GET /api/dev-requesters` and reference-data endpoints still function without `X-Dev-Requester-Id`. | `server/tests/lab-02/requester-context.api.test.ts` | FR-15 | BR-21 | — | Passed |
| API-CONTRACT-01 | API | Canonical error body and request parsing matrix for every endpoint class | Each requester-scoped endpoint rejects missing, malformed, duplicate, unknown, and inactive requester headers with the canonical `422` body; malformed route IDs/numbers return canonical `404`; JSON endpoints reject malformed JSON, non-object bodies, and wrong content type with canonical `400`; duplicate query keys use the first value; all `500` responses are safe. | `server/tests/lab-02/api-contract.api.test.ts` | FR-01, FR-09 | BR-21, BR-24 | AC-02, AC-03 | Passed |
| DB-01 | Integration | Fresh database migrates to the Lab 2 schema | Forward migration creates all required tables, fields, constraints, relations, and indexes without resetting the database. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Passed |
| DB-02 | Integration | Existing Lab 1 Category rows survive the Lab 2 migration | Existing Category `id`, `name`, and `createdAt` values remain unchanged and `isActive` is backfilled to `true`. | `server/tests/lab-02/database-migration.integration.test.ts` | — | — | — | Passed |
| SEED-01 | Integration | Seed is idempotent when run twice | Running the seed twice creates no duplicate Requesters, Categories, or Related Systems and does not replace existing required Categories. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Passed |
| SEED-02 | Integration | Seed contains the required reference and requester records | Each of the four required Category names exists exactly once, unrelated pre-existing Categories are preserved, and there are at least six Related Systems, at least four active Requesters, and at least one inactive Requester. | `server/tests/lab-02/seed.integration.test.ts` | — | — | — | Passed |
| API-REF-01 | API | GET /api/categories returns only active Categories with correct response shape | The endpoint returns an array of active Category objects with Lab 1 raw-array response shape (no `{ data: [...] }` envelope). | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Passed |
| API-REF-02 | API | GET /api/related-systems returns only active Related Systems with standard envelope | The endpoint returns `{ data: [...] }` with only active Related System objects. | `server/tests/lab-02/reference-data.api.test.ts` | — | BR-07 | — | Passed |
| UI-REQ-03 | UI | Requester Selection loading state shows skeleton/spinner | The loading state displays while fetching active requesters from the API. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-04 | — | Passed |
| UI-REQ-04 | UI | Requester Selection empty state for zero active requesters | When no active requesters exist, a clear empty-state message is shown instead of a blank dropdown. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-15 | BR-04 | — | Passed |
| UI-REQ-05 | UI | Requester Selection API failure shows error with manual Retry button | API failure shows an error message and a Retry action; Continue remains disabled until selection succeeds. | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | — | — | Passed |
| UI-REQ-06 | UI | Requester Selection stores selected requester in sessionStorage and sends X-Dev-Requester-Id header | The client persists the selected ID, sends the header (asserted on the actual `/api/requester-context` fetch request), shows the selected Requester name in the application shell, and exposes an operable Change Requester action. | `client/src/lab-02-tests/RequesterSelection.integration.test.tsx` | FR-01, FR-14 | BR-14, BR-21 | — | Passed |
| UI-REQ-07 | UI | Requester Selection keyboard and post-selection flow | Testing-only explanatory text is visible; Continue is disabled before selection and enabled after selection; the full selector → Continue → shell → Change Requester → selector path is keyboard-operable (Enter/Space activation) with focus reachable on each control; after Continue the selected name and Change Requester action are visible. Browser-rendered visible-focus styling is deferred to `E2E-05` (AC-25). | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01, FR-14 | BR-03, BR-14 | — | Passed |
| API-TKT-NOR-01 | API | Summary/Description trimming and boundary behavior | Summary and Description are trimmed before validation; trimmed values are validated and persisted. Boundary: 5/4/120/121 chars for summary; 10/9/2000/2001 chars for description (inclusive/exclusive). Whitespace-only input rejected. | `server/tests/lab-02/create-ticket-normalization.api.test.ts`, `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-02 | BR-08, BR-09 | — | Passed |
| API-TKT-NOR-02 | API | CategoryId/RelatedSystemId validation with malformed, nonexistent, and inactive cases | Malformed (non-integer) → 400; well-formed but nonexistent → 409; existent but inactive → 409. | `server/tests/lab-02/create-ticket-normalization.api.test.ts`, `server/tests/lab-02/create-ticket-validation.unit.test.ts` | FR-02 | BR-07 | — | Passed |
| API-TKT-01 | API | Create ticket success: returns generated ticket number matching TKT-{YYYY}-{6-digit} format, verifies uniqueness | A valid create request creates exactly one ticket, returns the official backend-generated ticket number matching the format pattern, verifies two tickets receive different numbers, and explicitly asserts `currentStatus === "NEW"` in the response. | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-03 | BR-01, BR-02 | AC-01 | Passed |
| API-TKT-07 | API | Requested Priority server-side validation | Missing `requestedPriority` → 400; invalid enum value (e.g. `URGENT`) → 400; `LOW`/`MEDIUM`/`HIGH` are each accepted and persisted as submitted. | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/create-ticket-validation.unit.test.ts` | FR-02 | BR-10 | — | Passed |
| API-TKT-06 | Integration | Ticket-number UTC allocation, concurrent uniqueness, contiguity, year matching, and sequence exhaustion | Frozen UTC boundary timestamps produce the correct year; the first ticket created in a frozen year receives sequence `000001` and the next ticket in the same year receives `000002` (increment of exactly 1); a frozen rollover to a new UTC year resets the sequence to `000001`; concurrent creates all receive distinct, contiguous numbers; each number's year equals its persisted `createdAt` UTC year; an exhausted yearly sequence returns `409 TICKET_SEQUENCE_EXHAUSTED` and creates no ticket. | `server/tests/lab-02/ticket-number-concurrency.integration.test.ts` | FR-03 | BR-01 | AC-01 | Passed |
| STATIC-01 | Static/Doc | BR-25 Lab 3 authentication-transition boundary is a documented, non-runtime contract | Confirms no Lab 2 code path treats a client-supplied `X-Dev-Requester-Id` as authentication, and that the Lab 3 transition boundary is documented; verified by code/documentation review rather than an executable assertion. | `docs/lab-02/specification.md` (BR-25) | — | BR-25 | — | **Passed** |
| API-TKT-04 | API | Ownership is assigned from `X-Dev-Requester-Id` at creation | The server persists ownership from the validated caller header; the test does not introduce an undocumented `requesterId` request field. | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-02, FR-04 | BR-06, BR-21, BR-24 | — | Passed |
| API-TKT-05 | API | Requester-created tickets keep IT Priority and Ticket Owner null | `itPriority` and `ticketOwnerId` remain `null` on requester-created tickets. | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-02 | BR-11 | — | Passed |
| UI-TKT-07 | UI | Requested Priority control is required and defaults to MEDIUM | The field defaults to `MEDIUM` and blocks submission if the value is missing from the form model. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-10 | — | Passed |
| UI-TKT-01 | UI | Empty summary blocks submit and shows field error | The summary field shows a direct validation error and no API call is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-04 | Passed |
| UI-TKT-02 | UI | Summary over 120 chars blocks submit with length error | A summary longer than 120 chars is rejected with a field-level message. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-05 | Passed |
| UI-TKT-03 | UI | Description under 10 chars blocks submit with field error | A description shorter than 10 chars is rejected before request submission. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-09 | AC-06 | Passed |
| UI-TKT-04 | UI | Submit busy state prevents duplicate submission | While a create request is in flight, the button is disabled and no second request is sent. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-15 | AC-10 | Passed |
| UI-TKT-05 | UI | Case A — failed create keeps entered values and shows inline error | A failed create request preserves all form values and shows a manual-retry inline error without auto-retrying. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 | Passed |
| UI-TKT-06 | UI | Case B — partial success: ticket created but attachment upload failed shows Ticket Number, separate attachment error, and blocks ticket resubmission | The created ticket remains saved, a separate attachment failure is reported, and the user is not shown a duplicate create flow. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | **Passed** |
| UI-TKT-08 | UI | Valid and invalid pre-submit attachments | One valid and one invalid file shows the invalid file error, excludes the invalid file, and still submits the ticket with the valid file; evidence captures this state. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-02, FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| API-TKT-02 | API | Inactive/stale category or related-system ID rejected with 409 | Replacing an active category or related system with a stale/inactive ID fails with `409 Conflict` and no ticket is saved (ticket count verified unchanged). | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/create-ticket-reference-validation.integration.test.ts` | FR-02 | BR-07 | AC-27 | Passed |
| API-TKT-03 | API | Ticket detail returns 404 for non-owner access | Requests for another Requester's ticket return `404 Not Found` and no data is exposed. | `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-09 | BR-24 | AC-03 | Passed |
| API-TKT-INT-01 | API | Integer lexical validation (api-spec §0): decimal, exponent, nested, and escaped property names | `categoryId: 1.0`, `categoryId: 1e0`, `relatedSystemId: 1.0`, `relatedSystemId: 1e0` all return `400 VALIDATION_ERROR`; nested property with same field name does not interfere; escaped top-level property name (`\\uXXXX`) is correctly decoded; valid top-level field plus invalid ignored nested field is accepted; unknown multi-property nested objects, pretty-printed nested objects, and arrays of multi-property objects are safely ignored without `500`. | `server/tests/lab-02/integer-validation.api.test.ts` | FR-02 | — | — | Passed |
| API-TKT-INT-02 | Integration | Real normalization and persistence against production service | Trim-before-persistence verified; all summary/description boundaries exercised through real `createTicket()`; whitespace-only values create no ticket. | `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-02 | BR-08, BR-09 | — | Passed |
| API-TKT-INT-03 | Integration | Real ownership and defaults against production service | `requesterId` from `X-Dev-Requester-Id` persisted; client-supplied `requesterId`/`ticketOwnerId` ignored; `itPriority`/`ticketOwnerId` remain `null`; `currentStatus` is `NEW`. | `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-02, FR-04 | BR-06, BR-11, BR-21, BR-24 | — | Passed |
| API-TKT-INT-04 | Integration | Real Ticket Detail ownership enforcement against production service | Requester A → `200` with full Ticket Detail; Requester B → `404 NOT_FOUND` with no ticket data exposed. | `server/tests/lab-02/create-ticket-real-db.integration.test.ts` | FR-09 | BR-24 | AC-03 | Passed |
| API-MY-01 | API | My Tickets returns only current requester-owned tickets (ownership isolation) | Only tickets belonging to the current requester are returned, even when other tickets exist. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-04 | BR-24 | AC-03 | Passed |
| API-MY-02 | API | Search by ticket number/summary substring | Search matches ticket numbers and summary substrings for the current requester only, after applying the BR-23 normalization rule. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-05 | BR-23 | AC-17 | Passed |
| API-MY-03 | API | Category/Priority/Status filters are conjunctive | The list applies all selected filters together and returns only intersection matches. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-06 | BR-23 | AC-18 | Passed |
| API-MY-04 | API | Deterministic sort order with tie-breakers and priority ordering | Sort order is deterministic using selected field/direction and then `createdAt desc`, `id desc` as tie-breakers. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-07 | BR-22 | AC-19 | Passed |
| API-MY-05 | API | Pagination returns correct page metadata and slices | Page and pageSize metadata are returned accurately and the correct slice of results is delivered. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-08 | BR-22 | AC-20 | Passed |
| API-MY-06 | API | Default pagination/sort values and invalid-value fallback | Omitted pagination/sort params use `page=1`, `pageSize=10`, `sort=createdAt`, `order=desc`; invalid `sort`, `order`, `page`, or `pageSize` values fall back to these same documented defaults. (Invalid `categoryId`/`requestedPriority`/`status` filter values are validation errors, not fallback defaults — see `API-MY-07`.) | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-07, FR-08 | BR-22 | AC-19, AC-20 | Passed |
| API-MY-07 | API | Invalid filter parameter values and pagination (including safe-integer page guard) | Malformed categoryId → 400; invalid requestedPriority/status enums → 400; page missing/malformed/non-positive uses page 1; valid out-of-range page → 200 with empty data and accurate metadata; pages exceeding `Number.MAX_SAFE_INTEGER` fall back to `page=1`; `Number.MAX_SAFE_INTEGER` itself is accepted as a valid page value. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-06, FR-08 | BR-22, BR-23 | — | Passed |
| API-MY-08 | API | Search normalization and returned Empty/No-Results metadata values (API layer only) | Search is trimmed; blank-after-trim is inactive. Every list response includes accurate `totalItems` and `unfilteredTotalItems` values: a requester with no ticket history returns `unfilteredTotalItems=0` even with an active filter; a requester with ticket history and a zero-match filter returns `unfilteredTotalItems>0`. This test asserts only the returned numbers — which UI state those numbers should render is proven separately by `UI-MY-01`/`UI-MY-02`. | `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-05, FR-16 | BR-22, BR-23 | — | Passed |
| MY-RDB-01 | Integration | Zero totalPages with giant page: requester with zero tickets (totalPages=0) | Given a requester with zero tickets, `?page=9007199254740991&pageSize=50` returns `200` with empty `data`, correct pagination metadata, and no SQL OFFSET is executed. | `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-08, FR-16 | BR-22 | AC-20 | Passed |
| MY-RDB-02 | Integration | Zero totalPages with giant page: requester with tickets but filter matches nothing (totalItems=0, unfilteredTotalItems>0) | Given a requester with ticket history but a filter that yields zero matches, `?page=9007199254740991&pageSize=50&search=ZZZZNONEXISTENT` returns `200` with empty `data`, correct pagination metadata, and no SQL OFFSET is executed. | `server/tests/lab-02/my-tickets-real-db.integration.test.ts` | FR-08, FR-16 | BR-22 | AC-20 | Passed |
| API-ATT-09 | API | Attachment list ordering is deterministic (uploadedAt asc, id asc) | Attachment listing returns results in deterministic order for stable display ordering and reproducible tests. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | — | — | **Passed** |
| ATT-PERSIST-01 | Integration | Successful attachment metadata persistence | Given a valid JPEG upload, the request succeeds (201), the Attachment row exists in the database with correct metadata, and `storedFilename` is not exposed in the API response. | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-10 | BR-26, BR-27 | — | **Passed** |
| ATT-PERSIST-02 | Integration | Metadata persistence failure compensates physical storage | Given the physical file write succeeds and metadata persistence then fails, the request returns 500 INTERNAL_ERROR, no Attachment row is created, the newly written physical file is deleted (filesystem count unchanged), and the failed attachment is not API-exposed via the list endpoint. | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-10 | BR-31 | — | **Passed** |
| ATT-PERSIST-03 | Integration | Transaction-wide compensation — failure AFTER metadata insert | Given the metadata insert succeeds but the transaction then fails before commit, the request returns 500 INTERNAL_ERROR, the Attachment row is rolled back, and the physical file is deleted (filesystem count unchanged). Proves compensation covers the entire transaction, not just the metadata insert. | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-10 | BR-31 | — | **Passed** |
| ATT-PERSIST-04 | Integration | UUID stored filename and metadata persistence | Inspects the real Attachment row to verify the stored filename is a UUID + allowed extension, the original filename is preserved as metadata, the physical file exists on disk, and `storedFilename` is never API-exposed. | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-10 | BR-26, BR-27 | — | **Passed** |
| ATT-PERSIST-05 | Integration | Removed attachment access (real DB) | Soft-removes a real attachment and verifies download/preview return `410 ATTACHMENT_REMOVED` while the list still shows the removed metadata. | `server/tests/lab-02/attachment-persistence-compensation.integration.test.ts` | FR-11, FR-12, FR-13 | BR-18 | AC-13 | **Passed** |
| API-ATT-OWN-INT | Integration | Ownership isolation before multipart validation (real DB) | Non-owned uploads return identical `404 NOT_FOUND` for valid, missing, oversized, and invalid-media files — proving the ownership pre-check runs before multipart validation and cannot leak ticket existence. | `server/tests/lab-02/attachment-concurrency.integration.test.ts` | FR-09, FR-10 | BR-24 | AC-03 | **Passed** |
| API-ATT-REM-CONC | Integration | Concurrent soft removal — exactly one 200, one 409 | Two simultaneous DELETEs produce exactly one `200` and one `409`, with correct persisted `isRemoved`, `removedAt`, `removedByRequesterId`, and `removalReason` metadata. Proves the atomic conditional soft-removal transition. | `server/tests/lab-02/attachment-concurrency.integration.test.ts` | FR-11 | BR-18 | — | **Passed** |
| API-ATT-OWN-01 | API | Cross-requester Attachment ownership enforcement | Requester B attempting upload, list, download, preview, or soft-remove against Requester A's ticket/attachment each receive `404 NOT_FOUND` with the same shape as a missing resource, and no data or file bytes are exposed. | `server/tests/lab-02/attachments.api.test.ts` | FR-09, FR-10, FR-11, FR-12, FR-13 | BR-24 | AC-03 | **Passed** |
| API-ATT-15 | API | Active-attachment limit counts only active rows after soft removal | With 5 active attachments, soft-removing 1 drops the active count to 4; uploading a new valid attachment is then accepted (`201`) and the active count returns to 5. | `server/tests/lab-02/attachments.api.test.ts` | FR-10, FR-11 | BR-12, BR-18 | AC-08 | **Passed** |
| API-ATT-10 | API | Removal reason normalization and boundary behavior | Omitted/blank-after-trim reason → null; 200-char reason → accepted; 201-char reason → rejected; non-string → 400 validation error. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | **Passed** |
| API-ATT-11 | API | DELETE content-type handling (api-spec §0) | An omitted body with no content type and a JSON body with `application/json` are accepted; a body with a non-JSON content type or no content type returns `400 VALIDATION_ERROR` and never reaches the removal service. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | **Passed** |
| API-ATT-16 | API | Attachment ID range validation (never a 500) | A normal valid ID reaches the service; an ID above the PostgreSQL `INTEGER` max (`2147483647`) or a sufficiently large digit-only ID returns `404 NOT_FOUND` (never a `500`) and never reaches Prisma; the same guard applies to download, preview, and delete. | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18 | AC-13 | **Passed** |
| API-ATT-OWN-MATRIX | Integration | Cross-requester ownership for list/download/preview/delete (real DB) | Requester B cannot list, download, preview, or delete Requester A's attachment — each returns the safe `404 NOT_FOUND` shape with no file bytes, and the database record remains unchanged (still active, owned by A). Requester A can still download the attachment afterward. | `server/tests/lab-02/attachment-ownership.integration.test.ts` | FR-09, FR-10, FR-11, FR-12, FR-13 | BR-24 | AC-03 | **Passed** |
| UI-ATT-05 | UI | Multi-file attachment partial success orchestration | The Create Ticket UI uploads A, B, and C sequentially; after B fails it continues to C, keeps A/C successful, reports B separately, and offers B retry from Ticket Detail. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-17 | BR-17 | — | **Passed** |
| UI-ATT-06 | UI | Failed attachment retry from Ticket Detail | After Case B partial success, View Ticket passes failed B into Ticket Detail. B is rendered as failed with a Retry button. Retry calls uploadAttachment(B) without calling createTicket again. Successful retry removes B from failed state. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-17 | BR-17 | AC-26 | **Passed** |
| UI-ATT-07 | UI | Removal dialog accessibility — focus trap, Escape, focus restore | Opening the removal dialog moves focus into the dialog; Tab/Shift+Tab cycle within the dialog; Escape closes it; closing restores focus to the Remove button. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-19 | — | **Passed** |
| UI-ATT-08 | UI | Unavailable attachment state on Preview/Download failure and Add Attachment upload failure | A Preview/Download failure against an active attachment renders the Unavailable badge with Preview/Download disabled and no Retry action (ui-spec §5.3); an Add Attachment upload failure in Ticket Detail renders an Unavailable row with a Retry action that re-uploads only that file. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-12, FR-13, FR-17 | BR-17 | — | **Passed** |
| UI-TKT-CAP-01 | UI | Create Ticket five-active-attachment capacity | Exactly five valid files are accepted (5/5); a sixth valid file is rejected and cannot enter the upload set; invalid files are excluded from the upload set while valid ones remain; removing a selected file frees a slot; the excluded sixth file is never submitted to the upload API. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-10 | BR-12 | AC-08 | **Passed** |
| UI-ATT-CAP-01 | UI | Ticket Detail five-active-attachment capacity | Add Attachment is disabled at five active attachments; a direct file selection at five active is rejected with no upload request; removing one of five re-enables Add Attachment; removed attachments do not count toward the active limit. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12 | AC-08 | **Passed** |
| UI-ATT-RETRY-OWN | UI | Failed attachment retry is scoped to requester + ticket | A failed attachment from Ticket A is absent when viewing Ticket B (ticket switching); after a failed retry is present on a prior requester's ticket, changing requester clears the stale failed-attachment state so it does not resurface in the new requester's scope (requester switching). Retry always targets the failed attachment's own requester + ticket identity, never the currently displayed detail ticket. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-17 | BR-17 | AC-26 | **Passed** |
| UI-ATT-MUT-REF | UI | Mutation success is terminal — refresh failure is not a mutation failure | A successful upload/remove is terminal: a subsequent refresh failure is shown as a detail error, never as a retryable mutation failure. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-11 | BR-17 | — | **Passed** |
| UI-ATT-RETRY-TERMINAL | UI | Retry upload success is terminal — refresh failure must not restore the retry row | After an initial upload failure, a successful retry upload permanently clears the failed row even when the subsequent refresh fails; `uploadAttachment` runs exactly once during the retry and the refresh failure is shown as a separate detail error. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10, FR-17 | BR-17 | AC-26 | **Passed** |
| UI-TKT-08 | UI | Valid + invalid pre-submit attachments submit the ticket with only the valid file | The invalid file is visibly rejected, the valid file remains accepted, submitting calls `createTicket()` exactly once and `uploadAttachment()` exactly once with the valid file (never the invalid one), and the success state is displayed. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| FORMAT-01 | Unit | RFC 5987 `filename*` parsing precedence | `parseContentDispositionFilename` prefers the RFC 5987 `filename*` value (decoded) over the ASCII `filename` fallback, falls back correctly when only `filename=` exists, and returns null when neither is present. | `client/src/lab-02-tests/format.test.ts` | FR-12 | BR-28 | — | **Passed** |
| API-ATT-12 | API | Soft-remove idempotency: removing twice returns 409 Conflict on second attempt | A removed attachment cannot be removed again; second DELETE returns 409 rather than silently succeeding. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | **Passed** |
| API-ATT-13 | API | Removal sets removedByRequesterId to the current requester | When soft-removing an attachment, `removedByRequesterId` is set to the `X-Dev-Requester-Id` of the caller. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-18 | — | **Passed** |
| API-ATT-14 | Integration | Attachment signature/filename and concurrent-limit matrix | Fixed valid/corrupt fixtures verify the extension-to-signature matrix, case-insensitive extension handling, no/double extension rejection, safe stored/download filenames, and PDF-preview failure behavior. Concurrent uploads when four attachments are active yield exactly one success and never expose more than five active rows. | `server/tests/lab-02/attachment-concurrency.integration.test.ts` | FR-10, FR-12, FR-13 | BR-12, BR-13, BR-26, BR-27, BR-28 | AC-07, AC-08, AC-13, AC-24 | **Passed** |
| API-ATT-14-PDF | Integration | PDF preview renders first page as image/png (real DB) | Uploads a real multi-page PDF fixture, previews it, and asserts `200 image/png` with PNG magic bytes and a non-empty body — proving AC-24 (first page rendered) via the reproducible PDFium renderer. A second test uploads a corrupt PDF (passes `%PDF-` signature but has no renderable pages) and asserts `500 INTERNAL_ERROR`; neither test ever returns `application/pdf`. | `server/tests/lab-02/attachment-concurrency.integration.test.ts` | FR-12 | BR-28 | AC-24 | **Passed** |
| UI-MY-01 | UI | Empty state shown when `unfilteredTotalItems = 0`, even with an active normalized search/filter | Given `unfilteredTotalItems = 0`, with or without an active normalized search/filter, the UI renders the Empty state with the Create Ticket CTA. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-30 | AC-21 | Passed |
| UI-MY-02 | UI | No-results state shown when `unfilteredTotalItems > 0` and filtered results are zero | Given `unfilteredTotalItems > 0` and `totalItems = 0` after normalized search/filtering, the UI renders the No-Results state with the Clear Filters CTA. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-30 | AC-22 | Passed |
| UI-MY-03 | UI | Requester switch clears prior data and reloads new scope | Switching Requester clears the previous list and reloads the current Requester's tickets. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-14 | BR-14 | AC-14 | Passed |
| UI-MY-04 | UI | My Tickets loading and API failure states show skeleton/error with manual Retry | The list shows loading and failure states and requires a manual retry action instead of automatic reload. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-04, FR-17 | — | — | Passed |
| UI-MY-05 | UI | Valid out-of-range page does not display Empty or No-Results | When a valid page exceeds `totalPages`, the UI navigates to and reloads the last valid page; it does not mislabel the response as Empty or No-Results. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-08, FR-16 | BR-22, BR-30 | — | Passed |
| UI-MY-07 | UI | Stale-response protection — older request must not overwrite newer results | When a slow earlier request resolves after a newer request, the stale response is discarded and the newer result remains displayed. | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-04 | — | — | Passed |
| API-ATT-01 | API | Attachment type/content validation matrix | Allowed extension + invalid content is rejected; disallowed extension + valid content is rejected; allowed extension + matching content is accepted; a multipart request with no `file` part is rejected with `400 VALIDATION_ERROR` and creates no metadata or stored file. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| UI-ATT-01 | UI | Disallowed attachment type rejected client-side | The client blocks an unsupported file type before upload and shows a clear explanation. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| API-ATT-02 | API | Sixth active attachment rejected by server limit | Uploading the sixth active attachment is rejected with the server limit message. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-08 | **Passed** |
| UNIT-ATT-01 | Unit | Attachment size boundary validator: 4,999,999 / 5,000,000 accepted, 5,000,001 rejected | Boundary validation accepts 4,999,999 and 5,000,000 bytes and rejects 5,000,001. | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12 | AC-09 | **Passed** |
| UNIT-ATT-02 | Unit | Extension validator against production logic | `validateExtension` accepts each allowed extension (`.jpg/.jpeg/.png/.webp/.pdf`), accepts upper/mixed case, and rejects unsupported, no-extension, double-extension, and trailing-dot filenames. | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| UNIT-ATT-03 | Unit | Content-signature validator against production logic | `validateContentSignature` accepts the JPG/JPEG/PNG/WEBP/PDF magic-byte signatures and rejects wrong-signature, truncated, and empty buffers. | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12, BR-13 | AC-07 | **Passed** |
| ATT-SIZE-01 | API | Maximum accepted size boundary (4,999,999 bytes) | A 4,999,999-byte JPEG file is accepted with 201 and the correct fileSizeBytes in the response. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 | **Passed** |
| ATT-SIZE-02 | API | Maximum accepted size boundary (5,000,000 bytes) | A 5,000,000-byte JPEG file is accepted with 201 and the correct fileSizeBytes in the response. The Multer transport limit is set slightly above the business maximum so the service-level validateFileSize() can accept the exact boundary. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 | **Passed** |
| API-ATT-03 | API | Oversized attachment upload rejected by server with 413 | An over-limit file is rejected by the API with the correct status and no storage. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 | **Passed** |
| UI-ATT-03 | UI | Selecting an oversized file shows size error immediately and prevents upload (client-side rejection) | Oversized files are rejected before upload with a size message and no network request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12 | AC-09 | **Passed** |
| API-ATT-04 | API | Soft remove marks removed metadata and disables access | A soft delete sets `isRemoved`, `removedAt`, `removalReason`, and `removedByRequesterId` and blocks preview/download. | `server/tests/lab-02/attachments.api.test.ts` | FR-11, FR-13 | BR-18, BR-19 | AC-12, AC-13 | **Passed** |
| API-ATT-05 | API | Preview/download endpoint behavior for active vs removed files | An active image attachment's preview returns `200` with inline image bytes; an active PDF attachment's preview returns `200` with `image/png` (first-page rendered); a PDF rendering failure returns `500 INTERNAL_ERROR` (never the original PDF); an active attachment's download returns `200` with the correct `Content-Type`/`Content-Disposition`; a removed attachment's preview and download both return exactly `410` (`ATTACHMENT_REMOVED`), never `404`/`400`/`409`. | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18, BR-28 | AC-13, AC-24 | **Passed** |
| API-ATT-08 | API | Removal reason validation | An omitted reason is accepted, a 200-character reason is accepted, and a 201-character reason is rejected. | `server/tests/lab-02/attachments.api.test.ts` | FR-11 | BR-19 | — | **Passed** |
| UI-ATT-04 | UI | Removal confirmation dialog and cancel behavior | Remove opens a confirmation dialog; Cancel closes it without sending a DELETE request; Confirm sends the removal request. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-19 | — | **Passed** |
| UI-ATT-02 | UI | Removed attachment row shows Removed badge and disabled controls | A removed attachment remains listed with a de-emphasized Removed badge and disabled Download/Preview actions. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-20 | AC-12 | **Passed** |
| API-ATT-06 | API (endpoint-isolation) | BR-17 partial success — attachment endpoint can fail independently of ticket creation state | **Endpoint-isolation proof.** This is NOT a ticket-persistence assertion. The attachment and ticket-creation endpoints are separate routes; the server test mocks `uploadAttachment()` to reject and asserts the attachment endpoint returns `415 UNSUPPORTED_MEDIA_TYPE` independently of any ticket state. It does NOT itself prove that a ticket persists after a failed upload. The ticket-persistence claim of AC-26/BR-17 is proven by the executable **client** Case-B orchestration tests `UI-TKT-06`, `UI-ATT-05`, `UI-ATT-06`, and `UI-ATT-RETRY-OWN`, which run the real `createTicket()` → `uploadAttachment()` flow and assert the created ticket is kept (no duplicate `createTicket` call) while the failed attachment is retried from Ticket Detail. | `server/tests/lab-02/attachments.api.test.ts`; ticket-persistence claim proven by `client/src/lab-02-tests/AttachmentSection.test.tsx` (`UI-TKT-06`, `UI-ATT-05`, `UI-ATT-06`, `UI-ATT-RETRY-OWN`) | FR-02, FR-10 | BR-17 | AC-26 | **Passed** (endpoint-isolation); AC-26 ticket persistence covered by `UI-TKT-06`/`UI-ATT-05`/`UI-ATT-06`/`UI-ATT-RETRY-OWN` |
| API-ATT-07 | API | Attachment metadata is persisted and stored filename is generated safely with validated extension | Metadata is saved and the stored filename is generated using a sanitized UUID+extension pattern. | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-26, BR-27 | — | **Passed** |
| UI-DETAIL-01 | UI | Ticket Detail renders read-only fields, loading/failure/not-found states, active and removed attachments, Preview/Download/Remove, and Add Attachment controls | The detail screen shows the frozen screen-level states (skeleton loading, safe 404 "not found" with no ownership leak, manual-retry failure banner) plus read-only ticket data, attachment state, and the correct controls for active vs removed attachments. | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-09, FR-10, FR-11, FR-12, FR-13, FR-17 | BR-18, BR-20, BR-24, BR-28 | AC-03, AC-12, AC-13, AC-24 | **Passed** |
| E2E-01 | E2E | Requester creates ticket and later finds it in My Tickets | The full requester flow ends with a visible ticket in the requester's My Tickets list. | `e2e/lab-02/requester-ticket-flow.spec.ts` | FR-02, FR-04 | BR-01, BR-22 | AC-01, AC-17 | **Passed** |
| E2E-02 | E2E | Ownership isolation across two requester contexts | Requester A and B cannot see each other's tickets and ownership enforcement works end-to-end. | `e2e/lab-02/ownership.spec.ts` | FR-09 | BR-24 | AC-03 | **Passed** |
| E2E-03 | E2E | Full attachment lifecycle (upload/preview/download/remove) | Users can add, preview, download, and remove attachments on their own tickets without breaking the ticket flow. | `e2e/lab-02/attachment-lifecycle.spec.ts` | FR-10, FR-11, FR-12, FR-13 | BR-12, BR-18, BR-28 | AC-07, AC-12, AC-13, AC-24 | **Passed** |
| E2E-04 | E2E | BR-17 partial success: ticket created, attachment upload fails, ticket persists, no duplicate, retry from Ticket Detail | Ticket creation succeeds, attachment failure is reported separately, and the user can retry the attachment without creating a duplicate. | `e2e/lab-02/partial-success-attachment.spec.ts` | FR-02, FR-10, FR-17 | BR-17 | AC-26 | **Passed** |
| E2E-05 | E2E | Keyboard-only requester selection and create-ticket flow with visible focus indicators | Keyboard users can operate the testing-only Requester Selection, Continue, Change Requester, and complete Create Ticket with visible focus and no inaccessible inputs. The mandatory flow uses only `Tab`, `Shift+Tab`, `Enter`, and `Space` (Issue #18 §24) — no arrow keys, mouse, or `selectOption()`. | `e2e/lab-02/keyboard-access.spec.ts` | FR-01, FR-14 | BR-03, BR-14 | AC-25 | **Passed** |
| UI-ERR-01 | UI | Case A — ticket create API failure preserves form state and requires manual retry | A create failure leaves all form values populated and requires manual retry rather than auto-retrying. | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 | Passed |
| UI-STYLE-01 | UI Style | Editable/read-only/invalid/disabled/busy field and button styles match Zen Green tokens | The visual system consistently distinguishes valid, invalid, disabled, busy, and read-only states. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | — | — | **Passed** |
| UI-STYLE-02 | UI Style | Required-field labels show red asterisk; validation messages render directly under fields | Required labels and inline validation match the accessibility and UI contract. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-08, BR-09 | AC-04, AC-06 | **Passed** |
| UI-STYLE-03 | UI Style | Priority/Status/Removed badge styling and non-color-reliant labels | Badges are styled with accessible labels and are understandable without relying on color alone. | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-20 | AC-12 | **Passed** |
| VISUAL-01 | Visual | Zen Green screenshots across all Lab 2 screens at desktop/tablet/mobile viewports | Screenshots across all required screens demonstrate the required responsive visual style. | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 | **Passed** |
| E2E-06 | E2E | Responsive layout across all Lab 2 screens (Requester Selection, Create Ticket, My Tickets, Ticket Detail) at desktop/tablet/mobile — no horizontal scroll, stacked controls on mobile, table→card conversion, and ≥44px mobile touch targets | The app renders without horizontal overflow, stacks content correctly across breakpoints, converts My Tickets from table to card on mobile, and keeps required interactive controls at ≥44px touch height on mobile (Issue #18 §19). | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 | **Passed** |

### 5.1 Issue #12 scope and row redistribution (2026-08-24 amendment)

Issue #12 was amended to scope its acceptance criteria to the requester-selection
foundation only. The following rows, originally listed as Issue #12 required tests, have
been formally reassigned to the downstream issues that own their dependent models,
endpoints, and screens:

| Row | Moved to | Rationale | Current Status |
|---|---|---|---|
| `API-REQ-02` | #14 (My Tickets) | BR-29 historical inactive-requester tickets requires `Ticket` model | **Passed** (implemented in #14) |
| `API-REQ-03` | #13 (Ticket Creation) | Reference endpoint exemption requires `RelatedSystem` model | **Passed** (implemented in #13) |
| `API-CONTRACT-01` | #18 (Integration) | Full parsing matrix spans tickets + attachments endpoint classes | **Passed** (implemented across #13/#14) |
| `UI-MY-03` | #14 (My Tickets) | Requester switch → My Tickets reload requires My Tickets feature | **Passed** (implemented in #14) |
| `E2E-05` | #18 (Integration) | Keyboard create-ticket flow requires Create Ticket feature | **Planned** (E2E — requires Playwright + running backend) |

Issue #12 is complete when `API-REQ-01` and `UI-REQ-01..07` are implemented and
passing. These rows remain `Planned` in this branch until their owning feature exists;
they are no longer blockers for Issue #12.

Issue #12 is complete when `API-REQ-01` and `UI-REQ-01..07` are implemented and
passing. These rows remain `Planned` in this branch until their owning feature exists;
they are no longer blockers for Issue #12.

### 5.2 Issue #13 scope and row redistribution (2026-08-25 amendment)

Issue #13 was amended to remove attachment orchestration from its scope. The attachment
panel, multi-file upload, and partial-success (Case B) UI behaviors require the full
attachment endpoints and storage infrastructure created in #15. The following rows have
been formally reassigned:

| Row | Moved to | Rationale |
|---|---|---|
| `UI-TKT-06` | #15 (Attachments) | Case B partial-success UI requires attachment upload endpoints |
| `UI-TKT-08` | #15 (Attachments) | Pre-submit attachment validation panel requires attachment endpoints |

Rows that belong to downstream issues (not #12) are intentionally left `Planned`:

- **Create Ticket** (`feature/lab2-ticket-creation`, #13): `API-REF-01/02`, `API-TKT-NOR-01/02`, `API-TKT-01..07`, `UI-TKT-01..05`, `UI-TKT-07`, `UI-ERR-01`.
- **My Tickets** (`feature/lab2-my-tickets`, #14): `API-MY-01..08`, `UI-MY-01..05`. **All Passed** as of 2026-08-27.
- **Attachments / Ticket Detail** (`feature/lab2-attachments`, #15): `API-ATT-*`, `UNIT-ATT-01`, `UNIT-ATT-02`, `UNIT-ATT-03`, `ATT-SIZE-01`, `ATT-SIZE-02`, `ATT-PERSIST-01`, `ATT-PERSIST-02`, `API-ATT-OWN-MATRIX`, `UI-ATT-*`, `UI-ATT-RETRY-TERMINAL`, `UI-DETAIL-01`, `UI-TKT-06`, `UI-TKT-08`, `FORMAT-01`.
- **Database / Seed / Migration**: `DB-01/02`, `SEED-01/02` (schema for `Ticket`/`Attachment`/`RelatedSystem` created in #13).
- **Integration / Visual / E2E** (#18): `API-CONTRACT-01`, `STATIC-01`, `UI-STYLE-01..03`, `VISUAL-01`, `E2E-01..06`.

### Required boundary assertions for `MAX_ATTACHMENT_BYTES = 5,000,000`
- `4,999,999` bytes → accepted (201)
- `5,000,000` bytes → accepted (201) — the Multer transport limit is set slightly above the business maximum (`5,000,001`) so the service-level `validateFileSize()` can accept the exact boundary
- `5,000,001` bytes → rejected by multer (413 FILE_TOO_LARGE)

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
- `page=9007199254740991` with `totalPages=0` (requester has zero tickets) → 200 with empty data; `totalPages=0` in metadata; no SQL OFFSET executed
- `page=9007199254740991` with `totalItems=0` and `unfilteredTotalItems>0` (filter matches nothing) → 200 with empty data; `totalPages=0` in metadata; no SQL OFFSET executed
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

## 6. Mock vs Real Integration Test Status (2026-08-25)

This section clarifies which tests exercise the real service+database layers and which
verify only mocked behavior. The `Final` column in Section 5 reflects whether the test
exists and passes; it does **not** distinguish mock from real integration.

### Tests that use mocked service layer (verify HTTP contract only)

| Test ID | File | Mocked function(s) | Notes |
|---|---|---|---|
| API-TKT-01 | `create-ticket.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies HTTP response shape, not real DB write |
| API-TKT-04 | `create-ticket.api.test.ts` | `createTicket`, `isActiveDevRequester` | Captures requesterId passed to mock |
| API-TKT-05 | `create-ticket.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies null fields in mock response |
| API-TKT-07 | `create-ticket.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies validation error codes from mock |
| API-TKT-02 | `create-ticket.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies 409 error codes from mock |
| API-TKT-NOR-01 | `create-ticket-normalization.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies boundary validation via mock rejections |
| API-TKT-NOR-02 | `create-ticket-normalization.api.test.ts` | `createTicket`, `isActiveDevRequester` | Verifies reference validation via mock rejections |
| API-TKT-03 | `ticket-detail.api.test.ts` | `getTicketByNumber`, `isActiveDevRequester` | Verifies ownership enforcement via mock |

### Tests that exercise real service+database layers

| Test ID | File | Notes |
|---|---|---|
| API-TKT-06 | `ticket-number-concurrency.integration.test.ts` | Real DB: allocates sequences, creates tickets, verifies exhaustion, concurrent HTTP creates, contiguity, year matching, and transaction rollback |
| API-TKT-02-INT | `create-ticket-reference-validation.integration.test.ts` | Real DB: creates inactive references, verifies 409 rejection with unchanged ticket count, verifies valid create |
| API-TKT-INT-01 | `integer-validation.api.test.ts` | Real app: verifies integer lexical validation (decimal/exponent/nested/escaped property names) |
| API-TKT-INT-02 | `create-ticket-real-db.integration.test.ts` | Real DB: trim-before-persistence, summary/description boundaries, whitespace-only rejection through real `createTicket()` |
| API-TKT-INT-03 | `create-ticket-real-db.integration.test.ts` | Real DB: ownership from header, ignored client-supplied fields, null defaults, `NEW` status through real `createTicket()` |
| API-TKT-INT-04 | `create-ticket-real-db.integration.test.ts` | Real DB: owner 200 with full detail, non-owner 404 with no data through real `getTicketByNumber()` |
| DB-01, DB-02 | `database-migration.integration.test.ts` | Real DB: runs Prisma migrations |
| SEED-01, SEED-02 | `seed.integration.test.ts` | Real DB: runs seed, verifies idempotency |
| MY-RDB-01, MY-RDB-02 | `my-tickets-real-db.integration.test.ts` | Real DB: verifies zero totalPages with giant safe-integer page number returns empty data without executing SQL OFFSET; tests both empty (zero-ticket requester) and no-results (filter matches nothing) variants |
| API-REF-01, API-REF-02 | `reference-data.api.test.ts` | Mocked: verifies HTTP response shape, not real DB queries |
| API-REQ-01 | `dev-requesters.api.test.ts` | Mocked: verifies HTTP response shape |
| API-REQ-01 | `dev-requesters.service.test.ts` | Mocked: verifies Prisma query shape |
| API-REQ-02, API-REQ-03 | `requester-context.api.test.ts` | Mocked: verifies requester header validation |
| API-CONTRACT-01 | `api-contract.api.test.ts` | Real app: tests parsing contract against real endpoints |

### Recommendation

The mocked tests in the first table above verify the HTTP contract (status codes, error
shapes, field-level validation messages) but do **not** prove that the service layer
correctly interacts with the database. Real integration tests that exercise the actual
`createTicket()` and `getTicketByNumber()` service functions against a real database
are now provided by `create-ticket-real-db.integration.test.ts` (API-TKT-INT-02/03/04)
and `create-ticket-reference-validation.integration.test.ts` (API-TKT-02-INT),
closing this gap.
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

### 2026-08-29 — Issue #18: Address PR #30 review — keyboard-only requester control, unavailable-state evidence, and full responsive assertions
- **Scope**: Addressed all four blocking findings from the PR #30 review (Issue #18): (1) `attachment-unavailable` visual evidence now genuinely triggers the unavailable state; (2) responsive E2E-06 now covers the full Issue #18 §19 requirements (Ticket Detail, table→card conversion, 44px touch targets, required controls); (3) the mandatory E2E-05 flow now uses only `Tab`/`Shift+Tab`/`Enter`/`Space`; (4) release evidence SHA wording corrected.
- **Changes**:
  - `client/src/App.tsx`: Replaced the native requester `<select>` with a keyboard-operable radio-button group (each requester is a `role="radio"` button reachable via `Tab` and selectable with `Space`/`Enter`). This resolves the Issue #18 §24 conflict (native `<select>` requires arrow keys) by making the control fully operable with only `Tab`/`Shift+Tab`/`Enter`/`Space`.
  - `client/src/App.css`: Added `.requester-option` styles (44px min-height, selected state, focus ring).
  - `client/src/lab-02-tests/*.test.tsx`: Updated requester selection in all client tests to use the radio-button options (`Select <name>`) instead of `selectOptions`/`fireEvent.change` on the native select.
  - `e2e/lab-02/responsive-visual.spec.ts`: `attachment-unavailable` now forces the Preview request to return `500` (route interception), asserts the Unavailable badge is visible, Preview/Download are disabled, and no Retry is exposed for a serving failure, then screenshots the real unavailable state. Added a reusable `assertTouchTargets` helper (≥44px) and expanded E2E-06 with: My Tickets table→card representation per breakpoint, My Tickets/Create Ticket/Requester Selection/Ticket Detail mobile touch-target checks, and Ticket Detail responsive (no horizontal scroll + required controls visible).
  - `e2e/lab-02/keyboard-access.spec.ts`: Added the canonical mandatory keyboard-only flow (Requester Selection → Continue → Create Ticket) using only `Tab`/`Shift+Tab`/`Enter`/`Space`, with focus-order, focus-visibility, and keyboard-usable validation assertions. Updated the supporting tests to use the new radio-button selector.
  - `e2e/lab-02/helpers.ts` and `e2e/lab-02/ownership.spec.ts`: Updated requester selection to the new radio-button control.
  - `docs/lab-02/tests.md`: Updated the `E2E-05` and `E2E-06` matrix rows to reflect the keyboard-only and full responsive coverage; added this Results Log entry.
- **Command(s) run**:
  ```sh
  npx playwright test e2e/lab-02            # full Lab 2 E2E suite (desktop/tablet/mobile)
  cd client && npm test                     # 100 client tests passed
  cd server && npm test                     # 335 server tests passed
  cd client && npm run build                # TypeScript + Vite build passes
  cd server && npm run build                # TypeScript build passes
  ```
- **Result**:
  - **Lab 2 E2E**: 132 tests passed, 0 failed (across desktop/tablet/mobile viewports) — up from 114 with the new responsive assertions.
  - **Client**: 100 tests passed, 0 failed
  - **Server**: 335 tests passed, 0 failed
  - **Client build**: TypeScript + Vite production build succeeds
  - **Server build**: TypeScript compilation succeeds
  - **Screenshots**: Regenerated `ticket-detail/attachment-unavailable` (now depicts the real unavailable state) plus the full responsive matrix.
- **Follow-up**: Release evidence package (`artifacts/lab-02/release/`), `reviewer.md`, and final gate updated to reflect the corrected verification.

### 2026-08-29 — Issue #18: Final Integration and Release Verification (PR #30)
- **Scope**: Repaired the Lab 2 integration E2E suite, generated complete responsive visual evidence, and recorded the final integrated verification for the release.
- **Changes**:
  - `e2e/lab-02/helpers.ts` (new): shared helpers for the real-client + real-API + real-DB integration specs (requester selection, create ticket, My Tickets navigation, search, open-by-summary, valid PNG buffer).
  - `e2e/lab-02/requester-ticket-flow.spec.ts` (E2E-01): fixed form selectors (`#categoryId`, `#relatedSystemId`, `#summary`, `#description`), added a deterministic unique summary, and proved the full Create → My Tickets → Search → Detail round trip using the actual generated Ticket Number.
  - `e2e/lab-02/ownership.spec.ts` (E2E-02): expanded to prove both-direction ownership isolation (A↔B) with unique identifiers and added direct API ownership verification (B fetching A → 404 NOT_FOUND, A fetching B → 404 NOT_FOUND, owner fetch → 200).
  - `e2e/lab-02/attachment-lifecycle.spec.ts` (E2E-03): completed the full lifecycle — upload → appears → preview → download → remove → Removed badge → Preview/Download disabled.
  - `e2e/lab-02/partial-success-attachment.spec.ts` (E2E-04): **highest-priority repair** — now actually forces the attachment upload to fail via Playwright route interception (no production change), proves the ticket persists, the failure is reported separately, retry succeeds, the Ticket Number is unchanged, and exactly one ticket exists.
  - `e2e/lab-02/keyboard-access.spec.ts` (E2E-05): fixed form selectors and added a removal-dialog focus-trap test (focus enters modal, Tab stays inside, Escape closes, focus restores to the invoking Remove button).
  - `e2e/lab-02/responsive-visual.spec.ts` (E2E-06/VISUAL-01): fixed the Playwright route-registration order (catch-all `**/api/**` must be registered first so specific routes take precedence), fixed form selectors, fixed requester-selection init-script ordering, and fixed open-by-summary to use visible rows.
  - `docs/lab-02/tests.md`: marked `E2E-01..06` and `VISUAL-01` from `Implemented` → `Passed` based on actual execution; added this Results Log entry.
- **Command(s) run**:
  ```sh
  npx playwright test e2e/lab-02            # full Lab 2 E2E suite (desktop/tablet/mobile)
  cd client && npm test                     # 100 client tests passed
  cd server && npm test                     # 335 server tests passed
  cd client && npm run build                # TypeScript + Vite build passes
  cd server && npm run build                # TypeScript build passes
  ```
- **Result**:
  - **Lab 2 E2E**: 114 tests passed, 0 failed (across desktop/tablet/mobile viewports)
  - **Client**: 100 tests passed, 0 failed
  - **Server**: 335 tests passed, 0 failed
  - **Client build**: TypeScript + Vite production build succeeds
  - **Server build**: TypeScript compilation succeeds
  - **Screenshots**: 84 curated evidence screenshots generated under `artifacts/lab-02/screenshots/` across all four screens (Requester Selection, Create Ticket, My Tickets, Ticket Detail) at desktop/tablet/mobile.
- **Head reconciliation**: Verification commits are treated as immutable historical evidence. The verification totals above (server **335/335**, client **100/100**, server build **Pass**, client build **Pass**, Lab 2 E2E **114/114**) were recorded at the commit where the tests were executed. Subsequent documentation-only commits (documentation edits and commit reference updates; no application, server, client, test, or E2E code changed) do not alter these results. The corrected E2E suite (with the full responsive and keyboard-only coverage) is recorded in the newer Results Log entry above at **132/132**.
- **Follow-up**: Release evidence package (`artifacts/lab-02/release/`), `reviewer.md`, clean-checkout verification, and final gate recorded in the release documents.

### 2026-08-27 — Non-blocking suggestion: Normalize whitespace-only search on the client
- **Scope**: Fixed `hasActiveFilters` and API call to use `search.trim()` instead of raw `search`, preventing whitespace-only input from being treated as an active filter.
- **Changes**:
  - `client/src/MyTickets.tsx`: Added `const trimmedSearch = search.trim()` before the API call; changed `search: search || undefined` to `search: trimmedSearch || undefined`; changed `hasActiveFilters` from `search || ...` to `search.trim() || ...`.
- **Command(s) run**:
  ```sh
  cd client && npx vitest run src/lab-02-tests/MyTickets.test.tsx
  ```
- **Result**: 15/15 My Tickets client tests passed.
- **Follow-up**: None.

### 2026-08-27 — Issue #14: My Tickets — Exact response-shape assertion (BLOCKING ISSUE #1 fix)
- **Scope**: Replaced `toMatchObject()` with exact `Object.keys(item).sort()` assertion in the response-shape test to fail when any undocumented key is present. Removed redundant individual `not.toHaveProperty()` checks for `requesterId`, `description`, and `relatedSystemId` since the exact-key assertion covers them.
- **Changes**:
  - `server/tests/lab-02/my-tickets-real-db.integration.test.ts`: Replaced `toMatchObject()` with `expect(Object.keys(item).sort()).toEqual(DOCUMENTED_KEYS)` where `DOCUMENTED_KEYS` is the sorted list of the 10 documented fields (`id`, `ticketNumber`, `categoryId`, `categoryName`, `summary`, `requestedPriority`, `itPriority`, `currentStatus`, `createdAt`, `updatedAt`). Removed the three individual `not.toHaveProperty()` checks as redundant.
- **Command(s) run**:
  ```sh
  cd server && npx vitest run tests/lab-02/my-tickets-real-db.integration.test.ts
  cd server && npx vitest run tests/lab-02/
  ```
- **Result**: 55/55 My Tickets real-DB tests passed; 256/256 full lab-02 server tests passed.
- **Follow-up**: The test now fails if any undocumented field is added to the API response.

### 2026-08-27 - Issue #14: My Tickets — Re-review fixes: bounded pagination, mobile CSS, exact-slice tests, evidence mapping
- **Scope**: Addressed all P1 findings from the re-review verdict. Fixed bounded pagination window, mobile-safe pagination wrapping, 44px card toggle, vertical mobile filter stacking, exact-slice pagination assertions in real-DB tests, UI-MY-05 metadata consistency, evidence matrix updates, and governance rule isolation.
- **Changes**:
  - `client/src/MyTickets.tsx`: Added `getPaginationItems()` helper that produces a bounded window of page numbers with ellipsis markers. The number of rendered pagination controls stays bounded regardless of `totalPages`. Replaced unbounded `Array.from({ length: totalPages })` with the bounded helper.
  - `client/src/App.css`: Changed `.ticket-card-toggle` `min-height` from `36px` to `44px` (AC-23). Added `.pagination-ellipsis` style. Added `flex-wrap: wrap` and `justify-content: center` to `.pagination-controls` at mobile breakpoint. Changed `.toolbar-filters` to `flex-direction: column` at mobile breakpoint for vertical filter stacking.
  - `server/tests/lab-02/my-tickets-real-db.integration.test.ts`: Replaced non-overlap-only pagination assertions with exact ordered slice assertions. Page 2 and page 3 tests now query the authoritative Prisma ordering and assert `toEqual(expectedSlice)`.
  - `client/src/lab-02-tests/MyTickets.test.tsx`: Fixed `UI-MY-05` mock metadata — changed `totalItems: 0, totalPages: 1` to `totalItems: 5, totalPages: 1` for internal consistency.
  - `docs/lab-02/tests.md`: Added real-DB integration test evidence (`server/tests/lab-02/my-tickets-real-db.integration.test.ts`) to all `API-MY-01..08` matrix rows. Added this Results Log entry.
  - `agent.md`: Removed the mandatory workflow rule from §3.1 ("When adding new test rows to tests.md, the initial status must be Planned...") — this governance rule belongs in a separate governance PR per the re-review verdict.
- **Command(s) run**:
  ```
  cd server
  npx vitest run tests/lab-02/
  ```
  ```
  cd server
  npx tsc --noEmit
  ```
  ```
  cd client
  npx vitest run
  ```
  ```
  cd client
  npx tsc --noEmit
  ```
- **Result**:
  - Server: 18 test files, 256 tests passed, 0 failed
  - Server TypeScript: No type errors
  - Client: 15 tests passed, 0 failed
  - Client TypeScript: No type errors
  - Real-DB suite: Executed with `DATABASE_URL` present — all `itIfDb` tests ran (not skipped)
- **Follow-up**: Run full Lab 2 regression after all changes are applied.
- **Scope**: Fix race condition where an older asynchronous `loadTickets()` request could overwrite newer results.
- **Changes**:
  - `client/src/MyTickets.tsx`: Added `requestSeqRef` (monotonically increasing `useRef`) to guard against stale responses. Incremented on each `loadTickets()` call. After `fetchMyTickets()` resolves, updates state only if the captured sequence ID is still the latest. Same guard applied to error-state updates.
  - `client/src/lab-02-tests/MyTickets.test.tsx`: Added `UI-MY-07` test suite with one test that uses deferred promises to verify the race condition is resolved.
- **Command(s) run**:
  - `cd client && npx vitest run src/lab-02-tests/MyTickets.test.tsx`
  - `cd client && npx tsc --noEmit`
- **Result**: 15 tests passed, 0 failed; TypeScript: 0 errors
- **Follow-up**: Also updated `agent.md` change documentation in the PR description per Issue #14 process requirement.

### 2026-08-27 - Issue #14: My Tickets — Backend API + Frontend UI implemented
- **Scope**: Backend `GET /api/tickets` endpoint with search, filter, sort, pagination, and ownership enforcement. Frontend My Tickets screen with toolbar, sortable table, mobile cards, pagination, loading/empty/no-results/error states, requester-switch data reset, and out-of-range page handling.
- **Server changes**:
  - `server/src/service.ts`: Added `getMyTickets()`, `MyTicketsParams`, `MyTicketItem`, `MyTicketsResult` interfaces
  - `server/src/controller.ts`: Added `getMyTicketsHandler` with full query param validation (categoryId malformed→400, nonexistent/inactive→409; priority/status invalid→400; sort/order/page/pageSize invalid→silent fallback)
  - `server/src/module.ts`: Added `GET /api/tickets` route with `requireDevRequesterContext` middleware
  - `server/tests/lab-02/my-tickets.api.test.ts`: 27 tests covering API-MY-01 through API-MY-08
- **Client changes**:
  - `client/src/api.ts`: Added `fetchMyTickets()`, `MyTicketsResponse`, `MyTicketItem`, `MyTicketsParams` interfaces
  - `client/src/MyTickets.tsx`: New component with sortable desktop table, mobile cards, search/filter toolbar, pagination, loading/empty/no-results/error states, requester-switch reset
  - `client/src/App.tsx`: Replaced welcome screen with `<MyTickets>`, added `myTicketsResetKey` for requester-switch clearing
  - `client/src/App.css`: Added My Tickets styles (table, cards, pagination, skeleton, toolbar, responsive)
  - `client/src/lab-02-tests/MyTickets.test.tsx`: 7 tests covering UI-MY-01 through UI-MY-05
  - Updated `App.test.tsx`, `CreateTicket.test.tsx`, `RequesterSelection.test.tsx`, `RequesterSelection.integration.test.tsx` to mock `fetchMyTickets`
- Tests added/updated: 27 server API tests + 7 client UI tests = 34 new tests, all passing
- Test status: `API-MY-01..08` and `UI-MY-01..05` marked from `Planned` → `Passed`

### 2026-08-27 - PR #25 fix plan: TicketSequence isolation, oversized-ID handling, validator unit tests, cleanup
- Scope: Implemented the 5-phase fix plan for PR #25 merge readiness.
  1. **Phase 1 — TicketSequence test isolation**: Fixed all three real-DB integration test files to snapshot/restore the current-year `TicketSequence` using the database clock (`SELECT NOW()`), track created tickets by Ticket Number, and assert restoration success. Removed the standalone cleanup simulation test (`test-ticket-sequence-cleanup.test.ts`). Removed nested `afterAll` hooks that called `disconnectPrisma()` mid-file.
  2. **Phase 2 — Oversized IDs**: Created `server/src/id-domain.ts` with `MAX_DATABASE_ID`. Updated `integer-validation.ts` with `inspectIntegerFields()` returning `{ invalidFields, outOfRangeFields }`. Controller returns `409 INACTIVE_REFERENCE` for out-of-range positive IDs. Service-layer defense-in-depth rejects IDs > `MAX_DATABASE_ID`. Requester-context uses `BigInt` to reject oversized headers before Prisma.
  3. **Phase 3 — Validator unit tests**: Exported `validateCreateTicketInput` from `service.ts`. Created `create-ticket-validation.unit.test.ts` covering both reference fields with the same matrix (missing, null, string, decimal, zero, negative), requestedPriority (missing, invalid, LOW/MEDIUM/HIGH), and trimming output.
  4. **Phase 4 — Cleanup**: Removed `.agents/skills/review-pr/SKILL.md`, `server/debug-integer.cjs`, `server/test-edge-cases.js`. Removed PR #25 status section from `agent.md`. Removed scratch `.gitignore` entry. Updated README to remove self-declared merge readiness and clarify Ticket Detail scope.
  5. **Phase 5 — Documentation**: Updated `tests.md` to include the new unit test file in `API-TKT-NOR-02` and `API-TKT-07` rows.
- Tests added/updated:
  - `server/src/id-domain.ts`: new
  - `server/src/integer-validation.ts`: added `inspectIntegerFields()` with out-of-range detection
  - `server/src/controller.ts`: uses `inspectIntegerFields`, returns 409 for out-of-range
  - `server/src/service.ts`: exported `validateCreateTicketInput`, added defense-in-depth range checks
  - `server/src/requester-context.ts`: uses `BigInt` for exact range checking
  - `server/tests/lab-02/create-ticket-validation.unit.test.ts`: new (21 tests)
  - `server/tests/lab-02/create-ticket-real-db.integration.test.ts`: root-level hooks, database clock, ticket-number tracking
  - `server/tests/lab-02/create-ticket-reference-validation.integration.test.ts`: database clock, ticket-number tracking
  - `server/tests/lab-02/ticket-number-concurrency.integration.test.ts`: database clock, ticket-number tracking, restoration assertion
  - `server/tests/lab-02/integer-validation.api.test.ts`: added 6 oversized-reference tests
  - `server/tests/lab-02/requester-context.api.test.ts`: added 3 oversized-header tests
  - Removed: `test-ticket-sequence-cleanup.test.ts`, `debug-integer.cjs`, `test-edge-cases.js`, `.agents/skills/review-pr/SKILL.md`
- Command(s) run:
  - `cd server && npx tsc --noEmit`
  - `cd server && npx vitest run tests/lab-02/create-ticket-validation.unit.test.ts`
  - `cd server && npx vitest run tests/lab-02/integer-validation.api.test.ts`
  - `cd server && npx vitest run tests/lab-02/requester-context.api.test.ts`
- Result:
  - TypeScript: 0 errors
  - create-ticket-validation.unit: 21 passed
  - integer-validation.api: 19 passed
  - requester-context.api: 15 passed
- Notes and follow-up:
  - All database integration tests must be run against a test database to verify TicketSequence isolation.
  - The real-DB integration tests should be run together to confirm no cross-file sequence interference.

### 2026-08-26 - PR #25 re-review: nested-object parser fix, boundary-test and cleanup corrections, E2E reassignment
- Scope: Addressed the PR #25 re-review "Request changes" remaining blockers and follow-ups.
  1. **P1 — 500 on ignored nested object (integer-validation.ts):** Fixed `skipValue()` to call `skipWhitespace()` before reading each nested-object key, so a comma inside an unknown nested object followed by whitespace/newline no longer throws from `readString()`. Wrapped the top-level walk in a defensive try/catch so any walker error returns the fields validated so far instead of becoming a `500 INTERNAL_ERROR`.
  2. **P1 — cross-feature E2E:** Formally amended Issue #13 to reassign the real cross-feature E2E browser flow to Issue #18 (Integration), consistent with `tests.md` §5.2 (`E2E-01..06`). The create-to-detail flow is covered at component level (mocked `createTicket`/`fetchTicketDetail`) and API/integration level; no `e2e/` directory is added in this issue.
  3. **P2 — 5-char summary boundary:** `create-ticket-real-db.integration.test.ts` now sends a literal 5-character summary `"abcde"` and asserts the persisted summary equals `"abcde"`.
  4. **P2 — cleanup:** All `afterAll` blocks in `create-ticket-real-db.integration.test.ts` now delete Tickets by tracked Ticket Number (a shared `createdTicketNumbers` array) instead of matching `summary` contains `TEST_MARKER`, so accepted 120-char summaries are no longer left behind.
  5. **Follow-up:** Removed the duplicate `API-TKT-06` matrix row in `docs/lab-02/tests.md`.
- Tests added/updated:
  - `server/src/integer-validation.ts`: `skipValue()` whitespace fix + defensive walk.
  - `server/tests/lab-02/integer-validation.api.test.ts`: added 3 cases — ignored multi-property nested object, pretty-printed nested object, and array of multi-property objects, all accepted without `500`.
  - `server/tests/lab-02/create-ticket-real-db.integration.test.ts`: literal `"abcde"` 5-char boundary; tracked Ticket Numbers for cleanup.
  - `docs/lab-02/tests.md`: updated `API-TKT-INT-01` row, removed duplicate `API-TKT-06` row, added this Results Log entry.
- Command(s) run:
  - `cd server && npx vitest run tests/lab-02/integer-validation.api.test.ts`
  - `cd server && npx vitest run tests/lab-02/create-ticket-real-db.integration.test.ts`
  - `cd server && npx vitest run tests/lab-02`
  - `cd client && npx vitest run`
- Result:
  - integer-validation: 11 passed
  - create-ticket-real-db: 16 passed
  - server tests/lab-02: 133 passed, 0 failed
  - client: 24 passed, 0 failed
- Notes and follow-up:
  - CI evidence (GitHub workflow with isolated PostgreSQL) and standalone allocator exhaustion bounding remain non-blocking follow-ups (see issue/PR review).
  - Cross-feature E2E is now formally owned by #18; `E2E-01..06` remain `Planned`.

### 2026-08-25 - PR #25 re-review: integer validation rewrite, real-DB evidence, BR-01 contiguity/rollback
- Scope: Addressed the PR #25 re-review "Request changes" P1 blockers.
  1. Rewrote `server/src/integer-validation.ts` to use a tokenizer that inspects only effective top-level fields, ignores nested occurrences, and handles JSON escape sequences in property names. Added `server/tests/lab-02/integer-validation.api.test.ts` (API-TKT-INT-01) covering decimal/exponent forms, nested same-name fields, and escaped property names.
  2. Added real-database evidence: `server/tests/lab-02/create-ticket-real-db.integration.test.ts` (API-TKT-INT-02/03/04) exercising the real `createTicket()` and `getTicketByNumber()` against the real DB for normalization/persistence, ownership/defaults, and Ticket Detail ownership. Extended `create-ticket-reference-validation.integration.test.ts` (API-TKT-02-INT) with before/after ticket-count assertions proving no ticket is created on `409`.
  3. Completed BR-01 evidence in `ticket-number-concurrency.integration.test.ts`: asserted sorted sequence contiguity, per-number year === persisted `createdAt` UTC year, and a transaction-rollback test proving a failed post-allocation insertion leaves no sequence gap.
- Tests added/updated:
  - `server/src/integer-validation.ts`: tokenizer-based top-level integer validation.
  - `server/tests/lab-02/integer-validation.api.test.ts`: new (API-TKT-INT-01).
  - `server/tests/lab-02/create-ticket-real-db.integration.test.ts`: new (API-TKT-INT-02/03/04).
  - `server/tests/lab-02/create-ticket-reference-validation.integration.test.ts`: added count assertions.
  - `server/tests/lab-02/ticket-number-concurrency.integration.test.ts`: added contiguity/year/rollback assertions.
  - `docs/lab-02/tests.md`: updated matrix rows, §6 mock-vs-real tables, and this Results Log entry.
- Command(s) run:
  - `cd server && npx vitest run tests/lab-02/integer-validation.api.test.ts`
  - `cd server && npx vitest run tests/lab-02/create-ticket-real-db.integration.test.ts`
  - `cd server && npx vitest run tests/lab-02/create-ticket-reference-validation.integration.test.ts`
  - `cd server && npx vitest run tests/lab-02/ticket-number-concurrency.integration.test.ts`
- Result:
  - integer-validation: 8 passed
  - create-ticket-real-db: 16 passed
  - create-ticket-reference-validation: 5 passed
  - ticket-number-concurrency: 8 passed
- Notes and follow-up:
  - Cross-feature E2E (`e2e/lab-02/create-to-detail.spec.ts`) remains `Planned` pending Playwright scaffolding, which is explicitly deferred in `tests.md` ("run the E2E command only after Playwright scaffolding/dependencies are added for this branch").

### 2026-08-25 - Issue #13: add database-migration, seed, and ticket-number-concurrency integration tests
- Scope: Closed Issue #13's remaining `Planned` integration rows. Added three integration test files that run against the real `DATABASE_URL` (skip cleanly when absent): `database-migration.integration.test.ts` (DB-01/DB-02), `seed.integration.test.ts` (SEED-01/SEED-02), and `ticket-number-concurrency.integration.test.ts` (API-TKT-06). Applied the pending `20260825000000_add_ticket_related_system_attachment` migration and re-ran the seed locally. Verified the suite leaves the database clean (snapshot/restore of the current-year `TicketSequence`, cleanup of created tickets and test-year rows).
- Tests added/updated:
  - `server/tests/lab-02/database-migration.integration.test.ts`: DB-01 required tables/columns/nullable `itPriority`/`ticketOwnerId`/`ticketNumber` unique index/`NEW` default; DB-02 Lab 1 Category rows survive with `isActive=true`.
  - `server/tests/lab-02/seed.integration.test.ts`: SEED-01 idempotency (run twice) and unrelated-category preservation; SEED-02 four required categories exactly once, ≥6 related systems, ≥4 active + ≥1 inactive requesters.
  - `server/tests/lab-02/ticket-number-concurrency.integration.test.ts`: API-TKT-06 increment (`000001`→`000002`), year rollover reset, 20-way concurrent uniqueness, sequence exhaustion (`409 TICKET_SEQUENCE_EXHAUSTED`, no ticket created), and end-to-end distinct ticket numbers with `currentStatus === NEW`.
  - `docs/lab-02/tests.md`: DB-01/02, SEED-01/02, API-TKT-06 → `Passed`; added this Results Log entry.
- Command(s) run:
  - `cd server && npx vitest run`
  - `cd client && npx vitest run`
- Result:
  - Server: 105 passed, 0 failed (was 89)
  - Client: 20 passed, 0 failed
- Notes and follow-up:
  - `Attachment` schema/migration and the empty `attachments: []` on ticket detail remain in #13's scope per §7 (schema increment); attachment UI/endpoints stay `Planned` for #15.
  - Known schema gap (out of #13 scope, flagged for #15): `Attachment.storedFilename` is not `@unique` and the `uploaderRequester`/`removedByRequester` relations are absent versus specification §7.

### 2026-08-25 - PR #23 review: fix agent.md hierarchy, narrow Tests.md rule, clean up unused imports
- Scope: Addressed @oangsa PR #23 review findings. Fixed `agent.md` section hierarchy (moved misplaced `3.3`/`3.4` back under `## 3`, removed duplicate `## 4`, renumbered subsequent sections). Narrowed the Tests.md cross-reference rule in `### 4.2` to apply only to Lab 2 contract matrix tests, explicitly excluding legacy Lab 1 tests and supporting utilities — preventing false flags on files like `server/tests/categories.test.ts`. Cleaned up unused `fireEvent`/`waitFor` imports from `client/src/App.test.tsx`. Added `reviewer.md` update requirement to `agent.md` Standard Task Flow. Updated `reviewer.md` with PR #23 review record. Updated `ai-use.md` with prompts 20-21 and reflections 14-15.
- Tests added/updated:
  - `agent.md`: fixed section hierarchy; narrowed Tests.md rule scope.
  - `client/src/App.test.tsx`: removed unused `fireEvent`/`waitFor` imports.
  - `docs/lab-02/reviewer.md`: added PR #23 review comments and responses table.
  - `docs/lab-02/ai-use.md`: added prompts 20-21 and reflections 14-15.
- Command(s) run:
  - `cd server && npm test`
  - `cd client && npm test`
- Result:
  - Server: 39 passed, 7 skipped (DB-dependent), 0 failed
  - Client: 13 passed, 0 failed
- Notes and follow-up:
  - The `agent.md` Post-Implementation Double-Check Alignment Method (§4) is now properly nested and the Tests.md rule no longer conflicts with legacy Lab 1 test files.

### 2026-08-25 - Issue #13 scope amendment: attachment orchestration moved to #15
- Scope: Amended Issue #13 to remove attachment orchestration from its scope. The attachment panel, multi-file upload, and partial-success (Case B) UI behaviors require the full attachment endpoints and storage infrastructure created in #15. Formally reassigned `UI-TKT-06` and `UI-TKT-08` from #13 to #15. Updated #13 and #15 on GitHub to own their correct rows. Added `tests.md` §5.2 documenting the redistribution.
- Tests added/updated:
  - `docs/lab-02/tests.md`: added §5.2 Issue #13 scope redistribution; updated downstream row assignments.
  - GitHub Issues #13, #15 amended.
- Command(s) run: none (docs + issue governance only; no code changes)
- Result: all existing tests unchanged.
- Notes and follow-up:
  - `UI-TKT-06` and `UI-TKT-08` remain `Planned` in this branch until their owning downstream feature (#15) is implemented. They are no longer blockers for Issue #13.

### 2026-08-24 - Issue #12 amendment: scope realignment and cross-feature row redistribution
- Scope: Amended Issue #12 to remove cross-feature acceptance rows that depend on downstream models/endpoints/screens. Formally reassigned `API-REQ-02` to #14 (My Tickets), `API-REQ-03` to #13 (Ticket Creation), `API-CONTRACT-01` and `E2E-05` to #18 (Integration), and `UI-MY-03` to #14 (My Tickets). Updated #12, #13, #14, and #18 on GitHub to own their correct rows. Rewrote `tests.md` §5.1 from "Issue #12 is not complete" to a truth-table showing redistribution. The remaining #12 rows (`API-REQ-01`, `UI-REQ-01..07`) are implemented and passing; #12 is now scoped to completion at the requester-selection foundation.
- Tests added/updated:
  - `docs/lab-02/tests.md`: rewrote §5.1; updated `README.md` wording.
  - `docs/lab-02/ai-use.md`: added re-review fixes entry.
  - GitHub Issues #12, #13, #14, #18 amended.
- Command(s) run: none (docs + issue governance only; no code changes)
- Result: all 49 server / 19 client tests unchanged.
- Notes and follow-up:
  - `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` remain `Planned` in this branch until their owning downstream features are implemented. They are no longer blockers for Issue #12.

### 2026-08-24 - PR #21 re-review: Issue #12 scope truthfulness, header evidence, keyboard flow
- Scope: Addressed the PR #21 "Request Changes" blockers. Rewrote §5.1 so it no longer redefines Issue #12 required rows as downstream-owned; it now states explicitly that Issue #12 is not complete while `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` remain `Planned`. Added a network-boundary assertion for the `X-Dev-Requester-Id` header (`UI-REQ-06`) and a keyboard-only Change Requester activation test (`UI-REQ-07`). Added a `dev-requesters.service.test.ts` to prove the `getActiveDevRequesters()` active-filter query. Corrected README wording so it no longer implies all Issue #12 rows are implemented and passing.
- Tests added/updated:
  - `server/tests/lab-02/dev-requesters.service.test.ts`: new service-level test asserting `where: { isActive: true }`.
  - `client/src/lab-02-tests/RequesterSelection.integration.test.tsx`: captures the `/api/requester-context` fetch `init` and asserts `X-Dev-Requester-Id === "1"`.
  - `client/src/lab-02-tests/RequesterSelection.test.tsx`: added keyboard-only Change Requester → selector test.
  - `docs/lab-02/tests.md`: rewrote §5.1; updated `API-REQ-01`, `UI-REQ-06`, `UI-REQ-07` matrix rows; added this Results Log entry.
  - `agent.md`: added a step-0 rule to read requirements and the issue before planning.
  - `README.md`: corrected completion wording and updated test counts.
- Command(s) run:
  - `cd server && npm test`
  - `cd client && npm test`
- Result:
  - Passed: 49 server tests across 10 test files; 19 client tests across 4 test files
  - Failed: 0
  - Skipped/Disabled: DB-dependent integration tests skip when `DATABASE_URL` is absent
- Notes and follow-up:
  - Issue #12 remains incomplete: `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` stay `Planned` until their complete contracts are executable (see §5.1).

### 2026-08-29 — Issue #18: Integration verification and visual/E2E/UI-style coverage

- Scope: Implemented all remaining Issue #18 tests. Performed full verification across all 13 phases of the Issue #18 agent execution plan.
- Changes:
  - **client/src/lab-02-tests/UiStyles.test.tsx**: New file covering UI-STYLE-01 (CSS class verification for editable/read-only/invalid/disabled/busy states, button hierarchy, nav active states), UI-STYLE-02 (required-field asterisks, inline validation messages), and UI-STYLE-03 (priority/status badge CSS classes and non-color-reliant text labels). 16 tests, all passing.
  - **e2e/lab-02/**: 6 Playwright test spec files covering E2E-01 (requester ticket flow), E2E-02 (ownership isolation), E2E-03 (attachment lifecycle), E2E-04 (partial success/BR-17), E2E-05 (keyboard accessibility), and VISUAL-01/E2E-06 (responsive layout + screenshot evidence). All tests use route interception for mocking and capture screenshots to `artifacts/lab-02/screenshots/`.
  - **playwright.config.ts**: Three projects (desktop 1280×800, tablet 820×1180, mobile 390×844) for responsive testing.
  - **e2e/lab-02/responsive-visual.spec.ts**: Comprehensive visual evidence capture for all screen states (Requester Selection loading/empty/failure/populated; Create Ticket initial/validation-error/submitting/success/api-failure/invalid-attachment/partial-success; My Tickets default/loading/empty/no-results/filtered/failure; Ticket Detail default/loading/failure/attachment-active/uploading/invalid/removed/unavailable/preview-modal). Records horizontal overflow assertions for each viewport.
  - **Artifact directories**: Full directory tree created under `artifacts/lab-02/screenshots/` with 26 subfolders for visual evidence.
  - **docs/lab-02/tests.md**: Updated matrix rows: `UI-STYLE-01/02/03` → **Passed**, `E2E-01/02/03/04/05` → **Implemented**, `VISUAL-01/E2E-06` → **Implemented**, `STATIC-01` → **Passed**. Updated `E2E-05` row (downstream) to `Planned (E2E — requires Playwright + running backend)`. Added this results log.
- Static/security review (STATIC-01): Confirmed BR-25 is respected (header validated server-side), BR-31 is respected (no static attachment routes), no internal leakage in errors, ownership and isRemoved checks occur server-side on all attachment operations.
- Command(s) run:
  ```sh
  cd client && npx vitest run
  cd server && npx vitest run tests/lab-02/
  ```
- Result:
  - **Client**: 8 test files, 100 tests passed, 0 failed (was 84 before this issue, +16 new UI-STYLE tests)
  - **Server**: 13 lab-02 test files passed, 216 tests passed, 110 real-DB skipped (no database), 0 failed
  - **E2E**: Playwright tests implemented but require running client and server for execution
  - **TypeScript**: No compilation errors
- Notes and follow-up:
  - E2E tests require both client dev server (`localhost:5173`) and server (`localhost:3000`) running
  - E2E tests use mocked API responses via `page.route()`, so the server does not need a real database running for visual evidence capture
  - Visual/responsive screenshots must be collected by running `npx playwright test --project=desktop`, `--project=tablet`, `--project=mobile`
- Scope: Addressed PR #21 re-review findings that several matrix rows were marked `Passed` without their full contract being executable in this issue's scope. Demoted `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` from `Passed` to `Planned` (their remaining behavior belongs to the ticket-creation / my-tickets / attachments downstream issues). Removed the premature `fetchMyTickets()` runtime call that hit a non-existent `GET /api/tickets` endpoint. Restored the unrelated Lab 1 `/api/health` endpoint, client `checkHealth`, and System Overview UI that had been removed outside Issue #12 scope. Repaired the keyboard-only test so it asserts post-Continue shell state rather than the already-present `<option>` text. Added a new `agent.md` §3.4 scope/status rule.
- Tests added/updated:
  - `docs/lab-02/tests.md`: demoted 5 rows to `Planned`; added §5.1 Issue #12 scope boundary; repaired Results Log ordering and contradictions.
  - `client/src/api.ts`: removed `fetchMyTickets`; restored `checkHealth`.
  - `client/src/App.tsx`: removed `fetchMyTickets` effect; restored System Overview / Check System UI.
  - `client/src/App.test.tsx`: restored System Overview + Check System tests.
  - `client/src/lab-02-tests/MyTickets.test.tsx`: reverted `fetchMyTickets` assertions.
  - `client/src/lab-02-tests/RequesterSelection.test.tsx`: fixed keyboard-only test false positive.
  - `client/src/lab-02-tests/RequesterSelection.integration.test.tsx`: removed `/api/tickets` mock.
  - `server/src/{controller,module,service}.ts` + `server/tests/health*.test.ts`: restored `/api/health`.
- Command(s) run:
  - `cd server && npm test`
  - `cd client && npm test`
- Result:
  - Passed: 48 server tests across 9 test files; 18 client tests across 4 test files
  - Failed: 0
  - Skipped/Disabled: DB-dependent integration tests skip when `DATABASE_URL` is absent
- Notes and follow-up:
  - `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` remain `Planned` until their owning downstream features exist; see §5.1.

### 2026-08-24 - PR #21 review feedback: contract coverage, test alignment, E2E-05 evidence
- Scope: Addressed P1 review feedback from @oangsa on PR #21 — expanded API-CONTRACT-01 matrix with malformed JSON, non-object body, wrong Content-Type, and duplicate query parameter tests; confirmed `dev-requesters.api.test.ts` and `requester-context.api.test.ts` exist at the Issue #12 required paths; added keyboard-only Continue test for E2E-05; added canonical JSON parsing error middleware in `server/src/app.ts`.
- Tests added/updated:
  - `server/tests/lab-02/api-contract.api.test.ts`: added request parsing contract describe block (4 new tests)
  - `server/tests/lab-02/dev-requesters.api.test.ts`: expanded with 5 total tests
  - `client/src/lab-02-tests/RequesterSelection.test.tsx`: added keyboard-only focus test
  - `server/src/app.ts`: added canonical JSON parsing error middleware
- Command(s) run:
  - `npx vitest run` (server): 45 passed, 0 failed
  - `npx vitest run` (client): 12 passed, 0 failed
- Result:
  - Passed: 57 total tests (45 server + 12 client)
  - Failed: 0
  - Skipped/Disabled: DB-dependent integration tests skip when `DATABASE_URL` is absent
- Notes and follow-up:
  - The `2026-08-24` truthfulness audit (above) later demoted `API-REQ-02`, `API-REQ-03`, `API-CONTRACT-01`, `UI-MY-03`, and `E2E-05` back to `Planned` because their full contracts still depend on downstream features.

### 2026-08-23 - PR #16 re-review contract closure (docs-only)
- Scope: Resolved the second PR #16 re-review pass — merged the duplicate `BR-23` into a canonical `BR-23`/`BR-30` pair, froze Ticket Number sequence semantics, added a canonical `error.code` table, froze the attachment storage-access and persistence-compensation invariants (new `BR-31`), and closed the remaining Test-DD gaps.
- Tests added/updated: Added planned rows `API-TKT-07`, `STATIC-01`, `ATT-PERSIST-01`, `API-ATT-OWN-01`, `API-ATT-15`; tightened `API-TKT-01`, `API-TKT-06`, `API-MY-06`, `API-MY-08`, `API-ATT-01`, `API-ATT-05`, `UI-DETAIL-01`; retargeted `UI-MY-01`, `UI-MY-02`, `UI-MY-05` from `BR-23` to `BR-30`. Updated `specification.md`, `api-spec.md`, `ui-spec.md`, and `agent.md`.
- Command(s) run:
  - `git status`
- Result:
  - Passed: 0
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - This is a documentation/planned-test contract pass only; the referenced automated test files remain future implementation work.
  - No executable tests exist yet in this repository for Lab 2, so no test run was performed.

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
  - Historical record: this removal was later reverted in the `2026-08-24` truthfulness audit because it was unrelated to Issue #12 and belonged to a separate issue.

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
- Tests added/updated: Added `server/tests/lab-02/api-contract.api.test.ts` and `client/src/lab-02-tests/RequesterSelection.test.tsx`; adapted `client/src/App.test.tsx` for mandatory requester context.
- Command(s) run:
  - `npm test -- --run tests/lab-02/dev-requesters.api.test.ts tests/lab-02/requester-context.api.test.ts`
  - `npm run build` (server)
  - `npm test -- --run src/lab-02-tests/RequesterSelection.test.tsx src/App.test.tsx`
  - `npm run build` (client)
- Result:
  - Passed: 18 focused tests; 2 production builds
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - At the time of this entry, the dedicated `dev-requesters.api.test.ts` and `requester-context.api.test.ts` files required by Issue #12 were not yet present in this branch. They were added in a later commit.
  - Full-suite validation and `git diff --check` remain required before commit/push.

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