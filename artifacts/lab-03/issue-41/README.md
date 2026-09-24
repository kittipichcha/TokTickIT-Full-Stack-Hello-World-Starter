Issue #41 integration verification
Latest server implementation SHA: 49c9c1a (`fix(lab-03): guard concurrent admin state transitions`)
Earlier integration implementation SHA: c8568cc (merge commit on feature/issue-41-admin-user-management)

Commands and results:
- cd client && npx vitest run src/App.test.tsx src/lab-03-tests/UserManagement.test.tsx src/lab-03-tests/AuthGate.test.tsx — 3 files, 37 passed.
- cd server && npx vitest run tests/lab-03/users-admin.api.test.ts — 1 file, 38 passed.
- cd client && npx vitest run src/lab-03-tests/StaffTicketQueue.test.tsx src/lab-03-tests/StaffTicketDetail.test.tsx — 2 files, 68 passed.
- cd server && npx vitest run tests/lab-03/staff-queue.api.test.ts tests/lab-03/staff-ticket-detail.api.test.ts tests/lab-03/comments-notes.api.test.ts — 3 files, 93 passed.
- cd client && npx vitest run — 17 files, 229 passed, 0 skipped.
- cd server && npx vitest run — 39 files, 577 passed, 0 skipped.
- Client and server: npx tsc --noEmit; npm run build — passed.
- git diff --check — passed; conflict-marker scan — none.

Earlier Issue #41 rows exercised by these runs include API-ADM-01..11, API-ADM-07b,
SEC-AUTHZ-03/09, UI-ADM-01/02, UI-48-NAV, UI-48-SELF-DEMOTION, and the three User
Management modal tests. E2E-03 remains Planned under Issue #42 ownership.

The full-suite runner summary is recorded here. Earlier full-run output files are retained as
*-pre-integration.txt so their older SHAs and counts are not represented as current evidence.

## PR #48 review fix verification — 2026-09-24

Source implementation SHA: `49c9c1a`.

- `server/tests/lab-03/users-admin.api.test.ts`: **39 passed**. Raw output:
  [`users-admin-api-review-fix.txt`](./users-admin-api-review-fix.txt).
- Full server suite: **39 files / 578 passed / 0 skipped**. Raw output:
  [`server-vitest-review-fix-workaround.txt`](./server-vitest-review-fix-workaround.txt).
- `npm run build` in `server`: passed. Raw output:
  [`server-build-review-fix.txt`](./server-build-review-fix.txt).
- `git diff --check`: passed after the documentation update.

The regression `API-ADM-12` forces the reported inactive→active interleaving on a separate
database connection. The test was first run against the pre-fix implementation and failed:
the stale demotion returned `200` after the concurrent valid activation and demotion left no
active Administrator. It passes with the transactional target reread, count check, and write.

The full-suite run used a local-only fallback in ignored `node_modules/tsx` temporary-directory
helpers because this Windows Node 24 environment returned `uv_os_get_passwd: ENOMEM` when
nested migration/seed commands called `os.userInfo()`. The fallback used `USERNAME` only when
that call failed; no dependency or workaround code is included in the repository commit.
