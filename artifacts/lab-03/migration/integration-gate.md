# Lab 3 Integration Gate + Grep Gate — Issue #35 (DM-17)

**Date:** 2026-09-17
**Branch:** `feature/issue-35-identity-db-migration-auth`
**Base:** `origin/lab3-staging` @ `749aa96`

## Purpose

DM-17 requires a handoff integration gate proving the #35 merge point compiles and the
Lab 2 regression suite stays green, plus a grep gate proving the temporary legacy-caller
compatibility set is confined.

## 1. Integration gate (clean checkout → generate → build → regression)

Run against a Lab-3-migrated PostgreSQL database (`tocktick_lab3_scratch`).

| Step | Command | Result |
|---|---|---|
| 1 | `npx prisma generate` | ✅ Generated Prisma Client (v5.22.0) |
| 2 | `npm run build` (server, `tsc`) | ✅ exit 0 |
| 3 | `npm run build` (client, `tsc && vite build`) | ✅ built in ~4s |
| 4 | `npx vitest run` (server) | ✅ **366 passed / 30 files** |
| 5 | `npx vitest run` (client) | ✅ **107 passed / 10 files** |

The server suite includes the full Lab 2 regression suite (adapted per DM-17) and the
new `server/tests/lab-03/*` tests. The client suite includes the Lab 2 tests and the new
`client/src/lab-03-tests/*` tests.

### Auth round-trip smoke (curl)

- `POST /api/auth/login` (derived password) → `200` with `{id,name,email,role,mustChangePassword}`,
  `X-CSRF-Token` header, httpOnly session cookie ✅
- `GET /api/auth/me` → `200` identity ✅
- `POST /api/auth/change-password` (wrong current) → `400 VALIDATION_ERROR` generic ✅
- `POST /api/auth/change-password` (valid) → `200 {success:true, mustChangePassword:false}` ✅
- `POST /api/auth/logout` without CSRF → `403 FORBIDDEN` ✅
- `POST /api/auth/logout` with CSRF → `200`; subsequent `/me` → `401` ✅

## 2. Grep gate

Command:
```
grep -rn "prisma.devRequester|.devRequester." server/src/
```
Result: **0 matches** — zero references to the dropped Prisma model.

Command:
```
grep -rn "devRequester|uploaderRequesterId|removedByRequesterId" server/src/
```
Confined hits (all within the declared DM-17 compatibility set):
- `requester-context.ts`: `res.locals.devRequesterId` (runtime variable name for the legacy
  route context — not a Prisma model reference).
- `controller.ts`: `res.locals.devRequesterId` reads (legacy route handlers).
- `service.ts`: `removedByRequesterId` as the **legacy response key** (mapped from
  `removedByUserId`), preserved where Lab 2 tests assert it.
- `migrate-lab3.ts`: the intentional typed raw-SQL read of the legacy `DevRequester` table
  during backfill (the table exists only until Phase C).

No reference to the dropped model remains outside the declared set.

## 3. Non-deployable intermediate state

Per DM-17 and the Definition of Done, this branch is **not deployed** and is **not** a fully
authenticated application. The auth surface coexists with the header-gated legacy Lab 2 routes
until #37's cutover. The declared DM-17 compatibility set is the exact set #37 Rev 12 RR-01
must delete:

1. `server/src/service.ts` — identity from `User` (role REQUESTER); Attachment
   reads/writes on `uploaderUserId`/`removedByUserId`; legacy response key
   `removedByRequesterId` preserved.
2. `server/src/requester-context.ts` — `requireDevRequesterContext` reads `User`
   (role REQUESTER); same reject semantics.
3. `server/src/controller.ts` — legacy route handlers using `res.locals.devRequesterId`.
4. `server/src/module.ts` — legacy route wiring (unchanged gate).
5. `server/tests/lab-02/*` — adapted to `prisma.user` (role REQUESTER) preserving assertions.