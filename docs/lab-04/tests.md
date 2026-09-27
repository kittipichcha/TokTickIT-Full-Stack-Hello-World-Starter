# Lab 4 Test DD — Contract Draft, Planned Only

> This is a pre-implementation test contract. All Lab 4 rows are **Planned**. No Lab 4 code, test, migration, or end-to-end flow has been executed by this documentation task. `Passed` requires executable evidence after the owning issue is implemented.

## 1. Purpose and source

Test the Lab 4 behavior in `docs/lab-04/specification.md` against the supplied `SE+Lab+4.pdf`, while preserving the approved Lab 2 and Lab 3 contracts. The detailed API and UI contracts in this directory govern implementation. Keep AC IDs stable unless a requirement changes through review.

## 2. Tooling and planned paths

- Backend unit/API/integration: Vitest and Supertest under `server/tests/lab-04/`; real PostgreSQL/Prisma for migration, persistence, and concurrency tests.
- Frontend component/style: Vitest and React Testing Library under `client/src/lab-04-tests/`.
- End-to-end, responsive, keyboard: Playwright under `e2e/lab-04/`.
- Evidence after execution: `artifacts/lab-04/` with command, branch/SHA, environment, counts, and relevant output. Screenshots prove visual state; API and database tests prove authorization/persistence.

## 3. Planned test matrix

