# Lab 4 Test DD — Contract Draft, Planned Only

> This is a pre-implementation test contract. All Lab 4 rows are **Planned**. No Lab 4 code, test, migration, or end-to-end flow has been executed by this documentation task. `Passed` requires executable evidence after the owning issue is implemented.

## 1. Purpose and source

Test the Lab 4 behavior in `docs/lab-04/specification.md` against the supplied `SE+Lab+4.pdf`, while preserving the approved Lab 2 and Lab 3 contracts. The detailed API and UI contracts in this directory govern implementation. Keep AC IDs stable unless a requirement changes through review.

## 2. Tooling and planned paths

- Backend unit/API/integration: Vitest and Supertest under `server/tests/lab-04/`; real PostgreSQL/Prisma for migration, persistence, and concurrency tests.
- Frontend component/style: Vitest and React Testing Library under `client/src/lab-04-tests/`.
- End-to-end, responsive, keyboard: Playwright under `e2e/lab-04/`.
- Evidence after execution: `artifacts/lab-04/` with command, branch/SHA, environment, counts, and relevant output. Screenshots prove visual state; API and database tests prove authorization/persistence.
- Migration runs only after Lab 3 Phase A, verified identity/attachment/priority backfill, and Phase C completion. Preserve and execute the existing Lab 1/Lab 2/Lab 3 test suites and E2E flows on the integrated Lab 4 branch. Adapt an existing assertion only for an explicitly changed Lab 4 expectation; record old/new assertion and rationale. Then execute Lab 4 migration, API, UI, accessibility, responsive, and E2E suites. Keep every new or adapted row `Planned` until its complete executable assertion set passes.

## 3. Planned test matrix

