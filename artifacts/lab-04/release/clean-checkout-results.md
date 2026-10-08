# Issue #55 — README procedure rehearsal

Initial rehearsal: 2026-10-07; continuation: 2026-10-08, Asia/Bangkok.
Working branch: `feature/lab4-integration-release`,
based on `ed91b191ed44c3cb71de1ae61484f91e32b98e28` from remote `lab4-staging`.
Runs include the issue #55 working diff; they are not final-main certification.
The dedicated rehearsal database is `lab4_release_issue55_rehearsal_20261007`,
separate from the backend and browser runner databases. Private connection values and
the generated server-only session secret are not included in these records.

## Five distinct README procedures

| Procedure | Current result | Concrete evidence and limits |
|---|---|---|
| Setup | Passed, with retained initial environment failure | Root/server/client locked installs and tooling are reported in `environment.md` and `backend-component-verification.md`. The first explicit generation hit an in-use Windows DLL; the normal-schema retry on 2026-10-08 completed exit 0, generating Prisma Client 5.22.0 in 325 ms. See `staging/rehearsal/generate.txt`, `generate-retry.txt` and `generate-manifest.json`. No package or engine change was made. |
| Seed | Passed: command rehearsal and canonical preservation | `staging/rehearsal/seed-first.txt` and `seed-repeat.txt` show exit-0 seed twice on the dedicated rehearsal DB. The final fresh backend report passes all three Lab 4 seed cases, including DB-SEED-01 zero/one/many and preservation assertions. Successful seed output alone is not substituted for those assertions. |
| Migration | Passed: empty deploy and populated synthetic contracts | `staging/rehearsal/empty-migrate.txt` records all eight existing migrations successfully applied to the disposable database created empty by the verification agent; `migration-status.txt` reports up to date. No ninth migration was created. The final fresh backend report passes all three Lab 4 migration cases and all 26 Lab 3 migration cases, including DB-MIG-04 fixture isolation and normal-history checks. A real deployment/incident is not claimed. |
| Tests | Passed: complete backend, client and browser | Fresh backend 681/681, client 366/366 and full three-project browser 294/294 passed with zero failed or required skipped cases. Final backend `server-final-results.json`, `server-final-test.log` and `server-final-manifest.json` confirm exit 0; build/Prisma evidence is in `backend-component-verification.md`. Initial incomplete/failed attempts remain separately recorded. |
| Demo | Startup and complete role journeys passed | `staging/rehearsal/startup-smoke.json` records built-server readiness and built-client preview on alternate ports. Complete browser `staging/playwright.json` and `.txt` passed 294/294 across all three projects, including real requester, staff and admin role navigation and Actions/workflow/dashboard journeys. HTTP startup remains only the readiness portion. |

## Commands executed on the dedicated rehearsal database

Repository-root cwd: `C:/Users/kitti/CPE334/issue-55-worktree`. The private environment
helper bound only the dedicated rehearsal DB and a valid local session secret; its
contents and credentials are excluded from evidence. Each runner exit was checked before
the next dependent step.

```powershell
server/node_modules/.bin/prisma.cmd migrate deploy --schema server/prisma/schema.prisma
server/node_modules/.bin/prisma.cmd generate --schema server/prisma/schema.prisma
server/node_modules/.bin/prisma.cmd migrate status --schema server/prisma/schema.prisma
npm.cmd --prefix server run prisma:seed
npm.cmd --prefix server run prisma:seed
```

The first deploy completed successfully. Generation then returned Windows `EPERM` while
renaming `query_engine-windows.dll.node`, so the sequence stopped. Status and both seeds
subsequently ran successfully using the existing unchanged generated client. This is
retained as failed tooling evidence, not hidden as a clean first run or a product defect.
After the browser stopped and before new runners began, explicit generation was retried
on 2026-10-08 and completed exit 0. `generate-manifest.json` records its exact command,
cwd, UTC start/end, source SHA, exit code and normal-schema context. A preceding attempt
to launch that retry was not executed because the automatic approval reviewer hit its
usage limit; it was a review-service failure, not an unsafe-action determination or a
passing command. The resumed authorized call completed normally.

## Built application startup smoke

The already-built server ran its documented start entrypoint `node dist/src/index.js`
from `server/` with `PORT=3045`, `NODE_ENV=development`, a valid private secret and
the dedicated rehearsal DB. Its unauthenticated `GET /api/auth/me` returned the expected
`401 UNAUTHENTICATED`. The built client ran the documented Vite preview entrypoint from
`client/` on port 4175 and returned HTTP 200 with built asset references. Raw stdout/stderr
and UTC start/end timestamps are in `staging/rehearsal/`; the two processes were stopped
by their captured process IDs in cleanup. No Playwright port-3000/5173 server was touched.

## Migration-context and recovery boundaries

README documents three separate contexts: empty disposable history deployment; a verified
populated Lab 3 database with seven prerequisite migrations, paired DB/attachment snapshots
and only the eighth migration pending; and populated Lab 2 conversion at the pinned Lab 3
release checkout before the verified Lab 3 cutover. The current Lab 4 orchestrator is not
promoted as a workaround for populated Lab 2 conversion.

Canonical DB-MIG-02 observes real partial/failed deploy state before paired restoration;
it does not assume automatic transaction rollback. DB-MIG-03 models an accepted write and
forward repair, preserving accepted data rather than restoring an old snapshot. These are
synthetic disposable rehearsals and do not establish that a live deployment or incident
occurred. No private database dump or attachment snapshot belongs in this release bundle.

All five procedure rows are reconciled with completed staging-working-diff evidence, supporting HARDEN-01. Human release review, main verification, final board and submission
PDF remain separate pending gates.