| Test ID | Type | AC / requirements | What it tests and assertion | Planned automated file | Final status |
| --- | --- | --- | --- | --- | --- |
| API-ACT-01 | API/integration | AC-01; FR-02/03, BR-01/03 | Create on accessible Ticket; persisted Ticket FK, server performer/time, Pending status, and response match; forged performer/time ignored or rejected per API contract. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-02 | API/integration | AC-01, AC-21; FR-19, BR-25 | Same idempotency key and canonical request replay returns the same `201` response and Action identity with one row; changed payload under reused key conflicts safely. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-03 | API/integration | AC-02; BR-05 | `followUpRequired=true` with absent/blank note fails without a row; valid note and Attachment Notes persist as text. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-04 | API/integration | AC-03; FR-05, BR-03 | Active IT Staff/Admin assignee other than owner succeeds; inactive, Requester, and nonexistent assignees fail without mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-05 | API/integration | AC-04; FR-01/07, BR-01/07 | Zero/one/many Actions list in `(createdAt,id)` order; no cross-Ticket item is returned. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-06 | API/integration | AC-05; FR-04, BR-06 | Authorized edit changes current Action; immutable revision records actor/time/before/after; later edit cannot mutate prior revision. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-07 | API/integration | AC-06; BR-04/05 | Pending→Completed with Result and Pending→Cancelled succeed; missing Result, invalid jump, or edit of terminal status fails without mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-08 | API/integration | AC-25; BR-14/27 | Creating Pending Action on Resolved/Closed/Cancelled Ticket fails without a row; after permitted Reopened transition it succeeds. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| SEC-ACT-01 | Security/API | AC-07; FR-06, BR-09/11 | Owned Requester sees current Actions and performer/assignee display names read-only, but no user IDs, role, controls, Internal Notes, or audit metadata; cross-owner read returns ownership-safe not-found. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| SEC-ACT-02 | Security/API | AC-08; BR-08/10/26 | Unauthenticated and wrong-role writes/dashboard reads fail server-side; direct API bypass cannot use hidden UI controls. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| CONC-ACT-01 | Integration | AC-09; FR-19, BR-24 | Two edits on the same version: only one commits; stale edit conflicts and first value remains. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| DB-MIG-01 | Migration | AC-10, AC-19, AC-24; BR-22 | Populate Lab 3 baseline, migrate, compare User/Ticket/Attachment/Comment/Note IDs and values; zero-action Tickets valid; legacy Resolved `resolvedAt` remains null. | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| DB-MIG-02 | Migration/recovery | AC-19; BR-22 | Inject migration failure, verify no partial Action schema/data corruption, follow documented recovery, then reach valid state. | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| DB-SEED-01 | Integration | AC-19; BR-23 | Two seed runs have no duplicate owned seed rows; fixtures cover assigned/unassigned, varied status/priority, zero/one/many Actions, zero/nonzero metrics. | `server/tests/lab-04/seed.integration.test.ts` | Planned |
| API-WF-01 | API/integration | AC-11; FR-09, BR-14 | Direct status API rejects In Progress→Resolved with any Pending Action; succeeds after all Pending Actions are Completed/Cancelled; other data unchanged on rejection. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-02 | API/integration | AC-10, AC-12; BR-12/13/14/28 | Every listed Ticket transition, including Reopened→In Progress, succeeds under required role/ownership and appends immutable TicketStatusChange history; zero-action resolution succeeds; every unlisted transition and unowned status change conflicts without mutation. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-03 | API/regression | AC-13; FR-10, BR-15 | Requester advisory flag changes only `appearsResolved`; `currentStatus` remains unchanged. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-04 | API/integration | AC-12, AC-21; BR-26/29 | Lab 3 status PATCH accepts legacy body without expectedVersion; supplied current version succeeds; stale version conflicts without status/history mutation. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| UNIT-WF-01 | Unit | AC-11/12; FR-08/09, BR-12/14 | Pure workflow policy accepts every listed transition, rejects every unlisted pair, and blocks resolution only when a Pending Action exists. | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned |
| CONC-WF-01 | Integration | AC-23; FR-09/19, BR-14/24 | Race a Pending Action creation against Ticket resolution; no committed state has `RESOLVED` with a Pending Action. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-DASH-01 | API/integration | AC-15, AC-24; FR-12/15, BR-17–20 | Requester count and recent lists use own Ticket rows, five open statuses, UTC rolling cutoff, current Resolved plus known `resolvedAt`; boundary timestamps and legacy null tested. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-DASH-02 | API/integration | AC-16, AC-18; FR-13–15, BR-19–21 | Staff/Admin metrics match DB fixtures for unassigned, mine, status, priority, Pending assigned Actions, recently performed Actions, recent Tickets, urgent; identity comes from session; drill-down predicates match their cards. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-DASH-03 | API/integration | AC-17; FR-15, BR-20 | Empty fixtures return numeric zeros, bounded empty lists, and exact drill-down filter data; no full Ticket collection in payload. | `server/tests/lab-04/requester-dashboard.api.test.ts`, `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| UI-ACT-01 | UI component | AC-04–07, AC-21; FR-01/04/06/18 | Staff list/create/view/edit and Requester read-only area; required field errors, recoverable data retention, conflict refresh; Requester sees performer/assignee names but no controls, user IDs, or private content. | `client/src/lab-04-tests/ActionsTaken.test.tsx` | Planned |
| UI-WF-01 | UI component | AC-14, AC-21; FR-11/18 | Permitted controls, confirmation for Resolved/Closed/Cancelled, cancel aborts, success refreshes Ticket summary, conflict shows safe feedback. | `client/src/lab-04-tests/TicketWorkflow.test.tsx` | Planned |
| UI-WF-02 | UI component | AC-14, AC-21; FR-11/18/19 | Lab 4 UI always sends current expectedVersion; stale conflict retains recoverable values and requires refresh before retry. | `client/src/lab-04-tests/TicketWorkflow.test.tsx` | Planned |
| UI-DASH-01 | UI component | AC-15–18, AC-21; FR-12–15/18 | Requester and Staff/Admin cards show exact metric schemas, seven-day boundaries, zero/empty/loading/forbidden/failure states, and drill-down filters matching returned predicates. | `client/src/lab-04-tests/RequesterDashboard.test.tsx`, `client/src/lab-04-tests/StaffDashboard.test.tsx` | Planned |
| UI-STYLE-01 | UI style | AC-20; FR-17 | New screens use Zen Green tokens and non-color cues; no ad-hoc status colors or inaccessible icon-only controls. | `client/src/lab-04-tests/StaffDashboard.test.tsx`, `client/src/lab-04-tests/RequesterDashboard.test.tsx` | Planned |
| VISUAL-01 | Responsive | AC-20; FR-17 | Desktop/tablet/mobile snapshots of dashboards and Actions area have no clipping, overlap, or unwanted horizontal overflow. | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-20; FR-17 | Keyboard reaches cards, links, forms, status controls, dialogs; focus visible; labels and errors announced. | `e2e/lab-04/keyboard-access.spec.ts` | Planned |
| E2E-01 | E2E | AC-01–07, AC-11/14; FR-01–11 | Staff opens Ticket, creates/assigns/edits/completes Actions, attempts blocked resolution then resolves; Requester sees names and read-only Actions. | `e2e/lab-04/actions-taken-flow.spec.ts`, `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-02 | E2E | AC-15–18; FR-12–15 | Requester/staff/Admin dashboards show role-specific data and navigate to matching Ticket/Queue views. | `e2e/lab-04/dashboards.spec.ts` | Planned |
| REG-01 | Regression | AC-22; FR-16 | Run the documented Lab 1 health/categories server and client checks, all approved Lab 2 and Lab 3 server/client suites, and Lab 2/Lab 3 E2E suites against integrated Lab 4; inspect regressions rather than changing prior contracts. Lab 1 has no separate E2E suite. | Lab 1: `server/tests/categories.test.ts`, `server/tests/categories.service.test.ts`, `server/tests/categories.integration.test.ts`, `client/src/App.test.tsx`; Lab 2: `server/tests/lab-02/`, `client/src/lab-02-tests/`, `e2e/lab-02/`; Lab 3: `server/tests/lab-03/`, `client/src/lab-03-tests/`, `e2e/lab-03/` | Planned |
| PERF-01 | Performance smoke | AC-16/17; FR-15 | Representative seeded data: dashboard endpoints return bounded payloads and finish under a recorded local smoke threshold defined before execution; query plan avoids full-table per-card scans where indexes apply. | `server/tests/lab-04/dashboard.performance.test.ts` | Planned |