| Test ID | Type | AC / requirements | What it tests and assertion | Planned automated file | Final status |
| --- | --- | --- | --- | --- | --- |
| API-ACT-01 | API/integration | AC-01; FR-02/03, BR-01/03 | Create on accessible Ticket; persisted Ticket FK, server-derived performer/time, Pending status, and response match; forged performer/time fields are ignored and persisted values remain server-derived. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-02 | API/integration | AC-01, AC-21; FR-19, BR-25 | With a frozen clock, same actor/route/key and canonical request replay before expiry returns identical `201` response and Action identity with one row; changed payload conflicts; expiry is exactly 24 hours; at exact expiry, reuse creates a fresh Action with a new ID, fresh `201`, and new 24-hour retention while retaining the old Action, without cleanup; concurrent identical reuse creates one fresh Action and subsequent replay returns it; a failed expired-key operation creates neither a replacement record nor Action. Hourly cleanup deletes at most 500 expired rows ordered by `(expiresAt,id)`, leaves unexpired rows, and reports count/result. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-03 | API/integration | AC-02; BR-05 | `followUpRequired=true` with absent/blank note fails without a row; valid note and Attachment Notes persist as text. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-04 | API/integration | AC-03; FR-05, BR-03 | Active IT Staff/Admin assignee other than owner succeeds; inactive, Requester, and nonexistent assignees fail without mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-05 | API/integration | AC-04; FR-01/07, BR-01/07 | Zero/one/many Actions list in `(createdAt,id)` order; no cross-Ticket item is returned. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-06 | API/integration | AC-05; FR-04, BR-06 | Authorized edit changes current Action; immutable revision records actor/time/before/after; later edit cannot mutate prior revision. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-07 | API/integration | AC-06; BR-04/05 | Pending→Completed with Result and Pending→Cancelled succeed; missing Result, invalid jump, or edit of terminal status fails without mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-08 | API/integration | AC-25; BR-14/27 | Creating Pending Action on Resolved/Closed/Cancelled Ticket fails without a row; after permitted Reopened transition it succeeds. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-ACT-DETAIL-01 | API/integration | AC-04, AC-07; FR-01/06, BR-09/11 | Read one Action by Ticket and Action ID; reject mismatched/missing Action with 404; Requester receives only restricted current projection on owned Ticket. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| SEC-ACT-01 | Security/API | AC-07; FR-06, BR-09/11 | Owned Requester sees current Actions and performer/assignee display names read-only, but no user IDs, role, controls, Internal Notes, or audit metadata; cross-owner read returns ownership-safe not-found. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| SEC-ACT-02 | Security/API | AC-08; BR-08/10/26 | Unauthenticated and wrong-role writes/dashboard reads fail server-side; direct API bypass cannot use hidden UI controls. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| CONC-ACT-01 | Integration | AC-09; FR-19, BR-24 | Two edits on the same version: only one commits; stale edit conflicts and first value remains. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| DB-MIG-01 | Migration | AC-10, AC-19, AC-24; BR-22 | Populate Lab 3 baseline, migrate, compare User/Ticket/Attachment/Comment/Note IDs and values; zero-action Tickets valid; legacy Resolved `resolvedAt` remains null; verify exact Lab 4 non-Ticket indexes and idempotency unique constraint exist and no new Ticket index was added. | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| DB-MIG-02 | Migration/recovery | AC-19; BR-22/32 | Inject migration/validation failure before any Lab 4 write; verify writers remain stopped, restore the verified PostgreSQL and paired attachment snapshots together, and compare required IDs, counts, hashes, references, and migration state to the pre-cutover baseline. | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| DB-MIG-03 | Migration/recovery | AC-19; BR-22/32 | Verify Lab 3 Phase A/backfill/Phase C prerequisite; rehearse full custom PostgreSQL snapshot restore into a separate empty DB and verify attachment snapshot hashes; apply additive migration and validate preserved data before writes; after a simulated accepted Lab 4 write, prove recovery preserves current state and uses an approved forward fix without restoring the old snapshot. | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| DB-MIG-04 | Migration fixture isolation | AC-19; BR-22/32 | In the existing Lab 3 migration integration test, create a per-run `mkdtemp` fixture with byte-identical copies of `schema.prisma`, `migration_lock.toml`, and all seven named Lab 3 migrations; verify every copied file's SHA-256 before any Prisma command. Accept the historical-schema override only when `NODE_ENV` is exactly `test`, `MIGRATION_TEST_SCHEMA_PATH` is the absolute verified schema inside this fixture root, and an explicitly configured disposable test database URL is safe; reject other environments, missing/outside-root override, missing/production-like URL, or any Prisma invocation without explicit `--schema "$MIGRATION_TEST_SCHEMA_PATH"` before Prisma starts. Verify these negative cases issue no Prisma command. Keep every existing real Lab 3 assertion enabled and unchanged; disconnect Prisma and remove the temporary root in `finally`. Then unset `MIGRATION_TEST_SCHEMA_PATH` and exercise the normal path with installed server-local `server/node_modules/.bin/prisma`: `server/node_modules/.bin/prisma migrate status --schema server/prisma/schema.prisma` must report the expected Lab 4 migration pending and no failed migration; `server/node_modules/.bin/prisma migrate deploy --schema server/prisma/schema.prisma` applies full normal history; repeat the exact status command and require up to date. Use only the disposable test database for both paths. | `server/tests/lab-03/migration.integration.test.ts` | Planned |
| DB-SEED-01 | Integration | AC-19; BR-23 | Two seed runs have no duplicate owned seed rows; fixtures cover assigned/unassigned, varied status/priority, zero/one/many Actions, zero/nonzero metrics. | `server/tests/lab-04/seed.integration.test.ts` | Planned |
| API-WF-01 | API/integration | AC-11; FR-09, BR-14 | Direct status API rejects In Progress→Resolved with any Pending Action; succeeds after all Pending Actions are Completed/Cancelled; other data unchanged on rejection. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-02 | API/integration | AC-10, AC-12; BR-12/13/14/28 | Every listed Ticket transition, including Reopened→In Progress, succeeds for an authorized Staff/Admin actor when the Ticket has a non-null primary owner; the actor need not be that owner; each appends immutable TicketStatusChange history. Zero-action resolution succeeds; every unlisted transition and status change on a Ticket with null owner conflicts without mutation. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-03 | API/regression | AC-13; FR-10, BR-15 | Requester advisory flag changes only `appearsResolved`; `currentStatus` remains unchanged. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-04 | API/integration | AC-12, AC-21, AC-27; BR-13/26/29/30 | Owner, priority, and status mutations accept legacy requests without expectedVersion; current supplied version succeeds; malformed version returns 400; stale version conflicts without mutation. Accepted owner/priority writes, including same-value writes, increment shared version exactly once. Same-status requests for every status return 409 and preserve a complete Ticket snapshot including version, `currentStatus`, `updatedAt`, and `resolvedAt`, with no history row; a valid status transition increments once and appends exactly one history row. Any authorized Staff/Admin can change status on a Ticket with non-null primary owner, whether or not they are that owner; null owner blocks status mutation. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| UNIT-WF-01 | Unit | AC-11/12; FR-08/09, BR-12/14 | Pure workflow policy accepts every listed transition, rejects every unlisted pair, and blocks resolution only when a Pending Action exists. | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned |
| CONC-WF-01 | Integration | AC-23; FR-09/19, BR-14/24 | Race a Pending Action creation against Ticket resolution; no committed state has `RESOLVED` with a Pending Action. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| CONC-WF-02 | Integration | AC-27; FR-19, BR-30 | Race owner, priority, and status mutations using the same current Ticket version; only one write succeeds, stale writes conflict, and no version increment or field update is lost. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-WF-HISTORY-01 | API/integration | AC-26; FR-20, BR-08/31 | Staff/Admin history is page-size bounded and stable `(changedAt,id)` ascending; requester gets 403, unauthenticated gets 401, absent Ticket gets 404, invalid paging gets 400; history route and data are unavailable to Requesters; success appends one row and failures append none. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-DASH-01 | API/integration | AC-15, AC-24; FR-12/15, BR-17–20 | Requester count and recent lists use own Ticket rows, five open statuses, UTC rolling cutoff, current Resolved plus known `resolvedAt`; boundary timestamps and legacy null tested. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-DASH-02 | API/integration | AC-16, AC-18; FR-13–15, BR-19–21 | Staff/Admin metrics match DB fixtures for unassigned, mine, all eight status keys and three priority keys, Pending assigned Actions, recently performed Actions, recent Tickets, urgent; every status/priority key maps to the exact same-value Queue filter; Action metric drillDowns have filters but no path/actionId; each bounded Action row has its own Ticket Detail path, anchor, and Action ID; identity comes from session. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-DASH-03 | API/integration | AC-17; FR-15, BR-20 | Empty fixtures return numeric zeros, bounded empty lists, and exact drill-down filter data; no full Ticket collection in payload. | `server/tests/lab-04/requester-dashboard.api.test.ts`, `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| UI-ACT-01 | UI component | AC-03–07, AC-21; FR-01/03/04/06/18 | Staff/Admin list/create/view/edit and Requester read-only area; on one Ticket, completing one Action requires Result while cancelling a different Action does not. For both Staff/Admin and Requester, 21 ordered Actions appear across three fixed-size-10 pages; no page-size selector appears, Previous/Next are disabled at first/last boundaries, `Page X of Y` appears for nonempty pages, controls are hidden at zero/one page, and every page is reachable. Create/edit refreshes the current valid page and returns to page 1 when that page becomes invalid. Inactive current assignee remains visible with warning until explicit eligible reassignment or unassignment; submitting an ineligible assignee shows HTTP 409, persists no mutation, and retains submitted inputs; required-field errors and conflict refresh work; Requester sees performer/assignee names but no controls, user IDs, or private content. | `client/src/lab-04-tests/ActionsTaken.test.tsx` | Planned |
| UI-WF-01 | UI component | AC-14, AC-21; FR-11/18 | Permitted controls, confirmation for Resolved/Closed/Cancelled, cancel aborts, success refreshes Ticket summary, conflict shows safe feedback. | `client/src/lab-04-tests/TicketWorkflow.test.tsx` | Planned |
| UI-WF-02 | UI component | AC-14, AC-21, AC-27; FR-11/18/19 | Lab 4 UI sends current expectedVersion for owner, priority, and status mutations; stale conflict retains recoverable values and requires refresh before retry. | `client/src/lab-04-tests/TicketWorkflow.test.tsx` | Planned |
| UI-WF-HISTORY-01 | UI component | AC-26; FR-20 | Staff/Admin Ticket Detail displays paginated formal status history chronologically; Requesters have no history control, route access, or history data; forbidden and unauthenticated states are distinct. | `client/src/lab-04-tests/TicketWorkflow.test.tsx` | Planned |
| UI-DASH-01 | UI component | AC-15–18, AC-20/21; FR-12–15/17/18 | Requester sees Dashboard/My Tickets/Create Ticket in order; IT Staff sees Dashboard/Ticket Queue; Admin sees Dashboard/Ticket Queue/User Management. Each Dashboard opens the role's dashboard. Active state follows the current destination and parent: Requester Ticket Detail activates My Tickets, Staff/Admin Ticket Detail activates Ticket Queue, and User Management descendants activate User Management. Requesters see no staff/admin links; mobile menu supports keyboard, expanded state, close-after-navigation, and active-route state. Dashboards show exact metric schemas, seven-day boundaries, zero/empty/loading/forbidden/failure states, matching drill-down filters; Action count cards are noninteractive while each Action summary row opens its exact Ticket Detail Action. | `client/src/lab-04-tests/RequesterDashboard.test.tsx`, `client/src/lab-04-tests/StaffDashboard.test.tsx`, `client/src/lab-04-tests/RoleNavigation.test.tsx` | Planned |
| UI-STYLE-01 | UI style | AC-20; FR-17 | New screens use Zen Green tokens and non-color cues; no ad-hoc status colors or inaccessible icon-only controls. | `client/src/lab-04-tests/StaffDashboard.test.tsx`, `client/src/lab-04-tests/RequesterDashboard.test.tsx` | Planned |
| VISUAL-01 | Responsive | AC-20; FR-17 | Desktop/tablet/mobile snapshots of dashboards and Actions area have no clipping, overlap, or unwanted horizontal overflow. | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-20; FR-17 | Keyboard reaches cards, links, forms, status controls, dialogs; focus visible; labels and errors announced. | `e2e/lab-04/keyboard-access.spec.ts` | Planned |
| E2E-01 | E2E | AC-01–07, AC-11/14; FR-01–11 | On the same Ticket, Staff creates two Pending Actions, A and B. While B is Pending, Staff submits an inactive assignee and asserts eligibility HTTP 409, no persisted mutation, and retained form input. Staff then attempts Ticket resolution and asserts it is blocked because Pending Actions remain. Staff completes A with a Result, cancels B without a Result, and resolves the Ticket after no Pending Actions remain. Requester sees performer and assignee names and read-only Actions. | `e2e/lab-04/actions-taken-flow.spec.ts`, `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-02 | E2E | AC-15–18; FR-12–15 | Requester/staff/Admin dashboards show role-specific data and navigate to matching Ticket/Queue views. | `e2e/lab-04/dashboards.spec.ts` | Planned |
| REG-01 | Regression | AC-22; FR-16 | Run the documented Lab 1 health/categories server and client checks, all approved Lab 2 and Lab 3 server/client suites, and Lab 2/Lab 3 E2E suites against integrated Lab 4; inspect regressions rather than changing prior contracts. Lab 1 has no separate E2E suite. | Lab 1: `server/tests/categories.test.ts`, `server/tests/categories.service.test.ts`, `server/tests/categories.integration.test.ts`, `client/src/App.test.tsx`; Lab 2: `server/tests/lab-02/`, `client/src/lab-02-tests/`, `e2e/lab-02/`; Lab 3: `server/tests/lab-03/`, `client/src/lab-03-tests/`, `e2e/lab-03/` | Planned |
| PERF-01 | Performance smoke | AC-16/17; FR-15 | Deterministic local fixture of 1,000 Tickets and 3,000 Actions; run each Requester and Staff dashboard endpoint after 5 warmups and 20 serial samples. For each role, nearest-rank p95 latency is under 1,000 ms and response is at most 65,536 bytes. Record runtime, DB, hardware, and fixture environment. | `server/tests/lab-04/dashboard.performance.test.ts` | Planned |
| HARDEN-01 | Release hardening | AC-20/22; FR-16/17 | In a clean checkout, rehearse all five README procedures—setup, seed, migration, tests, and demonstration—and verify each documented path and command resolves. Inspect browser console on each role's Dashboard, Queue, and Ticket Detail; traverse every primary navigation path; confirm no broken link/navigation, dead control, obsolete Lab 3 control, unfinished placeholder, or client runtime error. Record checkout SHA, commands, routes, browser/runtime, and findings. | `e2e/lab-04/release-hardening.spec.ts` | Planned |

