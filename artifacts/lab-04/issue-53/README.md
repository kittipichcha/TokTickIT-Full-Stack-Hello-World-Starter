# Issue #53 verification evidence

Date: 2026-10-06 (Asia/Bangkok).

Baseline: `371782a` (merged Issue #52). Backend implementation HEAD:
`1de162f1b5228bff8cbcb406121cd6f4ab0185df`. Client implementation commit:
`5bf2538`; final implementation snapshot: `10f4fdd65ef33f840476d6d1f514af005491c4e0`
(integrated resolution tests and regression fixture cleanup). The results below
were collected during implementation before committing; the final browser run and
client build include the dialog correction and enhanced same-Ticket sequence.
The documentation commit that follows this snapshot changes no executable source.

Scope: FR-08–11/18–20; BR-12–16/24/26–31; AC-10–14/21/23/25–27.
Dashboards and final Lab 4 release hardening remain outside Issue #53.

## Commands and results

Run from the worktree unless a subdirectory is specified. Windows commands use
`npm.cmd`/`npx.cmd` because the PowerShell execution policy blocks their script shims.

| Command | Result | Contract |
| --- | --- | --- |
| `cd client; npx.cmd vitest run src/lab-04-tests/TicketWorkflow.test.tsx src/lab-03-tests/StaffTicketDetail.test.tsx` | 2 files, 65 passed, 0 failed/skipped | UI-WF-01/02/HISTORY-01; prior Lab 3 detail regression |
| `cd client; npm.cmd test` | 20 files, 322 passed, 0 failed/skipped | Complete client regression |
| `cd server; npm.cmd test` with disposable database environment below | 650 tests passed; 43 files passed, 1 suite failed in cleanup; 0 assertion failures/skips | Full backend assertions, including migration suites; not a fully green command |
| `cd server; npx.cmd vitest run tests/lab-03/authorization.api.test.ts` with disposable database environment below | 1 file, 52 passed, 0 failed/skipped | Targeted recovery of failed authorization fixture cleanup |
| `cd server; npx.cmd vitest run tests/lab-04/ticket-workflow.unit.test.ts tests/lab-04/ticket-workflow.api.test.ts tests/lab-04/actions-taken.api.test.ts tests/lab-03/staff-ticket-detail.api.test.ts` with disposable database environment below | 4 files, 82 passed, 0 failed/skipped | All backend workflow rows; API-ACT-08 real reopened integration; Lab 3 detail regression |
| `cd server; npm.cmd run build` | Passed | Server TypeScript build |
| `cd client; npm.cmd run build` | Passed | Client TypeScript and Vite build |
| `npx.cmd playwright test e2e/lab-04/ticket-resolution.spec.ts --list` | 3 tests discovered, no browser execution | Canonical E2E path available across desktop/tablet/mobile |
| `npx.cmd playwright test e2e/lab-04/actions-taken-flow.spec.ts e2e/lab-04/ticket-resolution.spec.ts --project=desktop --project=tablet --project=mobile --workers=1` | Final enhanced run: 12 passed, 0 failed/skipped in 1.3 minutes | Complete E2E-01 including same-Ticket inactive-assignee rejection across all three projects |
| `npm.cmd run test:e2e` | 237 checks selected; deliberately stopped after 24 passed; no complete-suite result | Partial broad browser evidence only; final REG-01 release verification deferred |

The initial sandboxed focused UI command failed before executing assertions with
Windows `EPERM` on filesystem resolution. Its approved unrestricted rerun passed.

The full backend command took 1,132.67 seconds. Every assertion passed, but the
authorization suite's `afterAll` attempted to delete a Ticket before its newly
created status-history rows. Both owned/control Ticket fixture cleanup paths now
delete history first; the entire 52-test suite then passed. The unchanged migration
suites were not repeated, so this is a full-run result plus targeted recovery,
rather than a new fully green full-backend command.

The initial integrated Actions/resolution browser command returned 9 passed and
3 failed because Bootstrap disabled pointer events on the confirmation dialog,
letting its backdrop intercept the real Confirm click. The dialog now explicitly
sets `pointer-events: auto`; browser recovery retains real pointer interaction.
The recovery passed all 12 tests. The resolution spec was subsequently strengthened
to exercise inactive-assignee rejection on the same two-Action Ticket, as the frozen
E2E-01 row requires. The final enhanced source then passed all 12 integrated checks
in 1.3 minutes; E2E-01 is Passed. The client build was repeated successfully after
the CSS fix. Generated historical browser screenshots were restored to HEAD bytes.

The broad configured browser run was intentionally stopped after 24 passes to
prioritize the current implementation request and focused integrated contract.
No full browser-regression success is claimed. `REG-01`, `VISUAL-01`, `A11Y-01`,
`HARDEN-01`, dashboard rows and final release work remain Planned for their owners.

Disposable database setup used a Node wrapper loading `server/.env` with dotenv's
quiet option, validating `E2E_DATABASE_URL` host/path, assigning it to
`DATABASE_URL`, and spawning the listed unchanged Vitest command. No credentials
or unrelated `DATABASE_URL` value were printed or used.

Database tests must use the configured disposable database. Browser execution uses
`E2E_DATABASE_URL`, verified as a loopback PostgreSQL `lab3e2e` database without
printing credentials. No environment files or raw secret-bearing logs belong here.

## Required invariant evidence

`ticket-workflow.api.test.ts` owns resolve versus create/complete/cancel races and
asserts no committed `RESOLVED` Ticket has a Pending Action. Its failed/stale status
requests also assert unchanged Ticket snapshots and no extra status-history rows.
These assertions, rather than screenshots, prove concurrency and audit invariants.

No new schema migration is introduced. Existing Issue #51 migration is reused.
`reviewer.md` is unchanged because this session supplies no human peer feedback.