## 4. Acceptance criterion coverage

| AC | Planned test IDs |
| --- | --- |
| AC-01 | API-ACT-01, API-ACT-02, E2E-01 |
| AC-02 | API-ACT-03 |
| AC-03 | API-ACT-04 |
| AC-04 | API-ACT-05, UI-ACT-01 |
| AC-05 | API-ACT-06, UI-ACT-01 |
| AC-06 | API-ACT-07, UI-ACT-01 |
| AC-07 | SEC-ACT-01, UI-ACT-01, E2E-01 |
| AC-08 | SEC-ACT-02 |
| AC-09 | CONC-ACT-01 |
| AC-10 | DB-MIG-01, API-WF-02 |
| AC-11 | API-WF-01, E2E-01 |
| AC-12 | API-WF-02, API-WF-04, UNIT-WF-01 |
| AC-13 | API-WF-03 |
| AC-14 | UI-WF-01, UI-WF-02, E2E-01 |
| AC-15 | API-DASH-01, UI-DASH-01, E2E-02 |
| AC-16 | API-DASH-02, E2E-02, PERF-01 |
| AC-17 | API-DASH-03, UI-DASH-01, PERF-01 |
| AC-18 | API-DASH-02, E2E-02 |
| AC-19 | DB-MIG-01, DB-MIG-02, DB-SEED-01 |
| AC-20 | UI-STYLE-01, VISUAL-01, A11Y-01 |
| AC-21 | API-ACT-02, UI-ACT-01, UI-WF-01, UI-WF-02, UI-DASH-01 |
| AC-22 | REG-01 |
| AC-23 | CONC-WF-01 |
| AC-24 | DB-MIG-01, API-DASH-01 |
| AC-25 | API-ACT-08 |

## 5. Execution and status rules

Statuses are `Planned`, `Implemented`, `Passed`, `Failed`, `Blocked`, `Environment Failure`, or `Not Applicable`. A row moves to `Implemented` only when its test exists and runs; it moves to `Passed` only after its full assertion set passes on the intended branch. A partial test is not Passed. Database-dependent tests record database setup and migration version. For every run, log command, branch/SHA, passed/failed/skipped counts, and evidence path here, newest first. No results are logged yet.

## 6. Issue ownership

- Lab 4 #1 owns this test contract and its alignment with the final API/UI contracts.
- Lab 4 #2 owns `API-ACT-*`, `SEC-ACT-*`, `CONC-ACT-01`, `DB-MIG-*`, and `DB-SEED-01`.
- Lab 4 #3 owns `UI-ACT-01` and the Actions portion of `E2E-01`.
- Lab 4 #4 owns `API-WF-*`, `CONC-WF-01`, `UI-WF-01`, and the workflow portion of `E2E-01`.
- Lab 4 #5 owns `API-DASH-*`, `UI-DASH-01`, `PERF-01`, and `E2E-02`.
- Lab 4 #6 owns `UI-STYLE-01`, `VISUAL-01`, `A11Y-01`, `REG-01`, integrated E2E execution, and final evidence/status reconciliation.
