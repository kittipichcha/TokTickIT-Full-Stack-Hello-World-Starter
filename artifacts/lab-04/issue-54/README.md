# Issue #54 — Role dashboards evidence

Base: `6f8ffa0300362849a3f550573a4899a747046dc8` (`origin/lab4-staging`).
Working branch: `feature/lab4-role-dashboards`. Tested executable source commit: `2b2af97a57db3c566048e7487e48e093517e5309`; final source fingerprints accompany the completed runs. The user separately authorized commit, push and PR creation on 2026-10-07. No merge, issue/board action or human approval is inferred.

## Scope and traceability

Requester/staff dashboard reads, equivalent My Tickets/Queue extensions, role landing,
navigation, exact current Action selection and insert-only demonstration seed additions.
Maps FR-12–18; BR-08–11/17–23/26; AC-08/15–22/24. Existing Actions/workflow/history,
authentication/CSRF, attachments/comments/notes, administrator and migration/recovery
behavior are regression dependencies. No new schema, migration, Ticket index, dependency,
write endpoint, reporting or optional administrator metrics were added.

## Environment

Windows 10.0.26200; Node 24.14.0; npm 11.9.0; Prisma 5.22.0; PostgreSQL 18.1;
Playwright 1.62.1 / Chromium revision 1234; AMD Ryzen 7 5700U, 16 logical CPUs,
16,469,520,384 bytes RAM. All eight checked-in migrations were verified up to date.
Tests use freshly created loopback disposable databases. Dashboard API and performance
workers build the historical Lab 3 baseline, apply the existing additive Lab 4 migration,
and remove only synthetic bootstrap rows before importing the real session application.
They close real session pools and Prisma before dropping their own databases.
The copied application `.env` was preserved and is excluded from Git/evidence.

## Commands and results

Final backend/client results are recorded below; full browser passed. Logs contain commands'
decisive test output; no skipped database case is treated as Passed.

- `backend-focused.log`: canonical Requester/Staff API focused run, 26 passed, exit 0.
- `backend-seed.log`: insert-only seed/preservation cases, 3 passed, exit 0.
- `server-build.log`, `server-build-final.txt`: TypeScript build, exit 0.
- `frontend-focused.log`: dashboard/navigation/Actions/list slices, 127 passed, exit 0.
- `client-build.log`: production TypeScript/Vite build, exit 0.
- `server-full.txt`: complete backend, 681 passed in 47 files, zero failed/skipped, exit 0.
- `review-fix-server-final.txt`: latest four bounded Ticket-list ordering assertions, 12 passed, exit 0.
- `client-full-final.txt`: final complete client runner, 358 passed in 23 files, zero failed/skipped, exit 0; bounded two-worker concurrency.
- `client-build-final.txt`: final production TypeScript/Vite build, exit 0.
- `browser-dashboard-rerun.txt`: 45 passed across all three projects, zero failed/skipped, exit 0.
- `legacy-layout-final.txt`: 13 legacy layout checks passed after explicit navigation adaptation.
- `browser-full-final.txt`: complete configured 267-case regression passed, zero failed/skipped, exit 0 (28.7 minutes); `browser-full.txt` is an interrupted diagnostic, not successful regression evidence.
- `performance.txt` and `performance-{requester,staff}.json`: frozen real-database
  1,000 Tickets/3,000 Actions, exact plan distribution and fixed UTC clock; five warmups
  plus twenty serial samples per role. Nearest-rank p95 is sorted sample 19; each role
  must be below 1,000 ms and each measured UTF-8 body at most 65,536 bytes.
  Final full-server samples: requester p95 31.86 ms/max body 5,529 bytes; staff p95 56.15 ms/max body 18,607 bytes.

Browser projects: desktop 1280×800, tablet 820×1180, mobile 390×844. Dashboard screenshots
are under `../screenshots/{requester-dashboard,staff-dashboard,admin-dashboard}/`. Restored 82 historical generated
tracked screenshots byte-for-byte to the base; retained 33 new dashboard images.

## Review and correction ledger

- Independent Scrutinize correctness: no substantiated product blocker after tracing real
  role/session gates, DB predicates/DTOs, first filtered request, selected Action and retry.
