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

## 4. Test Traceability Matrix (Planned Contract)

| Test ID | Level | Scenario | Test File Path | FR | BR | AC |
|---|---|---|---|---|---|---|
| API-REQ-01 | API | Selector returns only active development requesters | `server/tests/lab-02/dev-requesters.api.test.ts` | FR-01, FR-15 | BR-03, BR-04 | AC-15 |
| UI-REQ-01 | UI | Route guard redirects to selector when requester context missing | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-21, BR-05 | AC-02 |
| API-TKT-01 | API | Create ticket success returns generated ticket number | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-03 | BR-01, BR-02 | AC-01 |
| API-TKT-04 | API | Ownership is assigned from `X-Dev-Requester-Id` at creation and cannot be changed by the client | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-04 | BR-06, BR-21, BR-24 | AC-01, AC-03 |
| API-TKT-05 | API | Requester-created tickets keep IT Priority and Ticket Owner null | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-11 | AC-01 |
| UI-TKT-07 | UI | Requested Priority control is required and defaults to MEDIUM | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-10 | — |
| UI-TKT-01 | UI | Empty summary blocks submit and shows field error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-04 |
| UI-TKT-02 | UI | Summary over 120 chars blocks submit with length error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-05 |
| UI-TKT-03 | UI | Description under 10 chars blocks submit with field error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-09 | AC-06 |
| UI-TKT-04 | UI | Submit busy state prevents duplicate submission | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-15 | AC-10 |
| UI-TKT-05 | UI | Case A — failed create keeps entered values and shows inline error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 |
| UI-TKT-06 | UI | Case B — partial success: ticket created but attachment upload failed shows Ticket Number, separate attachment error, and blocks ticket resubmission | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02, FR-10, FR-17 | BR-17 | AC-26 |
| API-TKT-02 | API | Inactive/stale category or related-system ID rejected with 409 | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-07 | AC-27 |
| API-TKT-03 | API | Ticket detail returns 404 for non-owner access | `server/tests/lab-02/ticket-detail.api.test.ts` | FR-09 | BR-24 | AC-03 |
| API-MY-01 | API | My Tickets returns only current requester-owned tickets (ownership isolation) | `server/tests/lab-02/my-tickets.api.test.ts` | FR-04 | BR-24 | AC-03 |
| API-MY-02 | API | Search by ticket number/summary substring | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05 | BR-22 | AC-17 |
| API-MY-03 | API | Category/Priority/Status filters are conjunctive | `server/tests/lab-02/my-tickets.api.test.ts` | FR-06 | BR-22 | AC-18 |
| API-MY-04 | API | Deterministic sort order with tie-breakers and priority ordering | `server/tests/lab-02/my-tickets.api.test.ts` | FR-07 | BR-22 | AC-19 |
| API-MY-05 | API | Pagination returns correct page metadata and slices | `server/tests/lab-02/my-tickets.api.test.ts` | FR-08 | BR-22 | AC-20 |
| UI-MY-01 | UI | Empty state shown for requester with zero tickets ever | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23 | AC-21 |
| UI-MY-02 | UI | No-results state shown for active filters yielding zero rows | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23 | AC-22 |
| UI-MY-03 | UI | Requester switch clears prior data and reloads new scope | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-14 | BR-14 | AC-14 |
| UI-MY-04 | UI | My Tickets loading and API failure states show skeleton/error with manual Retry | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-04, FR-17 | BR-16 | — |
| API-REQ-02 | API | Requester-scoped endpoints reject missing/unknown/inactive `X-Dev-Requester-Id` with 422 while historical tickets remain persisted and unreachable through requester flows | `server/tests/lab-02/requester-context.api.test.ts` | FR-15 | BR-04, BR-05, BR-29 | AC-15 |
| API-ATT-01 | API | Disallowed attachment type rejected server-side | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12, BR-13 | AC-07 |
| UI-ATT-01 | UI | Disallowed attachment type rejected client-side | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 |
| API-ATT-02 | API | Sixth active attachment rejected by server limit | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-08 |
| UNIT-ATT-01 | Unit | Attachment size boundary validator: 4,999,999 / 5,000,000 accepted, 5,000,001 rejected | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12 | AC-09 |
| API-ATT-03 | API | Oversized attachment upload rejected by server with 413 | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-09 |
| UI-ATT-03 | UI | Selecting an oversized file shows size error immediately and prevents upload (client-side rejection) | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12 | AC-09 |
| API-ATT-04 | API | Soft remove marks removed metadata and disables access | `server/tests/lab-02/attachments.api.test.ts` | FR-11, FR-13 | BR-18, BR-19, BR-20 | AC-12, AC-13 |
| API-ATT-05 | API | Preview/download endpoint behavior for active vs removed files | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18, BR-28 | AC-13, AC-24 |
| UI-ATT-02 | UI | Removed attachment row shows Removed badge and disabled controls | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-20 | AC-12 |
| API-ATT-06 | API | BR-17 partial success: ticket POST succeeds, attachment upload fails, ticket persists and is not rolled back | `server/tests/lab-02/attachments.api.test.ts` | FR-02, FR-10 | BR-17 | AC-26 |
| API-ATT-07 | API | Attachment metadata is persisted and stored filename is generated safely with validated extension | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-26, BR-27 | AC-07 |
| UI-DETAIL-01 | UI | Ticket Detail renders read-only fields, loading/failure/not-found states, active and removed attachments, Preview/Download/Remove, and Add Attachment controls | `client/src/lab-02-tests/RequesterTicketDetail.test.tsx` | FR-09, FR-10, FR-11, FR-12, FR-13, FR-17 | BR-16, BR-18, BR-20, BR-24, BR-28 | AC-03, AC-12, AC-13, AC-24 |
| E2E-01 | E2E | Requester creates ticket and later finds it in My Tickets | `e2e/lab-02/requester-ticket-flow.spec.ts` | FR-02, FR-04 | BR-01, BR-22 | AC-01, AC-17 |
| E2E-02 | E2E | Ownership isolation across two requester contexts | `e2e/lab-02/ownership.spec.ts` | FR-09 | BR-24 | AC-03 |
| E2E-03 | E2E | Full attachment lifecycle (upload/preview/download/remove) | `e2e/lab-02/attachment-lifecycle.spec.ts` | FR-10, FR-11, FR-12, FR-13 | BR-12, BR-18, BR-28 | AC-07, AC-12, AC-13, AC-24 |
| E2E-04 | E2E | BR-17 partial success: ticket created, attachment upload fails, ticket persists, no duplicate, retry from Ticket Detail | `e2e/lab-02/partial-success-attachment.spec.ts` | FR-02, FR-10, FR-17 | BR-17 | AC-26 |
| E2E-05 | E2E | Keyboard-only create-ticket flow with visible focus indicators | `e2e/lab-02/keyboard-access.spec.ts` | — | — | AC-25 |
| UI-ERR-01 | UI | Case A — ticket create API failure preserves form state and requires manual retry | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 |
| UI-STYLE-01 | UI Style | Editable/read-only/invalid/disabled/busy field and button styles match Zen Green tokens | `client/src/lab-02-tests/UiStyles.test.tsx` | — | — | AC-23 |
| UI-STYLE-02 | UI Style | Required-field labels show red asterisk; validation messages render directly under fields | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-08, BR-09 | AC-04, AC-06 |
| UI-STYLE-03 | UI Style | Priority/Status/Removed badge styling and non-color-reliant labels | `client/src/lab-02-tests/UiStyles.test.tsx` | — | BR-20 | AC-12 |
| VISUAL-01 | Visual | Zen Green screenshots across all Lab 2 screens at desktop/tablet/mobile viewports | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 |
| E2E-06 | E2E | Responsive layout across all Lab 2 screens (Requester Selection, Create Ticket, My Tickets, Ticket Detail) at desktop/tablet/mobile — no horizontal scroll, stacked controls on mobile | `e2e/lab-02/responsive-visual.spec.ts` | — | — | AC-23 |

### Required boundary assertions for `MAX_ATTACHMENT_BYTES = 5,000,000`
- `4,999,999` bytes → accepted
- `5,000,000` bytes → accepted
- `5,000,001` bytes → rejected

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

Planned coverage: `UI-TKT-06`, `API-ATT-06`, `E2E-04`.

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