## 4. Acceptance criterion coverage

| AC | Planned test IDs |
| --- | --- |
| AC-01 | API-ACT-01, API-ACT-02, E2E-01 |
| AC-02 | API-ACT-03 |
| AC-03 | API-ACT-04 |
| AC-04 | API-ACT-05, API-ACT-DETAIL-01, UI-ACT-01 |
| AC-05 | API-ACT-06, UI-ACT-01 |
| AC-06 | API-ACT-07, UI-ACT-01 |
| AC-07 | API-ACT-DETAIL-01, SEC-ACT-01, UI-ACT-01, E2E-01 |
| AC-08 | SEC-ACT-02 |
| AC-09 | CONC-ACT-01 |
| AC-10 | DB-MIG-01, API-WF-02 |
| AC-11 | API-WF-01, UNIT-WF-01, E2E-01 |
| AC-12 | API-WF-02, API-WF-04, UNIT-WF-01 |
| AC-13 | API-WF-03 |
| AC-14 | UI-WF-01, UI-WF-02, E2E-01 |
| AC-15 | API-DASH-01, UI-DASH-01, E2E-02 |
| AC-16 | API-DASH-02, E2E-02, PERF-01 |
| AC-17 | API-DASH-03, UI-DASH-01, PERF-01 |
| AC-18 | API-DASH-02, E2E-02 |
| AC-19 | DB-MIG-01, DB-MIG-02, DB-MIG-03, DB-MIG-04, DB-SEED-01 |
| AC-20 | UI-DASH-01, UI-STYLE-01, VISUAL-01, A11Y-01, HARDEN-01 |
| AC-21 | API-ACT-02, UI-ACT-01, UI-WF-01, UI-WF-02, UI-DASH-01 |
| AC-22 | REG-01, HARDEN-01 |
| AC-23 | CONC-WF-01 |
| AC-24 | DB-MIG-01, API-DASH-01 |
| AC-25 | API-ACT-08 |
| AC-26 | API-WF-HISTORY-01, UI-WF-HISTORY-01 |
| AC-27 | API-WF-04, CONC-WF-02, UI-WF-02 |

