# Issue #42 integration flow results

## Integrated baseline and execution

- Source baseline: `77d810b17b60f0628e8b05e22d448c3340a754c2` (`lab3-staging`).
- Runtime: Node `v24.14.0`, npm `11.9.0`.
- Server tests: 39 files, 598 passed ([`server-vitest-summary.txt`](server-vitest-summary.txt), 2026-09-25).
- Client tests: 18 files, 252 passed ([`client-vitest.txt`](client-vitest.txt), includes the full ported UI style suite); combined Lab 2 + Lab 3 style gate: 34 passed ([`client-ui-style-combined.txt`](client-ui-style-combined.txt)).
- Playwright discovery: 183 cases across 12 files ([`playwright-list.txt`](playwright-list.txt)).
- Lab 3 Playwright: [`lab3-playwright.json`](lab3-playwright.json), 27 passed across desktop/tablet/mobile.
- Full Lab 2 + Lab 3 Playwright: [`playwright-full-regression-summary.txt`](playwright-full-regression-summary.txt) records the 181/183 initial pass; both Lab 2 visual failures passed in an isolated rerun. A clean single-run three-project regression is still required.
- Production builds, both TypeScript checks, and `prisma validate`: passed.
- Built server smoke: initial `npm start` failed because the script targeted `dist/index.js`, while the build emits `dist/src/index.js`; after changing the script, startup succeeded and `/api/auth/me` returned 401. Client dev-server `/` and `/src/main.tsx` returned 200 with no `/@fs/` reference.
- Focused CSRF verification: [`sec-authz-07-vitest.json`](sec-authz-07-vitest.json), 52/52; route detail is in [`csrf-route-inventory.md`](csrf-route-inventory.md).

## Lab 2 baseline → integrated upgrade (REL-12)

**Blocked before execution.** The temporary connection available in `server/.env` is the user-authorized disposable database, but its PostgreSQL role reports `rolcreatedb=false`. REL-12 requires creating and owning a separate scratch database from the Lab 2 baseline; using the shared `tocktick` database would violate the plan's isolation rule. No REL-12 migration was started and no shared database was dropped or reset. Provide a disposable connection with `CREATEDB` or an already-created scratch database with appropriate ownership to resume this gate.

The upstream #35 scratch-DB evidence remains separate and does not substitute for REL-12 on the final integrated code. No legacy-row snapshots, storage preservation check, or integrated migrated-data browser flow are claimed here.
