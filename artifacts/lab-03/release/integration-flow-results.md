# Issue #42 integration flow results (historical and current gate)

## Integrated baseline and execution

Final implementation source SHA: `ce2e40ddf049cf7cf62b43280a563b750622a0a4`. Final-head
verification passed 598/598 server tests, 252/252 client tests, 34/34 UI-style tests, 54/54 Lab 3
Playwright tests, 210/210 configured Playwright tests, and 19/19 REL-12 migration tests. Server
and client builds and Prisma validation also passed. Browser figures refer to distinct runs and
scopes, not conflicting totals.

- Source baseline: `77d810b17b60f0628e8b05e22d448c3340a754c2` (`lab3-staging`).
- Runtime: Node `v24.14.0`, npm `11.9.0`.
- Server tests: 39 files, 598 passed ([`server-vitest-final.txt`](server-vitest-final.txt)).
- Client tests: 18 files, 252 passed ([`client-vitest-final.txt`](client-vitest-final.txt)); combined Lab 2 + Lab 3 style gate: 34 passed ([`client-ui-style-final.txt`](client-ui-style-final.txt)).
- Playwright discovery: 183 cases across 12 files ([`playwright-list.txt`](playwright-list.txt)).
- Lab 3 Playwright: [`playwright-lab3-final.txt`](playwright-lab3-final.txt), 54 passed, 0 skipped/flaky across desktop/tablet/mobile; JSON totals in [`lab3-playwright.json`](lab3-playwright.json).
- Full Lab 2 + Lab 3 Playwright: 210/210 passed in [`playwright-full-final-head.txt`](playwright-full-final-head.txt). Historical full run recorded 183/183.
- Production builds and `prisma validate`: passed ([`server-build-final.txt`](server-build-final.txt), [`client-build-final.txt`](client-build-final.txt), [`prisma-validate-final.txt`](prisma-validate-final.txt)). Type checks are not claimed by final-head artifacts.
- Built server smoke: initial `npm start` failed because the script targeted `dist/index.js`, while the build emits `dist/src/index.js`; after changing the script, startup succeeded and `/api/auth/me` returned 401. Client dev-server `/` and `/src/main.tsx` returned 200 with no `/@fs/` reference.
- Focused CSRF verification: [`sec-authz-07-vitest.json`](sec-authz-07-vitest.json), 52/52; route detail is in [`csrf-route-inventory.md`](csrf-route-inventory.md).

## Lab 2 baseline → integrated upgrade (REL-12)

**Passed on integrated migration code** at SHA `ce2e40ddf049cf7cf62b43280a563b750622a0a4`.
The complete `server/tests/lab-03/migration.integration.test.ts` file passed **19/19, 0 failed,
0 skipped** in 644.26 seconds. Its fixture uses `E2E_DATABASE_URL` (loaded from ignored
`server/.env`) to create and remove its own unique Lab 2-shaped scratch database. It verifies
preserved requester, ticket, and attachment state, migrated requester authentication and forced
password change, and migration collision/failure recovery. No shared or ordinary database was
dropped or reset. Detailed evidence: [`rel-12-migration.md`](rel-12-migration.md).

This supersedes the earlier “not run; prerequisite available” state. The supplied final-head
client/server suites and configured Playwright regression also passed. The upstream
#35 scratch proof is historical and is not the basis for this REL-12 result.

The upstream #35 scratch-DB evidence remains separate and does not substitute for REL-12 on the final integrated code. No legacy-row snapshots, storage preservation check, or integrated migrated-data browser flow are claimed here.
