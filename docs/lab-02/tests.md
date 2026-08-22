# Lab 2 Test Plan and Results - TokTickIT Requester Ticketing MVP

## 1. Purpose
This file is the Lab 2 testing contract for:
- `docs/lab-02/specification.md`
- `docs/lab-02/api-spec.md`

It has been adjusted to match the current repository state:
- Current project has only Lab 1 implemented behavior (`health`, `categories`).
- Lab 2 tests below are planned targets and should be created incrementally.

## 2. Current Test Tooling and Real Paths

Backend (already configured):
- Runner: Vitest
- Existing folder: `server/tests/`

Frontend (already configured):
- Runner: Vitest + React Testing Library
- Existing tests: `client/src/App.test.tsx`

Not yet present in repository:
- `e2e/` Playwright project and config
- `server/tests/lab-02/` folder
- `client/src/lab-02-tests/` folder
- Root `package.json` with `test:lab02` pipeline

Decision for alignment:
- Use Vitest commands for server/client now.
- Introduce Playwright only when e2e scaffolding is added.

## 3. Execution Strategy
Test-first per issue:
1. Add or update tests for one issue scope.
2. Run tests and capture fail reason.
3. Implement minimal code.
4. Re-run tests to green.
5. Log results in Section 8 of this file.

## 4. Planned Lab 2 Tests

### 4.1 Backend Unit and API (to be created)
Target folder:
- `server/tests/lab-02/`

Planned files:
- `server/tests/lab-02/ticket-number.unit.test.ts`
- `server/tests/lab-02/validators.unit.test.ts`
- `server/tests/lab-02/attachment-validation.unit.test.ts`
- `server/tests/lab-02/create-ticket.api.test.ts`
- `server/tests/lab-02/ticket-detail.api.test.ts`
- `server/tests/lab-02/my-tickets.api.test.ts`
- `server/tests/lab-02/attachments.api.test.ts`
- `server/tests/lab-02/dev-requesters.api.test.ts`

### 4.2 Frontend Component Tests (to be created)
Target folder:
- `client/src/lab-02-tests/`

Planned files:
- `client/src/lab-02-tests/CreateTicket.test.tsx`
- `client/src/lab-02-tests/AttachmentSection.test.tsx`
- `client/src/lab-02-tests/MyTickets.test.tsx`
- `client/src/lab-02-tests/RequesterTicketDetail.test.tsx`
- `client/src/lab-02-tests/RequesterSelection.test.tsx`
- `client/src/lab-02-tests/AppShell.test.tsx`
- `client/src/lab-02-tests/Badges.test.tsx`
- `client/src/lab-02-tests/Buttons.test.tsx`
- `client/src/lib/__tests__/requesterSession.unit.test.ts`

### 4.3 E2E, Responsive, Visual (to be created)
Target folder:
- `e2e/lab-02/`

Planned files:
- `e2e/lab-02/create-ticket.spec.ts`
- `e2e/lab-02/requester-ticket-flow.spec.ts`
- `e2e/lab-02/ownership.spec.ts`
- `e2e/lab-02/attachment-lifecycle.spec.ts`
- `e2e/lab-02/requester-switch.spec.ts`
- `e2e/lab-02/keyboard-access.spec.ts`
- `e2e/lab-02/create-ticket-failure.spec.ts`
- `e2e/lab-02/selector-guard.spec.ts`
- `e2e/lab-02/responsive-create-ticket.spec.ts`
- `e2e/lab-02/responsive-my-tickets.spec.ts`
- `e2e/lab-02/responsive-ticket-detail.spec.ts`
- `e2e/lab-02/visual-tokens.spec.ts`

## 5. Coverage Matrix (FR/BR/AC)
The detailed AC matrix from the previous version remains valid as target intent.
For implementation order, map tests by issue:

- Issue 1 Requirement + AI process:
  - Documentation gates, traceability updates in this file, AI usage logs.
- Issue 2 User login surrogate (dev requester selection):
  - BR-03, BR-03a, BR-04, BR-05, FR-01, AC-02, AC-15
- Issue 3 Ticket creation:
  - FR-02, FR-03, BR-01, BR-02, BR-07, BR-08, BR-09, BR-10, BR-15, BR-16, AC-01, AC-04, AC-05, AC-06, AC-10, AC-11
- Issue 4 My Tickets:
  - FR-04, FR-05, FR-06, FR-07, FR-08, FR-14, FR-16, BR-14, BR-22, BR-23, AC-14, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22
- Issue 5 Attachment:
  - FR-10, FR-11, FR-12, FR-13, BR-12, BR-13, BR-18, BR-19, BR-20, BR-Attach-preview, AC-07, AC-08, AC-09, AC-12, AC-13, AC-24

Cross-cutting ownership:
- BR-24 and AC-03 must be covered in ticket detail and attachment APIs.

## 6. Commands

Current working commands:

```bash
# backend tests
cd server && npm test

# frontend tests
cd client && npm test
```

Future commands (after Lab 2 test scaffolding exists):

```bash
# backend Lab 2 subset (example pattern)
cd server && npx vitest run tests/lab-02

# frontend Lab 2 subset
cd client && npx vitest run src/lab-02-tests

# e2e/responsive/visual (after Playwright setup)
npx playwright test e2e/lab-02
```

Root pipeline target (to add later):
- `npm run test:lab02`

## 7. Responsive and Visual Checklist
Per screen (Requester Selection, Create Ticket, My Tickets, Ticket Detail) at 1280, 820, 375:
- [ ] Zen Green tokens applied consistently
- [ ] Editable vs read-only field styling distinct
- [ ] Required marker and inline validation placements correct
- [ ] Button hierarchy and disabled/busy states correct
- [ ] No clipping or overlap
- [ ] No horizontal scrolling
- [ ] Badges readable without color-only meaning
- [ ] Loading, empty, no-results, and error states distinct

## 8. Results Log (Newest First)

Use one entry per completed work item:

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
- Scope: Documentation/process baseline updates for Lab 2 (README, tests plan, agent workflow).
- Tests added/updated: No executable test files changed.
- Command(s) run:
  - static validation of edited markdown files
- Result:
  - Passed: 0
  - Failed: 0
  - Skipped/Disabled: 0
- Notes and follow-up:
  - This was a documentation alignment step only.
  - Functional test runs begin when implementation issues (2-5) start.

Current status:
- No Lab 2 tests implemented yet.
- Existing Lab 1 baseline tests still pass on current branch when environment is configured.

## 9. Known Gaps and Risks
- No Playwright scaffolding yet, so AC-23 and AC-25 cannot be automatically verified yet.
- No root-level test orchestrator exists yet.
- Lab 2 models and endpoints are not implemented yet, so all API/UI/E2E rows for Lab 2 remain planned.

## 10. Definition of Done for this Document
- Every completed Lab 2 branch updates this file with concrete command output summary.
- No silent test skips for required acceptance criteria.
- AC-to-test traceability remains explicit and current.
