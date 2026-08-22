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
| UI-REQ-01 | UI | Route guard redirects to selector when requester context missing | `client/src/lab-02-tests/RequesterSelection.test.tsx` | FR-01 | BR-03a, BR-05 | AC-02 |
| API-TKT-01 | API | Create ticket success returns generated ticket number | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02, FR-03 | BR-01, BR-02 | AC-01 |
| UI-TKT-01 | UI | Empty summary blocks submit and shows field error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-04 |
| UI-TKT-02 | UI | Summary over 120 chars blocks submit with length error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-08 | AC-05 |
| UI-TKT-03 | UI | Description under 10 chars blocks submit with field error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-09 | AC-06 |
| UI-TKT-04 | UI | Submit busy state prevents duplicate submission | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-02 | BR-15 | AC-10 |
| UI-TKT-05 | UI | Failed create keeps entered values and shows inline error | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16 | AC-11 |
| API-TKT-02 | API | Inactive/stale category or related-system ID rejected | `server/tests/lab-02/create-ticket.api.test.ts` | FR-02 | BR-07 | AC-01 |
| API-TKT-03 | API | Ticket detail returns 404 for non-owner access | `server/tests/lab-02/ticket-detail.api.test.ts` | FR-09 | BR-24 | AC-03 |
| API-MY-01 | API | My Tickets returns only current requester-owned tickets | `server/tests/lab-02/my-tickets.api.test.ts` | FR-04 | BR-24 | AC-14 |
| API-MY-02 | API | Search by ticket number/summary substring | `server/tests/lab-02/my-tickets.api.test.ts` | FR-05 | BR-22 | AC-17 |
| API-MY-03 | API | Category/Priority/Status filters are conjunctive | `server/tests/lab-02/my-tickets.api.test.ts` | FR-06 | BR-22 | AC-18 |
| API-MY-04 | API | Deterministic sort order with tie-breakers and priority ordering | `server/tests/lab-02/my-tickets.api.test.ts` | FR-07 | BR-22 | AC-19 |
| API-MY-05 | API | Pagination returns correct page metadata and slices | `server/tests/lab-02/my-tickets.api.test.ts` | FR-08 | BR-22 | AC-20 |
| UI-MY-01 | UI | Empty state shown for requester with zero tickets ever | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23 | AC-21 |
| UI-MY-02 | UI | No-results state shown for active filters yielding zero rows | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-16 | BR-23 | AC-22 |
| UI-MY-03 | UI | Requester switch clears prior data and reloads new scope | `client/src/lab-02-tests/MyTickets.test.tsx` | FR-14 | BR-14 | AC-14 |
| API-ATT-01 | API | Disallowed attachment type rejected server-side | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12, BR-13 | AC-07 |
| UI-ATT-01 | UI | Disallowed attachment type rejected client-side | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-10 | BR-12, BR-13 | AC-07 |
| API-ATT-02 | API | Sixth active attachment rejected by server limit | `server/tests/lab-02/attachments.api.test.ts` | FR-10 | BR-12 | AC-08 |
| API-ATT-03 | API | Attachment size boundaries in bytes are enforced | `server/tests/lab-02/attachment-validation.unit.test.ts` | FR-10 | BR-12 | AC-09 |
| API-ATT-04 | API | Soft remove marks removed metadata and disables access | `server/tests/lab-02/attachments.api.test.ts` | FR-11, FR-13 | BR-18, BR-19, BR-20 | AC-12, AC-13 |
| API-ATT-05 | API | Preview/download endpoint behavior for active vs removed files | `server/tests/lab-02/attachments.api.test.ts` | FR-12, FR-13 | BR-18, BR-Attach-preview | AC-13, AC-24 |
| UI-ATT-02 | UI | Removed attachment row shows Removed badge and disabled controls | `client/src/lab-02-tests/AttachmentSection.test.tsx` | FR-11 | BR-20 | AC-12 |
| E2E-01 | E2E | Requester creates ticket and later finds it in My Tickets | `e2e/lab-02/requester-ticket-flow.spec.ts` | FR-02, FR-04 | BR-01, BR-22 | AC-01, AC-17 |
| E2E-02 | E2E | Ownership isolation across two requester contexts | `e2e/lab-02/ownership.spec.ts` | FR-09 | BR-24 | AC-03 |
| E2E-03 | E2E | Full attachment lifecycle (upload/preview/download/remove) | `e2e/lab-02/attachment-lifecycle.spec.ts` | FR-10, FR-11, FR-12, FR-13 | BR-12, BR-18, BR-Attach-preview | AC-07, AC-12, AC-13, AC-24 |
| E2E-04 | E2E | Mobile layout has no horizontal scroll and stacked controls | `e2e/lab-02/responsive-create-ticket.spec.ts` | — | — | AC-23 |
| E2E-05 | E2E | Keyboard-only create-ticket flow with visible focus indicators | `e2e/lab-02/keyboard-access.spec.ts` | — | — | AC-25 |
| UI-ERR-01 | UI | API failure preserves form state and requires manual retry | `client/src/lab-02-tests/CreateTicket.test.tsx` | FR-17 | BR-16, BR-17 | AC-11 |

### Required boundary assertions for `MAX_ATTACHMENT_BYTES = 5,000,000`
- `4,999,999` bytes → accepted
- `5,000,000` bytes → accepted
- `5,000,001` bytes → rejected

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