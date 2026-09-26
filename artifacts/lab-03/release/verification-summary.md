# Issue #42 verification summary (historical and review-response evidence)

## Current review worktree boundary

The committed baseline is `5f9aa11d3b990d0f14270938eef340bf79cb05e1`; it predates the current
uncommitted review-response changes. Historical full-suite records below are not evidence for
that changed worktree. The latest focused responsive Playwright run reports 12/12 passed across
desktop, tablet, and mobile. The latest focused keyboard-access run also reports 12/12 passed
across those projects. Full client/server suites, full configured Playwright regression, and
REL-12 remain unverified on the current worktree.

The browser counts describe different runs and scopes: the full configured regression recorded
183/183; the earlier Lab 3 structured run recorded 27/27; a later Lab 3 review-fix run recorded
42/42. The 181/183 figure in the initial-run note was an earlier attempt with two failures, not
the final 183/183 run. Do not combine these totals.

## Source and test outputs

The worktree started at `77d810b17b60f0628e8b05e22d448c3340a754c2`. Initial harness commit: `d5da2b5` (`test(e2e): isolate integrated Playwright harness`). The implementation state verified here is committed through `862a97a`; later release-artifact commits change only documentation/evidence. Runtime: Node `v24.14.0`, npm `11.9.0`.

| Check | Result | Evidence |
|---|---|---|
| Full client Vitest | 18 files, 252 passed | [`client-vitest.txt`](client-vitest.txt); focused UI style suite passed 18/18 in [`ui-style-vitest.txt`](ui-style-vitest.txt). |
| Full server Vitest | 39 files, 598 passed | [`server-vitest-summary.txt`](server-vitest-summary.txt). Includes migration, Lab 2 regression, and Lab 3 API suites. |
| SEC-AUTHZ-07 focused | 52 passed | [`sec-authz-07-vitest.json`](sec-authz-07-vitest.json), [`csrf-route-inventory.md`](csrf-route-inventory.md). |
| Lab 3 browser suite (historical) | 27 passed | [`lab3-playwright.json`](lab3-playwright.json), three configured viewport projects. |
| Lab 3 review-fix browser run (historical) | 42/42 passed | Recorded in `docs/lab-03/tests.md` for the 2026-09-26 run; raw output is not in this release directory. |
| Full configured browser run (historical) | 183/183 passed, 0 failed/skipped; 22.7 minutes | [`playwright-full-regression-summary.txt`](playwright-full-regression-summary.txt), raw output [`playwright-full-final.txt`](playwright-full-final.txt). |
| Combined Lab 2 + Lab 3 UI style gate | 34 passed | [`client-ui-style-combined.txt`](client-ui-style-combined.txt). |
| Server/client type checks | Passed | [`server-typecheck.txt`](server-typecheck.txt), [`client-typecheck.txt`](client-typecheck.txt). |
| Server/client production builds | Passed | [`server-build.txt`](server-build.txt), [`client-build.txt`](client-build.txt). |
| Prisma schema validation | Passed | [`prisma-validate.txt`](prisma-validate.txt). |
| Built server startup and client dev readiness | Passed after isolated server-script fix | [`server-start-before-fix.txt`](server-start-before-fix.txt) captures the reproduced wrong entry path; [`server-start-smoke.txt`](server-start-smoke.txt) shows the corrected API starts and returns 401 from `/api/auth/me`; [`client-dev-smoke.txt`](client-dev-smoke.txt) shows Vite returns 200 for the app and entry module with no `/@fs/` reference. |
| Integrated §9.3 schema shape/native-type audit | Passed on the existing temporary Lab 3 database | [`schema-catalog-audit.md`](schema-catalog-audit.md) and [`schema-catalog.json`](schema-catalog.json); does not replace REL-12. |
| Test-DD §5 file existence | 32/32 referenced automated test paths present | [`test-dd-path-audit.txt`](test-dd-path-audit.txt). |

## Dependency evidence audit

- **#35:** physically inspected `artifacts/lab-03/issue-35/README.md`, `head-sha.txt`, `server-vitest.txt`, `db-mig-execution.txt`, `seed-execution.txt`, `compliance-map.md`, `grep-gate.txt`, and `artifacts/lab-03/migration/{scratch-db-proof.md,integration-gate.md}`. The bundle records green migration, seed, freshness, schema, collision/recovery, and handoff evidence at its stated source SHA.
- **#37:** physically inspected `artifacts/lab-03/regression/{lab2-test-audit.md,cutover-gate.md,server-vitest.txt,client-vitest.txt,lab2-e2e-run.txt,pr-47-body.md}`. It records the cutover checkpoint and 156 Lab 2 browser passes at its stated earlier source.
- **#38:** inspected the review remediation README and associated focused/full suite and build logs. The README discloses an interrupted server rerun separately from its completed run. The requested historical smoke-gate records are not present as such; fresh equivalent integrated server/client smoke checks are recorded above, but the upstream artifact-presence gate still needs resolution.
- **#41:** inspected `artifacts/lab-03/issue-41/README.md`, `source-sha.txt`, the current review-fix server/client outputs, Admin API output, and UI output. The recorded test/build results are green at the stated older source SHA.

These historical dependency bundles do not replace reruns against the final merge SHA. Focused
responsive/keyboard results cover only their named specs. The #38 smoke-gate gap and unrun REL-12
keep the final release gate open. PostgreSQL role `kitti` now has `CREATEDB`, and disposable
`lab3e2e` is available; this resolves the earlier prerequisite gap, but does not evidence a
REL-12 migration run.

## Submission evidence

The repository contains `README.md` and `.gitignore`. PR #56 has a human changes-requested
review; response is in progress and is not approval. PDF Parts 1–9 and Kanban closeout are
reserved for the user. Post-merge main verification has not been completed. This summary does
not claim those gates.
