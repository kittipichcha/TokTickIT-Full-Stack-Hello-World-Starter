# Issue #35 — Frozen Ground-Truth Compliance Map (Review B-6)

**Purpose.** The PR #46 reviewer disclosed they could not read any repository files, so this
map quotes the frozen ground-truth requirements and maps each to the implementation, the
executable test, and the executed evidence in this bundle. Authoritative sources:

- `docs/lab-03/specification.md` §9.2 (`Initial-password migration mechanism (frozen)`),
  §9.3 (`Data model contract (frozen)`), §13 (Assumptions and Decisions).
- `docs/lab-03/api-spec.md` §0 (Conventions + frozen status/`error.code` table), §1–§4
  (the four auth endpoints).
- `docs/lab-03/tests.md` — frozen Test-DD rows (read verbatim; file paths locked).

---

## A. `specification.md` §9.2 — Initial-password migration mechanism (frozen)

| Frozen requirement (quoted) | Implementation | Test | Evidence |
|---|---|---|---|
| "Each `DevRequester` becomes one `User` with the same `name`, `email`, and `isActive` value. `DevRequester.id` is preserved as the `User.id` …" | `server/src/migrate-lab3.ts` backfill (exact-ID assignment, typed `$queryRaw` legacy read) | DB-MIG-01 | `db-mig-execution.txt`, `../migration/scratch-db-proof.md` §2 |
| "Every migrated Requester is assigned the single role `REQUESTER`." | `role: "REQUESTER"` in backfill | DB-MIG-01 | same |
| Derivation formula: `"Lab3-" + first 20 characters of lowercase-hex SHA-256(normalizedEmail + ":" + normalizedName)` | `deriveInitialPassword()` in `server/src/migrate-lab3.ts`; reused by `prisma/seed.ts` | DB-MIG-03 | `db-mig-execution.txt` |
| "The initial password is stored **only** as a bcrypt hash; the plaintext value is never persisted…" | `bcrypt.hash(...)` at write sites; no plaintext column | UNIT-AUTH-01, DB-MIG-03 | `server-vitest.txt` |
| "Every migrated Requester is created with `mustChangePassword = true`." | backfill `mustChangePassword: true` | DB-MIG-01, DB-MIG-04 | `db-mig-execution.txt` |
| "A migrated Requester can log in with the deterministic initial password, but `BR-02` blocks access to normal application screens until a valid new password is saved." | `requirePasswordChanged` → `401 PASSWORD_CHANGE_REQUIRED`; `GET /api/app/context` | DB-MIG-04, API-AUTH-06 | `db-mig-execution.txt`, `server-vitest.txt` |
| "Once the password is changed, `mustChangePassword` becomes `false` and normal application access is allowed." | `changePassword()` sets `mustChangePassword = false`; same session unblocked | DB-MIG-04, API-AUTH-06 | same |
| "Running the migration/seed twice must produce the same initial password for the same user…" | deterministic derivation (no randomness) | DB-MIG-03 (rerun-safe from a fresh snapshot) | `db-mig-execution.txt` |
| "the migration must fail loudly if the derived migration would violate that constraint … it must **abort with a clear error**" | Stage-2 three-way collision scan → `MigrationCollisionError` before any `User` write | DB-MIG-05 (subcases A/B/C) | `db-mig-execution.txt`, `../migration/scratch-db-proof.md` §3 |

## B. `specification.md` §9.3 — Data model contract (frozen)

### B.1 Conventions

| Frozen requirement (quoted) | Implementation | Test | Evidence |
|---|---|---|---|
| "All `createdAt` / `updatedAt` / `uploadedAt` / `removedAt` fields are UTC timestamps (`timestamptz`)." | **DM-TIME-01**: new models `@db.Timestamptz(3)` in Phase A; existing columns converted in Phase C via `USING <col> AT TIME ZONE 'UTC'` | DB-MIG-02 (native-type + UTC-instant assertions) | `db-mig-execution.txt`, `../migration/scratch-db-proof.md` §2 |
| "All string fields are trimmed before validation and persisted trimmed." | `specification`-aligned validation in `service.ts`/`auth-service.ts` | Lab 2 normalization/validation suites + `auth.unit.test.ts` | `server-vitest.txt` |

### B.2 `User` model (all 9 frozen fields)