- Independent Standards: readable extension-filter labels and accurate legacy/new Queue
  validation wording requested; README wording corrected and scoped UI fix assigned.
- Independent Spec: complete Queue destination identity/summary-order assertions and
  explicit browser session/identity-override assertions requested.
- Plan-to-Fix validated those evidence gaps and prepared one bounded packet; an act
  subagent implemented it; repeated review validated exact ordered Ticket identities and closed the remaining string-valued Urgent filter notice. Correctness, Standards and static Spec reviews have no remaining substantiated blocker.
- Unsupported review claims about fixture cleanup, duplicate-query validation and React
  remounts were checked against the actual helper/explicit plan/reconciliation and withdrawn.
  A deferred selected-detail/list focus regression verifies the latter without speculative
  production refactoring. No automated review is recorded as human peer review.

Initial failures: Windows sandbox EPERM before Vitest execution (authorized access rerun);
test-fixture session pool shutdown caused an unhandled error despite passing PERF assertions
(orderly pool shutdown fixed); initial browser selectors excluded collapsed mobile navigation
or assumed an exact Ticket heading without its status. Staff Action presentation extraction
initially lost the existing `li.action-card` class; it was restored and old browser flows rerun.
Initial failing logs are historical diagnostics, never passing evidence. Browser override probe origin and StrictMode loading/Retry test setup were corrected after reproduced harness failures. One legacy client typing test exceeded its existing 5-second timeout during concurrent full-suite load; bounded two-worker rerun retains the same assertions and timeout.

## Issue #55 handoff

Final clean-checkout/main-branch certification; complete release-hardening rehearsal and
submission package/PDF; final 6–10 prompt AI reflection curation; real human partner review;
separately authorized commit/push/PR/board/release actions remain with #55/user workflow.
Release coverage must include AC-26/27 as well as AC-01–25. Current complete regression is
a #54 contribution, not an assertion that #55 clean-checkout/main gates were performed.

Executable source/configuration inventory: `executable-sha256.json` (176 SHA-256 entries); verified unchanged after final client/API assertions. Full backend preceded the last test-only staff list-order assertion, whose focused rerun is recorded separately.

Final assertion-only follow-up: `browser-assertions-final.txt` exercises added keyboard selected-Action activation and explicit dashboard overlap/clipping assertions across all three projects. It passed all 30 checks, zero failed/skipped, exit 0. Full configured regression ran before those last test-only assertions; no production change followed it.

Final closure: independent review found no substantiated product, Standards or static Spec blocker; all accepted review corrections and final assertion additions pass. Canonical dashboard/security/style/performance/E2E, full visual/accessibility and current integrated-branch REG-01 rows are Passed; HARDEN-01 remains Planned for #55. Evidence contains no environment/session credentials. Implementation verification preceded publication authorization.

Reproduction commands (set `DATABASE_URL`/`E2E_DATABASE_URL` to disposable loopback PostgreSQL, with the existing seed for browser use; do not use a shared/live database):

```powershell
# server/
npm test -- --reporter=verbose
npx vitest run tests/lab-04/staff-dashboard.api.test.ts
npx vitest run tests/lab-04/dashboard.performance.test.ts
npm run build
# client/
npm test -- --run --maxWorkers=2
npm run build
# repository root
npx playwright test
npx playwright test e2e/lab-04/dashboards.spec.ts e2e/lab-04/responsive-visual.spec.ts
```

Execution/closure dates: 2026-10-06–07, Asia/Bangkok. Test-runner start-time text is the execution host's clock; JSON performance timestamps are UTC. Dashboard fixed-clock fixtures use 2026-10-06T12:00:00Z. Final fingerprints were regenerated after the last test-only assertions and verified against disk.
Publication grouping: 40794be (filters), 58083cb (APIs/seed), b14e4d1 (landing/navigation), c21af9a (exact Action selection), 2b2af97 (performance/browser tests), followed by this documentation/evidence-only commit. Tests validate the final combined source snapshot, not every intermediate commit independently. Push and PR creation use the separate explicit user authorization.
