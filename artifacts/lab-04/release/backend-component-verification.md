# Issue #55 backend and component verification

Date: 2026-10-07–08, Asia/Bangkok. Base `ed91b191ed44c3cb71de1ae61484f91e32b98e28`; branch `feature/lab4-integration-release`. These are staging-working-diff results, not main-release results. Environment and lock hashes are in `environment.md`; actual executable bytes are in `executable-fingerprints.json`.

## Completed gates

| Gate | Command and cwd | Actual result / evidence |
| --- | --- | --- |
| Backend build | `npm run build`, `server/` | Exit 0, TypeScript compiled; fresh standalone `server-build.log` and precise start/end/exit in `server-build-manifest.json`, 2026-10-08. |
| Frontend build | `npm run build`, `client/` | Exit 0 on final CSS and type-correct test source, TypeScript and Vite production bundle, 52 modules; latest Vite build 2.44 s; `client-build.log` and `client-build-manifest.json`. |
| Prisma validation | `npx prisma validate`, `server/`, isolated backend DB environment | Exit 0; `prisma-validate.log`. |
| Migration status | `npx prisma migrate status`, `server/`, isolated backend DB | Exit 0, eight migrations, schema up to date; `prisma-status.log`. |
| Full component regression | `npm test -- --no-file-parallelism --reporter=default --reporter=json --outputFile=../artifacts/lab-04/release/client-results.json`, `client/` | 23 files, 366 passed, 0 failed, 0 skipped; exit 0 on final CSS and matcher source. Start 2026-10-07 22:22:15 +07:00, duration 180.36 s; `client-test.log`, `client-results.json`. |
| Full backend regression | `npm test -- --reporter=default --reporter=json --outputFile=../artifacts/lab-04/release/server-final-results.json`, `server/`, pristine seeded `fresh` DB | 47 files, 681 passed, 0 failed, 0 skipped; exit 0. Start 2026-10-08 09:21:52 +07:00, duration 1,444.72 s. Final output is `server-final-test.log`, `server-final-results.json`, and `server-final-manifest.json`. |

## Retained failure and diagnostic evidence

The first full component command used the default parallel file workers. It finished with 362 passes and two failures: legacy CreateTicket summary typing exceeded the existing 5,000 ms timeout; the next short-description assertion encountered interleaved pending typing from that timed-out test. The output is retained in `client-first-test.log` and `client-first-results.json`.

The unchanged canonical `src/lab-02-tests/CreateTicket.test.tsx` then passed all 17 tests when run alone (`npx vitest run src/lab-02-tests/CreateTicket.test.tsx --reporter=default`): exit 0, 24.41 s, `client-create-repro.log`. The complete 364-case suite subsequently passed with sequential file execution; that pre-consequence version is preserved in `client-pre-consequences-results.json` and `client-pre-consequences-test.log`. No assertion, product validation, test timeout, or test contract was weakened. This evidence supports worker contention as the initial timeout trigger; it is recorded as an initial failed verification attempt followed by a complete passing run, rather than a clean first run or hidden retry.

The consequence test expansion parameterizes the existing canonical `TicketWorkflow.test.tsx` confirmation case for Resolved, Closed and Cancelled. Each asserts the target-specific existing consequence paragraph, Escape and Cancel without an API request, then Confirm with the current version. The focused workflow file passed 24/24, exit 0, duration 14.52 s (`client-workflow.log`). A subsequent build exposed an unsupported Testing Library `getByRole` `exact` option in that new test; it was corrected to an anchored name regex. The final build and full component suite include that correction.

The sole production change adds `overflow-wrap: anywhere` to the Actions success feedback after a real long-description screenshot exposed overflow. The affected Actions/shared-style slice passed 100/100 across three files (`client-css-slice.log`); the final build and 366/366 full component run also include the CSS change. The prior passing 366-case run before CSS is retained in `client-pre-css-results.json` and `client-pre-css-test.log` and is not represented as the final source result.

The first backend attempt used a migrated but initially unseeded isolated database. Canonical category/related-system fixture preconditions failed, leaving required cases unexecuted. That run was interrupted before a final JSON/exit summary; its partial output is preserved in `server-first-incomplete.log`, not certified as a completed run. On 2026-10-08, with no old Node runners active, the isolated backend DB was seeded successfully (`backend-seed.log`) after normal Prisma generation completed. The complete backend suite was then restarted with every required DB case enabled, but that previously used database retained fixture users allocated before initial seeding. The initial legacy contract expects Ada ID 1; its seed appeared after those users instead, and the My Tickets fixture selected the earliest active Requester from that contaminated baseline. The resulting diagnostic run is retained under `server-test.log` / `server-results.json`, not represented as the final passing run.

The completed diagnostic run collected 681 cases in 47 files: 679 passed, 2 failed, 0 skipped; exit 1, start 2026-10-08 09:00:37 +07:00, duration 1,500.00 s. Its exact failures were Ada ID 45 rather than 1, and ten matching underscore-search results rather than the fixture's expected fewer than five; the newly created underscore Ticket was present. The database's first active Requester ID was 1 while seeded Ada was 45. These are retained diagnostic results, not a passing release claim.

A new isolated database was created empty, migrated and seeded before any test fixture (`fresh-db-migrate.log`, `fresh-db-seed.log`). Preflight verified Ada ID 1, four active categories and six active related systems. The original failed ID-preservation and literal-underscore contracts passed unchanged against that baseline: `fresh-fixture-repro.log` records 51 selected passes and 30 intentionally unselected cases, not a full regression pass. The requester search SQL uses literal `POSITION(LOWER(term) IN LOWER(column))`, so no wildcard escaping or product behavior was changed. Final complete verification finished on that verified pristine baseline: all 681 cases in 47 files passed, with zero failed/skipped cases and exit 0.

Earlier sandbox-only install/build attempts also failed on denied network, sockets or file operations. Authorized execution resolved those environment restrictions. These attempts do not count as passing tests.

## Scope and limits

The full component discovery includes Lab 1 application, Lab 2 and Lab 3 authenticated regression, and Lab 4 Actions, workflow/history/shared version, role navigation, and dashboard suites. Browser integration, visual inspection, five README procedures, actual human review, final main execution, board state and PDF submission are distinct evidence gates; this report alone cannot certify them.

## Final performance gate

The final backend run produced 20 measured samples per role after five warmups on the planned 1,000 Ticket / 3,000 Action fixture. Requester p95 was 26.7344 ms with 5,529 bytes; staff p95 was 43.4827 ms with 18,607 bytes. Both satisfy the existing 1,000 ms / 65,536 byte gates. Exact samples and fixture metadata are preserved in staging/performance-requester.json and staging/performance-staff.json; historical issue-54 generated artifacts were restored after copying current results.