| Frozen field / rule | Implementation (`server/prisma/schema.prisma`) | Test | Evidence |
|---|---|---|---|
| `id` integer PK auto-increment; preserves original `DevRequester.id` | `id Int @id @default(autoincrement())` + exact-ID backfill | DB-MIG-01 | `db-mig-execution.txt` |
| `name` required, trimmed, non-empty, 1–200 | `name String` | DB-MIG-02 | same |
| `email` required, valid, trimmed/lowercased, **unique** | `email String @unique` + `@@unique([email])` | DB-MIG-02 | same |
| `role` enum `Role`, exactly one | `role Role` | DB-MIG-02 | same |
| `passwordHash` bcrypt, **length 60** | `passwordHash String @db.VarChar(60)` | DB-MIG-02 (`char_length = 60`) | same |
| `isActive` boolean default `true` | `isActive Boolean @default(true)` | DB-MIG-02 | same |
| `mustChangePassword` boolean default `true` | `mustChangePassword Boolean @default(true)` | DB-MIG-02 | same |
| `createdAt` timestamp, no, now | `createdAt DateTime @default(now()) @db.Timestamptz(3)` | DB-MIG-02 | same |
| `updatedAt` timestamp, no, on change | `updatedAt DateTime @updatedAt @db.Timestamptz(3)` | DB-MIG-02 | same |
| Relations: owns `Ticket[]` (requester), owns `Attachment[]` (uploader/remover), authors `Comment[]`/`InternalNote[]` | relation fields `requesterTickets`, `ownedTickets`, `uploadedAttachments`, `removedAttachments`, `comments`, `internalNotes` | DB-MIG-02 | same |
| Index `@@unique([email])` | present | DB-MIG-02 | same |

### B.3 `Enums`, `Comment`, `InternalNote`, `Ticket`, `Attachment`

| Frozen requirement | Implementation | Test | Evidence |
|---|---|---|---|
| `Role = REQUESTER \| IT_STAFF \| ADMINISTRATOR` | `enum Role` Phase A | DB-MIG-02 | `db-mig-execution.txt` |
| `TicketStatus` extended to 8 values; never drop `NEW` | Phase A `ALTER TYPE … ADD VALUE` (7 added; `NEW` retained) | DB-MIG-02 | same |
| `Comment`/`InternalNote`: `id`, `ticketId → Ticket.id`, `authorId → User.id`, `content` 1–2000, `createdAt` timestamptz, `@@index([ticketId])` | Phase A tables + indexes | DB-MIG-02 | same |
| `Ticket.appearsResolved` `Boolean NOT NULL @default(false)` | Phase A nullable → Phase C backfill `false` + `NOT NULL DEFAULT false` | DB-MIG-02 | same |
| `Ticket` indexes incl. `@@index([ticketOwnerId])`; no `itPriority` index | Phase C adds `Ticket_ticketOwnerId_idx` | DB-MIG-02 | same |
| `Attachment.uploaderUserId` NOT NULL after backfill; `removedByUserId` nullable; `isRemoved` **verify-and-preserve**; `uploadedAt`/`removedAt` timestamptz; `@@index([ticketId])` | Phase A shadow cols + Phase C constraints; `isRemoved` untouched (already present) | DB-MIG-02 (incl. row-level `isRemoved = (removedAt IS NOT NULL)`) | same |
| No hard deletion; no cascade | FKs `ON DELETE RESTRICT`; Phase C re-adds `Attachment_uploaderUserId_fkey … ON DELETE RESTRICT` | DB-MIG-02 | same |

## C. `specification.md` §13 — Decisions consumed by #35

| Decision | Requirement | Implementation | Test | Evidence |
|---|---|---|---|---|
| 12 | Password policy 12–128, 4 char classes, not trimmed, whitespace permitted, no history rule | `validatePasswordPolicy()` in `auth-service.ts` (single reused function) | API-AUTH-07, `auth.unit.test.ts` | `server-vitest.txt` |
| 13 | Deterministic initial-password formula | `deriveInitialPassword()` | DB-MIG-03 | `db-mig-execution.txt` |
| 16 | Multiple concurrent sessions remain valid | `express-session` (no session invalidation on login) | API-AUTH-09 | `server-vitest.txt` |
| 17 | Email-collision → manual data cleanup, no silent overwrite/skip/merge | `MigrationCollisionError` + DM-18 runbook | DB-MIG-05 | `db-mig-execution.txt` |

## D. `api-spec.md` §0 — Conventions + frozen status/`error.code` table

