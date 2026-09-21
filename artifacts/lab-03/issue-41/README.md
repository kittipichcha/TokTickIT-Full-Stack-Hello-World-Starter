# Issue #41 — Administrator User Management: Execution Evidence

All artifacts in this folder were produced by actual, executed runs on
`feature/issue-41-admin-user-management` (worktree `issue-41-worktree`), against the local
PostgreSQL database configured in `server/.env`. Nothing here is transcribed from the plan.

## Frozen rows executed (owner: Issue #41)

| File | Rows |
|---|---|
| `server/tests/lab-03/users-admin.api.test.ts` | `API-ADM-01..10`, `API-ADM-07b`, `SEC-AUTHZ-03`, `SEC-AUTHZ-09` |
| `client/src/lab-03-tests/UserManagement.test.tsx` | `UI-ADM-01`, `UI-ADM-02` |

`E2E-03` is owned by **#42** and is deliberately **not** executed or marked here.

## Runs

| Artifact | Command | Result |
|---|---|---|
| `users-admin-api-test.txt` | `npx vitest run tests/lab-03/users-admin.api.test.ts` (server) | **36 passed** |
| `user-management-ui-test.txt` | `npx vitest run src/lab-03-tests/UserManagement.test.tsx` (client) | **10 passed** |
| `server-vitest.txt` | `npx vitest run` (server, full regression) | **35 files / 467 tests passed** |
| `client-vitest.txt` | `npx vitest run` (client, full regression) | **13 files / 130 tests passed** |

Screenshots: `../../../screenshots/user-management/` (desktop + mobile).

## Key assertions this evidence proves

- **All 10 safety rules** (duplicate email on create *and* edit, invalid role, self-
  deactivation, last-admin deactivation, last-admin demotion, non-Admin forbidden, single
  role, non-last self-demote, nonexistent user) — API suite.
- **Last-admin concurrency (BR-28).** `API-ADM-07`'s two-concurrent-demotions case uses a
  deterministic barrier so both requests read the pre-write count before either writes.
  It was independently verified to **fail** (`[200, 200]`; final active count `0`) when the
  transaction isolation level was temporarily lowered to `ReadCommitted`, and to pass under
  `Serializable`. The test is therefore sensitive to the guard rather than vacuously green.
- **Password-hash containment.** Every success path asserts `passwordHash` is absent; a
  `PATCH` body carrying `passwordHash` is ignored and the stored hash is unchanged.
- **Rev 8 sub-assertions.** Own-unchanged/case-variant email round-trip → `200`
  (F-41-1); concurrent duplicate-email creates → exactly one `201`, one `409`, no `500`
  (F-41-2); empty/no-op `PATCH` → `200` (F-41-3).
- **End-to-end forced password change.** `API-ADM-08` resets the password, logs in with the
  new password, confirms the change-password gate blocks normal access
  (`401 PASSWORD_CHANGE_REQUIRED`), completes the change, and confirms access is restored.
- **BR-33 form preservation.** `UI-ADM-01` asserts a duplicate-email-on-edit `409` leaves the
  edit form populated with an inline error and no navigation.