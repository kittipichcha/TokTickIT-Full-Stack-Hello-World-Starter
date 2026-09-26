# Issue #42 integration flow results (historical and current gate)

## Integrated baseline and execution

The recorded server/client and browser runs below are historical and predate the current
review-response worktree. They are not final-head verification. Current focused responsive and
keyboard runs each report 12/12 passes across desktop, tablet, and mobile; see `tests.md` for
the scope limit. The earlier browser figures refer to distinct runs: full regression 181/183 on
an initial attempt, 183/183 on its later clean run, 27/27 in the earlier Lab 3 structured run,
and 42/42 in the later Lab 3 review-fix run. They are not contradictory totals for one run.

- Source baseline: `77d810b17b60f0628e8b05e22d448c3340a754c2` (`lab3-staging`).
- Runtime: Node `v24.14.0`, npm `11.9.0`.
- Server tests: 39 files, 598 passed ([`server-vitest-summary.txt`](server-vitest-summary.txt), 2026-09-25).
- Client tests: 18 files, 252 passed ([`client-vitest.txt`](client-vitest.txt), includes the full ported UI style suite); combined Lab 2 + Lab 3 style gate: 34 passed ([`client-ui-style-combined.txt`](client-ui-style-combined.txt)).
- Playwright discovery: 183 cases across 12 files ([`playwright-list.txt`](playwright-list.txt)).
- Lab 3 Playwright: [`lab3-playwright.json`](lab3-playwright.json), 27 passed across desktop/tablet/mobile.
- Full Lab 2 + Lab 3 Playwright: the initial attempt recorded 181/183, then the clean run recorded 183/183 in [`playwright-full-regression-summary.txt`](playwright-full-regression-summary.txt). Both are historical and must not be described as current-head evidence.
- Production builds, both TypeScript checks, and `prisma validate`: passed.
- Built server smoke: initial `npm start` failed because the script targeted `dist/index.js`, while the build emits `dist/src/index.js`; after changing the script, startup succeeded and `/api/auth/me` returned 401. Client dev-server `/` and `/src/main.tsx` returned 200 with no `/@fs/` reference.
- Focused CSRF verification: [`sec-authz-07-vitest.json`](sec-authz-07-vitest.json), 52/52; route detail is in [`csrf-route-inventory.md`](csrf-route-inventory.md).

## Lab 2 baseline → integrated upgrade (REL-12)

**Not run; prerequisite now available.** The PostgreSQL role `kitti` has `CREATEDB`, and the
user-authorized disposable E2E database is `lab3e2e`. REL-12 requires an isolated scratch
database from the Lab 2 baseline. No REL-12 migration is evidenced in this worktree; do not
claim that the gate passed. No shared database was dropped or reset. Run REL-12 against the
disposable target and capture migration, data-preservation, and integrated-flow evidence.

The upstream #35 scratch-DB evidence remains separate and does not substitute for REL-12 on the final integrated code. No legacy-row snapshots, storage preservation check, or integrated migrated-data browser flow are claimed here.