| Frozen requirement (quoted) | Implementation | Test | Evidence |
|---|---|---|---|
| "401 \| No valid session / not authenticated \| `UNAUTHENTICATED`" | `requireAuth` | API-AUTH-05, SEC-AUTHZ-06 | `server-vitest.txt` |
| "401 \| Authenticated but must change password before proceeding \| `PASSWORD_CHANGE_REQUIRED`" | `requirePasswordChanged` | API-AUTH-06, DB-MIG-04 | `server-vitest.txt`, `db-mig-execution.txt` |
| "A missing or invalid CSRF token rejects the request with `403 FORBIDDEN`." | `requireCsrf` | Supplementary AU-19 (change-password), API-AUTH-04 (logout) | `server-vitest.txt` |
| "login failure returns a generic message that does not reveal whether the email exists or the password was wrong." | `verifyCredentials` + inactive indistinguishable | API-AUTH-02, API-AUTH-03 | `server-vitest.txt` |
| "a user may hold **multiple concurrent sessions** … Logging in from a second device does **not** invalidate an existing session" | session store retains both | API-AUTH-09 | `server-vitest.txt` |
| "30 minutes of idle time … Any request refreshes the idle timer." | `rolling: true`, `maxAge` 30 min, TTL 1800 s | SEC-AUTHZ-06 (behavioral expiry + config assertions) | `server-vitest.txt` |
| Session cookie `httpOnly`, `SameSite`-protected, `Secure` in production | cookie config in `session.ts` (`secure: isProduction`) | SEC-AUTHZ-06 (supplementary config) | `server-vitest.txt` |
| Standard error shape `{ error: { code, message, fields? } }` | canonical error objects in controllers | API-AUTH-02/06/08, AU-19 | `server-vitest.txt` |

## E. `api-spec.md` §1–§4 — The four auth endpoints

| Endpoint (frozen) | Implementation | Test | Evidence |
|---|---|---|---|
| §1 `POST /api/auth/login` — `200 {data:{id,name,email,role,mustChangePassword}}`; `400 VALIDATION_ERROR`; `401 UNAUTHENTICATED` (safe generic); a DB failure → canonical `500 INTERNAL_ERROR` | `login()` in `auth.controller.ts` (try/catch) | API-AUTH-01, API-AUTH-02, API-AUTH-03, API-AUTH-10 | `server-vitest.txt` |
| §2 `POST /api/auth/logout` — `200 {data:{success:true}}`; `401` without session; a session-store failure → canonical `500 INTERNAL_ERROR` | `logout()` (`req.session.destroy()`, try/catch) | API-AUTH-04, API-AUTH-12 | same |
| §3 `GET /api/auth/me` — `200` identity + role; `401` without session; reissues the session's existing `X-CSRF-Token` | `me()` (fresh-User read + `issueCsrfToken()`) | API-AUTH-05, API-AUTH-05b, CSRF-ME-01 | same |
| §4 `POST /api/auth/change-password` — `200 {data:{success:true, mustChangePassword:false}}`; frozen password policy; wrong current → `400 VALIDATION_ERROR` generic; a DB failure → canonical `500 INTERNAL_ERROR` | `changePasswordHandler()` (try/catch) | API-AUTH-07, API-AUTH-08, API-AUTH-11 | same |

## F. Frozen `tests.md` file paths (never renamed)

| Test row | Frozen Automated Test File | Present? |
|---|---|---|
| DB-MIG-01..10 | `server/tests/lab-03/migration.integration.test.ts` | ✅ |
| SEED-01 | `server/tests/lab-03/seed.integration.test.ts` | ✅ |
| API-AUTH-01..12 + API-AUTH-05b + SEC-AUTHZ-06 | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/auth-error-handling.api.test.ts` | ✅ |
| SEC-AUTHZ-11 | `server/tests/lab-03/session-secret.unit.test.ts` | ✅ |
| SEC-AUTHZ-12 | `server/tests/lab-03/auth-timing.unit.test.ts` | ✅ |
| TKT-PRIO-01..03 | `server/tests/lab-03/ticket-priority.integration.test.ts` | ✅ |
| UNIT-AUTH-01 | `server/tests/lab-03/auth.unit.test.ts` | ✅ |
| UNIT-API-ERROR-01..03 + CSRF-ME-01 | `client/src/lab-03-tests/ApiClient.test.ts` | ✅ |
| UI-LOGIN-01 | `client/src/lab-03-tests/Login.test.tsx` | ✅ |
| UI-CHPWD-01/02 | `client/src/lab-03-tests/ChangePassword.test.tsx` | ✅ |
| UI-AUTHGATE-01/02 | `client/src/lab-03-tests/AuthGate.test.tsx` | ✅ |
| SEC-AUTHZ-07 | `server/tests/lab-03/authorization.api.test.ts` | ⏳ **owned by #37** — #35 contributes only supplementary CSRF assertions inside `auth.api.test.ts` |
| E2E-01..04 | `e2e/lab-03/*.spec.ts` | ⏳ **owned by #42** — not claimed by #35 |

## G. Scope boundaries honored

- No Prisma upgrade (pinned 5.22 — proven in `../migration/scratch-db-proof.md`).
- No E2E spec created by #35 (`e2e/lab-03/authentication.spec.ts` is #42's frozen path; the
  reviewer's suggested `auth-flow.spec.ts` name is **not** the frozen path and was not created).
- No removal of the DM-17 compatibility set (owned by #37 Rev 12 RR-01).
- Legacy response key `removedByRequesterId` retained **only** where existing Lab 2 tests
  assert it (`service.ts`); see `grep-gate.txt`.