## 5. Execution and status rules

Statuses are `Planned`, `Implemented`, `Passed`, `Failed`, `Blocked`, `Environment Failure`, or `Not Applicable`. A row moves to `Implemented` only when its test exists and runs; it moves to `Passed` only after its full assertion set passes on the intended branch. A partial test is not Passed. Database-dependent tests record database setup and migration version. For every run, log command, branch/SHA, passed/failed/skipped counts, and evidence path here, newest first.

### Results Log (newest first)

- **2026-09-30 — Issue #50 PR #58 contract re-review refinement and local verification**
  - Scope: preserve the existing Lab 4 review-response edits and complete the specified status-write, expired-key, pagination, Lab routing, and unpublished PR-body wording clarifications. Documentation only; no runtime code or executable test changed.
  - Tests changed/run: refined planned `API-ACT-02`, `API-WF-04`, and `UI-ACT-01`; retained all 41 unique matrix rows as `Planned`. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: `& "$env:USERPROFILE\.local\bin\rtk.exe" --version; git rev-parse --abbrev-ref HEAD; git rev-parse HEAD` (exit 0; RTK 0.50.0, `feature/lab4-contract-spec-dd`, `c0bf709d10a9a0b0b796af49a0542cd5bc8e9e0c`); `& "$env:USERPROFILE\.local\bin\rtk.exe" proxy git diff --check` (exit 0); `git diff --name-only` plus PowerShell exact seven-path allowlist audit (exit 0); PowerShell matrix/AC/ownership audit (exit 0: 41 unique rows, all Planned, AC-01–AC-27 mapped, detail/unit rows mapped, #4/#6 ownership present); normalized-whitespace cross-document audit (exit 0: no false PR-publication/blocker-free claims, specified API/UI/test/review/AI wording consistent, reviewer routing in agent.md §12). Initial matrix-audit script attempts exited 1 on checker boundary/comparison assumptions; initial cross-document audit exited 1 because its regex assumed a line-wrapped Markdown clause stayed on one line. Corrected audits passed; these were checker mismatches, not application-test failures.
  - Follow-up: human re-review remains pending; proposed PR-body replacement is local and unpublished. No Lab 4 executable tests were run.

- **2026-09-30 — Issue #50 PR #58 human-review revision**
  - Scope: resolve human review #5361703082, record all three human reviews, and repair API/action and workflow test traceability. Documentation only; no runtime code or executable tests changed or ran.
  - Tests changed/run: updated planned `API-ACT-01`, `API-ACT-02`, `API-WF-04`, and `UI-ACT-01`; added `UNIT-WF-01` ownership and mapped `API-ACT-DETAIL-01` to AC-04/AC-07. All 41 unique Lab 4 matrix rows remain `Planned`; executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: RTK 0.50.0 confirmed installed; `rtk proxy git -c safe.directory=C:/Users/kitti/CPE334/issue-50-worktree diff --check` (exit 0); PowerShell matrix/trace audit (exit 0: 41 unique rows, all Planned, API-ACT-DETAIL-01 mapped to AC-04/AC-07, UNIT-WF-01 mapped to AC-11); targeted stale-wording and cross-document consistency checks (exit 0). Branch/SHA: `feature/lab4-contract-spec-dd` at `c0bf709`. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Follow-up: human re-review remains pending; no Lab 4 implementation or passing executable test is claimed.

- **2026-09-29 — Issue #50 PR #58 re-review contract revision**
  - Scope: resolve remaining role-navigation, exact dashboard mapping/destination, Action outcome/assignee, status-history access, persistence index/expiry, and release-hardening ambiguities. Documentation only; no runtime, schema, migration, or executable test changed or ran.
  - Tests changed/run: expanded planned `API-DASH-02`, `API-WF-02`, `API-WF-04`, `API-WF-HISTORY-01`, `UI-ACT-01`, `UI-DASH-01`, and `E2E-01` with the ordered inactive-assignee rejection, blocked-resolution, completion/cancellation, and successful-resolution assertions; added planned `HARDEN-01`. All 41 unique Lab 4 matrix rows remain `Planned`; executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: `git diff --check` (exit 0); JSON dashboard examples parse and exact eight-status/three-priority mapping audit (exit 0); persistence/index/cleanup, owner/history authorization, Action UI/E2E outcome and retained-input audit (exit 0); role-specific destination/active-parent and five README procedure audit (exit 0); 41-row uniqueness/status and all-27-AC mapping audits (exit 0); exact five-path allowlist audit (exit 0). Branch/SHA: `feature/lab4-contract-spec-dd` at `1505e8a`. Executable tests: **0 run, 0 passed, 0 failed, 0 skipped**; no browser, Prisma, migration, or database restore was run.
  - Follow-up: implement the planned API/UI/migration/hardening checks and record actual evidence before changing any row status.

- **2026-09-29 — Issue #50 migration fixture contract revision 3**
  - Scope: specify fail-closed fixture override validation and verify both historical-schema isolation and full normal Prisma migration paths. Documentation only; no runtime, database, migration, or executable test changed or ran.
  - Tests changed/run: extended planned `DB-MIG-04` with rejected unsafe override cases, explicit unsetting before normal migration history, pending-before-deploy and up-to-date-after-deploy status assertions. All 40 unique Lab 4 matrix rows remain `Planned`; executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: `git diff --check` (exit 0); PowerShell fixture contract audit (exit 0; both paths, fail-closed checks, exact CLI commands, and status expectations present); PowerShell row/status and AC-19 mapping audit (exit 0; 40 unique rows, all `Planned`, AC-19 maps DB-MIG-01/02/03/04 and DB-SEED-01). No Prisma command, migration, restore, or attachment operation was run.
  - Follow-up: implement DB-MIG-04 and run both fixture and normal migration paths against the disposable database before claiming AC-19.

- **2026-09-29 — Issue #50 migration fixture isolation contract revision 2**
  - Scope: specify isolated historical Prisma fixture setup and snapshot privacy. Documentation only; no database, attachment storage, runtime, migration, or executable test changed or ran.
  - Tests changed/run: added planned `DB-MIG-04`; mapped AC-19 to DB-MIG-01/02/03/04 and DB-SEED-01. All 40 unique Lab 4 matrix rows remain `Planned`; executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: `git diff --check` (exit 0); PowerShell migration fixture contract audit (exit 0; all required fixture paths, migration names, hashes, environment/schema isolation, assertion preservation, and snapshot privacy clauses present); PowerShell row/status and AC-19 mapping audit (exit 0; 40 unique rows, all `Planned`, AC-19 maps DB-MIG-01/02/03/04 and DB-SEED-01). No migration, restore, Prisma command, or attachment operation was run.
  - Follow-up: implement and execute the isolation fixture against the real Lab 3 migration test before claiming DB-MIG-04 or AC-19.

- **2026-09-29 — Issue #50 Lab 3-to-Lab 4 migration continuity contract**
  - Scope: freeze database cutover/recovery and specify prior-lab database, function, and test continuity. Documentation only; no database, attachment storage, runtime, migration, or executable test was changed or run.
  - Tests changed/run: added planned `DB-MIG-03`; mapped AC-19 to DB-MIG-01/02/03 and DB-SEED-01. All 39 unique Lab 4 matrix rows remain `Planned`; executable tests: **0 run, 0 passed, 0 failed, 0 skipped**.
  - Commands: `git diff --check` (exit 0); PowerShell contract audit (exit 0; 39 unique rows, all `Planned`; AC-19 maps DB-MIG-01/02/03 and DB-SEED-01; one recovery strategy; ActionCreateIdempotency reference present; no runtime paths changed).
  - Follow-up: implementation must execute the snapshot rehearsal and both pre-write restore and post-write forward-recovery tests before claiming AC-19.

- **2026-09-29 — Issue #50 PR #58 documentation revision**
  - Scope: update the Lab 4 contract from human review #5341087376 and route Lab 4 logs to Lab 4
    documents. No runtime or executable test files changed.
  - Tests changed/run: added planned API/UI history, Action detail, and shared-version concurrency
    rows; all 38 Lab 4 test rows remain `Planned`. Executable tests: **0 run, 0 passed, 0 failed,
    0 skipped**.
  - Commands: `git diff --check` (exit 0); PowerShell allowlist and test-status audit (exit 0;
    9 approved paths, 0 unexpected/missing paths, 38 rows Planned); PowerShell endpoint/identifier/
    AC/test-row audit (exit 0; required contracts present, no legacy short Ticket identifiers).
  - Branch/SHA: `feature/lab4-contract-spec-dd` at baseline `8aa7637f326a0c0c2d9750f51510f175411e8226`.
  - Follow-up: human re-review remains pending. No Lab 4 implementation or executable test result
    is claimed.

- **2026-09-27 — Issue #50 Lab 4 contract documentation audit**
  - Scope: document only the Lab 4 contract task; no Lab 3 requirements or test statuses changed.
  - Tests changed/run: no executable Lab 3 test code changed. Added planned Lab 4 matrix rows
    `API-WF-04` and `UI-WF-02`; no Lab 4 executable tests were run. Result: **0 run, 0 passed,
    0 failed, 0 skipped**.
  - Commands run: `git status --short --branch` confirmed the expected Issue #50 worktree and
    clean starting state; documentation consistency/search checks and `git diff --check` were
    run after the edits. No runtime or full test suite was run.
  - Follow-up: human review of the four Lab 4 contract files remains pending. This record does
    not claim Lab 4 implementation, integration, or test evidence.

## 6. Issue ownership

- Lab 4 #1 owns this test contract and its alignment with the final API/UI contracts.
- Lab 4 #2 owns `API-ACT-*`, `SEC-ACT-*`, `CONC-ACT-01`, `DB-MIG-*`, and `DB-SEED-01`.
- Lab 4 #3 owns `UI-ACT-01` and the Actions portion of `E2E-01`.
- Lab 4 #4 owns `API-WF-*`, `CONC-WF-*`, `UNIT-WF-01`, `UI-WF-*`, and the workflow portion of `E2E-01`.
- Lab 4 #5 owns `API-DASH-*`, `UI-DASH-01`, `PERF-01`, and `E2E-02`.
- Lab 4 #6 owns `UI-STYLE-01`, `VISUAL-01`, `A11Y-01`, `REG-01`, `HARDEN-01`, integrated E2E execution, and final evidence/status reconciliation.
