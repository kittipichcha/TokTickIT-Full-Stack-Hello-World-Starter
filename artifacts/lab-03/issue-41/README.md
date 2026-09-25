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

## PR #48 remediation follow-up — 2026-09-24

Tested client source SHA: `00bbc00`. The backend race guard and `API-ADM-12` are at `49c9c1a`.
The current local `origin/lab3-staging` ref is an ancestor of the feature branch and includes PR
#49. A fresh `git fetch origin` could not reach GitHub; the saved local ref was used for the scope
check. The triple-dot diff has no Issue #38/Staff paths.

- Admin API: **39 passed** in `users-admin.api.test.ts` (39/39). The regression forces the stale
  inactive-to-active target interleaving and verifies the active Administrator invariant.
- Focused client: **39 passed across 3 files** (User Management, AuthGate, App).
- Full client: **231 passed across 17 files**, 0 skipped.
- Full server: **578 passed across 39 files**, 0 skipped (817.08 seconds). Expected migration
  failure-path diagnostics were emitted; Vitest exited successfully.
- Client and server TypeScript checks and production builds passed. `git diff --check` passed and
  the conflict-marker scan found none.
- The client checks cover self-reset moving AuthGate directly to Change Password, explicit
  Create/Edit success status, and the responsive labeled-row markup styled as cards below 768px.
  The incorrect decision-20 citation was removed from `api-spec.md` §26.
- E2E-03 remains Planned under Issue #42 ownership. Human re-review remains pending.

Updated run summaries and source SHA are in `client-vitest.txt`, `server-vitest.txt`, the focused
test files, build summaries, and `source-sha.txt`.

## Final PR #48 local remediation verification — 2026-09-24

Client implementation SHA: `05b03516087d537944cbfe0f8020dca805abd347`.

- Focused client (App, User Management, AuthGate): **41 passed across 3 files**.
- Full client: **233 passed across 17 files**, 0 skipped.
- Admin API: **39 passed**; full server: **578 passed across 39 files**, 0 skipped.
- Client and server TypeScript checks and production builds passed.
- The mobile user-management test asserts that desktop table and separate mobile cards exist and
  that card content/actions map correctly. It is structural JSDOM coverage, not viewport evidence.
- The prior `admin-user-management-mobile.png` is stale and was not overwritten: no browser or
  Playwright executable is available in this environment to capture the new cards. Refresh this
  screenshot before relying on visual evidence. E2E-03 remains owned by Issue #42.
- API §26's unsupported decision-20 attribution was removed; decision 20 itself was not changed.
- Fresh human review/approval remains pending.

## Issue #41 forced-password-change state remediation — 2026-09-25

- Added `UI-AUTHGATE-05` to exercise Administrator self-reset → Change Password → successful
  password change → ordinary profile update. The App test double exposes the actual cached
  `mustChangePassword` value passed by AuthGate, and the test asserts it is `false` after success.
- `AuthGate.handlePasswordChanged()` now reconciles the cached user flag to `false` while keeping
  the other identity fields, then enters the authenticated state. No server/API behavior changed.
- `client/src/AuthGate.tsx` and `client/src/lab-03-tests/AuthGate.test.tsx` SHA-256 values and the
  pre-commit checkout HEAD are recorded in `source-sha.txt`; use Git history for the resulting
  commit identifier.
- Verification: UI-AUTHGATE-05 failed against the handler without cache reconciliation as expected,
  then passed after the fix. AuthGate passed 9/9; App + User Management + AuthGate passed 42/42;
  the full client suite passed 234/234 across 17 files with 0 skipped. TypeScript check, client
  production build, `git diff --check`, and conflict-marker scan passed. A first sandboxed test/build
  attempt stopped at config loading; bounded-access reruns completed successfully. Run summaries
  are in `client-vitest-authgate-05.txt`, `client-vitest.txt`, and `client-build.txt`.
- `UI-AUTHGATE-05` is Passed in Test DD based on the executable result. Server suites were not
  rerun; their previous evidence is left intact and is not represented as current verification.
- Fresh human re-review/approval remains pending. E2E-03 and the refreshed mobile screenshot remain
  with Issue #42; neither is claimed as completed here.
