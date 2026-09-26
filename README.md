# TokTickIT - Full Stack Hello World Starter

This repository contains the integrated Lab 3 TokTickIT ticketing application. Lab 3 adds
session authentication, role-based Requester/IT Staff/Administrator screens, Staff ticket
operations, Administrator user management, and a data-preserving Lab 2 migration.

## 1. Current Scope
The current contract is defined in:
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`
- `docs/lab-03/ui-spec.md`
- `docs/lab-03/tests.md`

The application supports authenticated Requester ticket and attachment workflows, Staff Queue
and Ticket Detail operations, Administrator User Management, role/ownership authorization,
public comments, internal notes, and the Lab 3 migration/seed contract. The Lab 2 requester
ticket and attachment behavior remains supported under session identity.

## 2. Verification Status

> **Superseded in Lab 3 (Issues #35 / #37).** The Development Requester selector,
> the `X-Dev-Requester-Id` header, and `GET /api/dev-requesters` /
> `GET /api/requester-context` were removed in Lab 3. Identity is now established by a
> real session (login → httpOnly cookie + CSRF token), and reference-data and Ticket
> routes require an authenticated session. The Lab 2 details below are historical implementation
> notes; the current contract is in `docs/lab-03/`.

Issue #42 final-head evidence at implementation SHA `ce2e40ddf049cf7cf62b43280a563b750622a0a4`
records 598/598 server tests, 252/252 client tests, 34/34 UI style tests, 54/54 Lab 3 Playwright
tests, 210/210 configured Playwright tests, 19/19 REL-12 migration tests, successful builds, and
Prisma validation. Historical browser counts refer to distinct runs: 183/183 full configured,
27/27 earlier Lab 3, and 42/42 later Lab 3. Human reviewer @oangsa approved PR #56 current head
`466695c` with `LGTM!` on 2026-09-26. PDF Parts 1–9 and Kanban completion remain user-owned;
final merge and post-merge verification remain incomplete. See
`artifacts/lab-03/release/verification-summary.md` for evidence scope.

Historical Lab 2 implementation details follow:
- `GET /api/categories` (active-only; **requires an authenticated session** in Lab 3)
- ~~`GET /api/dev-requesters`~~ (removed in Lab 3)
- `GET /api/related-systems` (active-only; **requires an authenticated session** in Lab 3)
- ~~`GET /api/requester-context`~~ (removed in Lab 3)
- `POST /api/tickets` (create ticket with integer lexical validation, trim-then-validate normalization, category/related-system reference checks, JSON request-parsing contract enforcement, single-transaction atomic allocation; **requires an authenticated session**)
- `GET /api/tickets/:ticketNumber` (detail with requester ownership enforcement, attachment removal metadata; **requires an authenticated session**)
- `GET /api/tickets` (My Tickets list with search, filter, sort, pagination, ownership enforcement, `unfilteredTotalItems`; **requires an authenticated session**)
- Prisma models: `Category`, `User`, `RelatedSystem` (all with `isActive`), `Ticket`, `Attachment`, `TicketSequence`
- Atomic ticket number generation: `TKT-<UTC-year>-<6-digit seq>` via `INSERT ... ON CONFLICT ... RETURNING` inside a single database transaction with one authoritative timestamp
- Ticket indexes: `@@index([requesterId])`, `@@index([currentStatus])`, `@@index([createdAt])`
- Attachment model: `storedFilename @unique`, `@@index([ticketId])`, `uploaderUser` and `removedByUser` relations to `User`
- Seed data: 4 categories, 4 active + 1 inactive Requesters, 3 active + 1 inactive IT Staff, 1 Administrator, related systems (idempotent upserts)
- Frontend: Login screen + authenticated application shell (identity + Logout) + Create Ticket form + Ticket Detail view + My Tickets screen
- Identity is carried by the session cookie (set by the server) and the CSRF token is echoed on state-changing calls
- View Ticket action navigates to Ticket Detail with loading/error/not-found states
- My Tickets frontend screen with sortable table, mobile cards, loading/empty/no-results/error states, and pagination footer

**New in this release (Issue #15 — Attachment Lifecycle & Ticket Detail — Post-Review Fixes):**
- `POST /api/tickets/:ticketNumber/attachments` — Upload attachment (multipart, single file) with type/size/content-signature validation, 5-active limit, sequential processing
- `GET /api/tickets/:ticketNumber/attachments` — List attachments (active + removed), deterministic `uploadedAt ASC, id ASC` ordering
- `GET /api/attachments/:attachmentId/download` — Download attachment with ownership re-validation, `Content-Disposition` with RFC 5987 UTF-8 `filename*`, removed → `410 ATTACHMENT_REMOVED`
- `GET /api/attachments/:attachmentId/preview` — Preview attachment: image inline or **PDF first page rendered as PNG via a bundled PDFium WebAssembly renderer (`clawpdf`)** (replaces the old full-PDF fallback); satisfies FR-12/BR-28/AC-24; PDF rendering failure returns `500 INTERNAL_ERROR` (never the original PDF)
- `DELETE /api/attachments/:attachmentId` — Soft-remove with optional reason (normalization: omitted/blank → null, 1–200 chars after trim, non-string → 400), removed → `409 CONFLICT`
- Secure filesystem storage with compensating write-then-persist strategy (physical file written before metadata; metadata failure deletes the file)
- Uploaded files renamed to UUID + validated extension; original filename is display metadata only
- Content-signature validation (FF D8 FF for JPEG, PNG magic bytes, RIFF+WEBP for WebP, %PDF- for PDF)
- **Concurrency-safe attachment limit**: `SELECT ... FOR UPDATE` row lock on the parent `Ticket` row serializes concurrent attachment-count checks (BR-12/AC-08). Two concurrent uploads when 4 are active → exactly 1 succeeds, 1 gets `ATTACHMENT_LIMIT_REACHED`, never >5 active rows
- **Fixed client API argument order**: `previewAttachmentFile(requesterId, attachmentId)` and `downloadAttachmentFile(requesterId, attachmentId)` were called with reversed arguments in `App.tsx`. Both are `number`, so TypeScript could not catch the bug. Fixed to `previewAttachmentFile(activeRequester.id, att.id)` etc.
- **Failed attachment retry from Ticket Detail (BR-17/UI-ATT-05)**: Failed uploads from Create Ticket Case B are tracked with original file metadata and displayed with a Retry button in Ticket Detail. Retry re-uploads only that file without recreating the ticket.
- **Fixed `activeFileCount` double-counting**: `validFiles.length` already includes all valid pending files; the old code incorrectly added `uploadResults.filter(r.status === "success").length` on top of it.
- Client-side attachment validation (type/size before network), drag-and-drop, sequential upload with per-file status, Case B partial-success UI
- Ticket Detail: Preview/Download/Remove actions, add attachment control with validation, removal confirmation dialog with optional reason
- **Unavailable attachment state (ui-spec §5.3)**: A Preview/Download failure against an active attachment renders an Unavailable badge with Preview/Download disabled and no Retry action; an Add Attachment upload failure in Ticket Detail renders an Unavailable row with a Retry action that re-uploads only that file
- **Removal dialog accessibility**: focus moves into the dialog on open, Tab/Shift+Tab trap focus within it, Escape closes it, and focus is restored to the Remove button on close
- **Ownership before multipart validation**: the upload route now performs a ticket-ownership pre-check BEFORE multer parses the request body, so a non-owned/missing ticket returns the same `404 NOT_FOUND` regardless of whether the file is valid, missing, oversized, or an unsupported type (no information leakage). The transactional ownership check inside the service remains authoritative.
- **Atomic conditional soft removal**: `removeAttachment` now uses a single conditional `UPDATE ... WHERE isRemoved = false` instead of a read-then-unconditional-update, so exactly one concurrent removal wins (one `200`, one `409`).
- **Transaction-wide filesystem compensation**: every physical file written during an upload is tracked and deleted if ANY part of the transaction fails — including a failure AFTER the metadata insert succeeds but before commit (no orphaned files).
- **Client attachment capacity enforcement**: Create Ticket and Ticket Detail both enforce the five-active-attachment limit client-side; the sixth file is rejected and never reaches the upload API.
- **Scoped failed-attachment retry**: failed uploads are scoped to the requester + ticket that produced them; navigating to another ticket or switching requester never shows or retries another ticket's failure.
- **Mutation/refresh separation**: a successful upload/remove is terminal — a subsequent refresh failure is shown as a detail error, never as a retryable mutation failure.
- **Retry upload terminal-state (re-review fix)**: both retry handlers (Create Ticket Case B and Ticket Detail Add Attachment) now separate the mutation boundary from the refresh boundary — a successful retry upload permanently clears the failed row, and a refresh failure is shown as a detail error that never restores the retry row (no duplicate re-upload).
- **Attachment ID range validation**: a shared `parseAttachmentId` helper validates the decimal grammar, `Number.isSafeInteger`, and the PostgreSQL `INTEGER` max (`2147483647`) for download/preview/delete, so oversized digit strings return `404 NOT_FOUND` (never a `500`) and never reach Prisma.
- **DELETE content-type handling**: per api-spec §0, an omitted body (no content type) and a JSON body with `application/json` are accepted; a body with a non-JSON content type or no content type returns `400 VALIDATION_ERROR` and never reaches the removal service.
- **RFC 5987 download filename parsing**: the client now prefers the `filename*` UTF-8 value (decoded) over the ASCII `filename` fallback via `parseContentDispositionFilename`.
- **Upload-result type alignment**: the client `AttachmentUploadResult` now matches the server contract (`ticketId` present, `storedFilename` absent).
- **Server tests**: 335 tests across 26 files pass (including real-DB ownership, concurrent-removal, transaction-wide compensation, UUID stored-filename, cross-requester list/download/preview/delete ownership, extension/signature validation matrix, DELETE content-type, and attachment-ID range tests)
- **Client tests**: 100 tests across 8 files — AttachmentSection and CreateTicket cover the full attachment state matrix, five-file capacity, retry ownership scoping (ticket + requester switch), mutation/refresh separation, retry terminal-state, the complete UI-DETAIL-01 matrix, UI-TKT-08 submission orchestration, and RFC 5987 filename parsing
- **Case B ticket-persistence traceability**: the created ticket is kept on attachment failure (no duplicate create) is proven by the executable client Case-B tests (`UI-TKT-06`, `UI-ATT-05`, `UI-ATT-06`, `UI-ATT-RETRY-OWN`, which run the real post-create attachment flow). The server `API-ATT-06` test is an endpoint-isolation check only and does not by itself assert ticket persistence.

Completed in Issue #18 (final integration/release verification) at the authoritative verification baseline `8cdebe824272cf101570bb78772379a9090b497f`:
- Full E2E test suite (Playwright) — **159 passed, 0 failed** (desktop/tablet/mobile)
- Cross-endpoint API contract matrix — server **335 passed** / client **100 passed**
- Visual/responsive screenshot evidence — **82 screenshots** (26 states × 3 viewports + 4 E2E workflow shots)
- Final release verification checklist — `artifacts/lab-02/release/` (acceptance-matrix, integration-flow-results, verification-summary, final-gate, clean-checkout-results, documentation-audit, environment, kanban-verification)

## 3. Repository Structure

```text
.
|- artifacts/
|  |- lab-02/
|  |  |- release/            # final release verification evidence
|  |  |- screenshots/        # visual/responsive evidence (regenerated by E2E)
|- client/
|  |- src/
|  |  |- api.ts
|  |  |- App.css
|  |  |- App.test.tsx
|  |  |- App.tsx
|  |  |- CreateTicket.tsx
|  |  |- format.ts
|  |  |- main.tsx
|  |  |- MyTickets.tsx
|  |  |- vite-env.d.ts
|  |  |- lab-02-tests/
|  |  |  |- AttachmentSection.test.tsx
|  |  |  |- CreateTicket.test.tsx
|  |  |  |- format.test.ts
|  |  |  |- MyTickets.test.tsx
|  |  |  |- RequesterSelection.integration.test.tsx
|  |  |  |- RequesterSelection.test.tsx
|  |  |  |- UiStyles.test.tsx
|  |  |- lab-03-tests/
|  |  |  |- ApiClient.test.ts
|  |  |  |- AuthGate.test.tsx
|  |  |  |- ChangePassword.test.tsx
|  |  |  |- Login.test.tsx
|  |- package.json
|  |- tsconfig.json
|  |- vite.config.ts
|  |- vitest.config.ts
|- docs/
|  |- lab-01/
|  |- lab-02/
|  |  |- ai-use.md
|  |  |- api-spec.md
|  |  |- reviewer.md
|  |  |- specification.md
|  |  |- tests.md
|  |  |- ui-spec.md
|  |- lab-03/
|     |- ai-use.md
|     |- api-spec.md
|     |- reviewer.md
|     |- specification.md
|     |- tests.md
|     |- ui-spec.md
|- e2e/
|  |- lab-02/
|  |  |- attachment-lifecycle.spec.ts
|  |  |- global-setup.ts     # ensures two E2E Requester accounts (mustChangePassword = false)
|  |  |- helpers.ts
|  |  |- keyboard-access.spec.ts
|  |  |- ownership.spec.ts
|  |  |- partial-success-attachment.spec.ts
|  |  |- requester-ticket-flow.spec.ts
|  |  |- responsive-visual.spec.ts
|  |- lab-03/                 # owned by #42 (E2E-01..04); not created by #35
|- server/
|  |- prisma/
|  |  |- migrations/
|  |  |  |- 20260917000000_lab3_phase_a_expand/
|  |  |  |- 20260917000001_lab3_phase_c_contract/
|  |  |- schema.prisma
|  |  |- seed.ts
|  |- src/
|  |  |- app.ts
|  |  |- attachment-storage.ts
|  |  |- auth-service.ts
|  |  |- auth.controller.ts
|  |  |- config/
|  |  |- controller.ts
|  |  |- id-domain.ts
|  |  |- index.ts
|  |  |- integer-validation.ts
|  |  |- migrate-lab3.ts
|  |  |- module.ts
|  |  |- prisma.ts
|  |  |- service.ts
|  |  |- session.ts
|  |  |- test-seams.ts
|  |  |- ticket-number.ts
|  |- tests/
|  |  |- categories.integration.test.ts
|  |  |- categories.service.test.ts
|  |  |- categories.test.ts
|  |  |- fixtures/
|  |  |- lab-02/
|  |  |  |- api-contract.api.test.ts
|  |  |  |- attachment-concurrency.integration.test.ts
|  |  |  |- attachment-ownership.integration.test.ts
|  |  |  |- attachment-persistence-compensation.integration.test.ts
|  |  |  |- attachment-validation.unit.test.ts
|  |  |  |- attachments.api.test.ts
|  |  |  |- create-ticket-normalization.api.test.ts
|  |  |  |- create-ticket-real-db.integration.test.ts
|  |  |  |- create-ticket-reference-validation.integration.test.ts
|  |  |  |- create-ticket-validation.unit.test.ts
|  |  |  |- create-ticket.api.test.ts
|  |  |  |- database-migration.integration.test.ts
|  |  |  |- dev-requesters.api.test.ts
|  |  |  |- dev-requesters.service.test.ts
|  |  |  |- integer-validation.api.test.ts
|  |  |  |- my-tickets-real-db.integration.test.ts
|  |  |  |- my-tickets.api.test.ts
|  |  |  |- reference-data.api.test.ts
|  |  |  |- requester-context.api.test.ts
|  |  |  |- requester-selection.integration.test.ts
|  |  |  |- seed.integration.test.ts
|  |  |  |- ticket-detail.api.test.ts
|  |  |  |- ticket-number-concurrency.integration.test.ts
|  |  |- lab-03/
|  |  |  |- auth.api.test.ts
|  |  |  |- auth.unit.test.ts
|  |  |  |- migration.integration.test.ts
|  |  |  |- seed.integration.test.ts
|  |- package.json
|  |- tsconfig.json
|  |- vitest.config.ts
|- playwright.config.ts
|- package.json
|- README.md
```

## 4. Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL 12+

## 5. Setup

### Backend
```bash
cd server
npm install
```

Create `server/.env` (based on `.env.example` if present) with:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
E2E_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/lab3e2e?schema=public"
PORT=3000
```

`E2E_DATABASE_URL` must point to the separate disposable `lab3e2e` database. Playwright does
not fall back to `DATABASE_URL`; never point E2E tests at a development or production database.

Run migration and seed:

```bash
cd server
npm run prisma:migrate
npm run prisma:seed
```

### Frontend
```bash
cd client
npm install
```

Create `client/.env` with:

```env
VITE_API_URL="http://localhost:3000"
```

## 6. Run

Terminal 1:
```bash
cd server
npm run dev
```

Terminal 2:
```bash
cd client
npm run dev
```

- API base: `http://localhost:3000/api`
- Frontend: `http://localhost:5173`

## 7. Testing (Current)

Backend current tests:
```bash
cd server
npm test
```

Frontend current tests:
```bash
cd client
npm test
```

End-to-end tests (Playwright, desktop/tablet/mobile):
```bash
npm run test:e2e -- --workers=1
```

Recorded Lab 3 run counts above are historical. Check `docs/lab-03/tests.md` and
`artifacts/lab-03/release/` for source revisions, raw outputs, and outstanding gates before
using any result as release evidence.

## 8. API Implemented Today

> **Superseded in Lab 3 (Issues #35 / #37).** The `X-Dev-Requester-Id` header and the
> `GET /api/dev-requesters` / `GET /api/requester-context` endpoints were removed.
> `GET /api/categories`, `GET /api/related-systems`, and all Ticket/Attachment routes
> now require an authenticated session (login → session cookie + CSRF token). See
> §11–§13 for the current Lab 3 authentication, Staff operations, and browser-test setup.

### `GET /api/categories`
Returns active categories only. **Requires an authenticated session** (Lab 3). Response example:

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

### ~~`GET /api/dev-requesters`~~
Removed in Lab 3 (#37). The Development Requester selector and its endpoints no longer exist.

### ~~`GET /api/requester-context`~~
Removed in Lab 3 (#37). Identity now comes from the authenticated session.

### `GET /api/related-systems`
Returns active related systems only. **Requires an authenticated session** (Lab 3). Response example:

```json
{
  "data": [
    { "id": 1, "name": "Corporate Laptop" },
    { "id": 2, "name": "Campus Wi-Fi" }
  ]
}
```

### `POST /api/tickets`
Creates a ticket for the authenticated Requester (Lab 3: session required; any body-supplied
`requesterId` is ignored).
Request body:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot log in",
  "description": "Login fails after password reset",
  "requestedPriority": "HIGH"
}
```

Returns `201` with `{ "data": { ...ticket, "ticketNumber": "TKT-2026-000001" } }`.
Validation is trim-then-validate: summary (5-120 chars) and description are trimmed
before validation and persisted trimmed. Referencing a nonexistent or inactive
`categoryId`/`relatedSystemId` returns `409 INACTIVE_REFERENCE`.

### `GET /api/tickets/:ticketNumber`
Returns ticket detail for the authenticated Requester (Lab 3: session required).
Enforces ownership: a ticket owned by another requester returns `404 NOT_FOUND`.
Malformed `ticketNumber` path parameters return `404 NOT_FOUND`.

### `GET /api/tickets`
Returns the authenticated Requester's paginated ticket list (Lab 3: session required).
Supports search (`?search=`), filter (`?categoryId=`, `?requestedPriority=`, `?status=`),
sort (`?sort=createdAt|ticketNumber|summary|requestedPriority`, `?order=asc|desc`),
and pagination (`?page=`, `?pageSize=`). Returns `{ data: [...], pagination: { page, pageSize, totalItems, totalPages, unfilteredTotalItems } }`.

### `POST /api/tickets/:ticketNumber/attachments`
Uploads a single attachment (multipart) for the authenticated Requester's ticket (Lab 3:
session required). Validates type/size/content-signature, enforces a 5-active
limit (concurrency-safe via a row lock on the parent ticket), and stores the file
under a UUID + validated extension. Returns `201` with the attachment metadata.

### `GET /api/tickets/:ticketNumber/attachments`
Lists the ticket's attachments (active + removed) for the authenticated Requester, in
deterministic `uploadedAt ASC, id ASC` order.

### `GET /api/attachments/:attachmentId/download`
Downloads an attachment with ownership re-validation. Sets `Content-Disposition`
with RFC 5987 UTF-8 `filename*`. A removed attachment returns `410 ATTACHMENT_REMOVED`.

### `GET /api/attachments/:attachmentId/preview`
Previews an attachment: images inline, or the first page of a PDF rendered to PNG via
a bundled PDFium WebAssembly renderer (`clawpdf`). PDF rendering failure returns
`500 INTERNAL_ERROR` (never the original PDF).

### `DELETE /api/attachments/:attachmentId`
Soft-removes an attachment with an optional reason (normalized to `null` when
omitted/blank, 1–200 chars after trim). A removed attachment returns `409 CONFLICT`.

## 9. Lab 2 Implementation Order (Recommended)
1. ~~Requirement baseline + docs alignment~~ ✅
2. ~~Requester identity mechanism (`X-Dev-Requester-Id`) and selector flow~~ ✅ (removed in Lab 3)
3. ~~`DevRequester` model~~ ✅ (migrated to `User` in Lab 3) / ~~remaining data models (`RelatedSystem`, `Ticket`, `Attachment`)~~ ✅
4. ~~Ticket creation API + UI + validation~~ ✅
5. ~~Ticket number generation (`ticket-number.ts`)~~ ✅
6. ~~Ticket detail API~~ ✅
7. ~~My Tickets API + UI + query behavior~~ ✅
8. ~~Attachment lifecycle API + UI~~ ✅
9. ~~Responsive/visual/accessibility pass~~ ✅
10. ~~Full Lab 2 test evidence and docs completion~~ ✅

## 10. Notes
- The Development Requester selector is historical and was removed in Lab 3.
- Keep ownership enforcement server-side for all requester-owned resources.
- Current requirements and verification records live under `docs/lab-03/`.

## 11. Lab 3 — Identity, Database Migration & Authentication (Issue #35)

Issue #35 replaces the Lab 2 `X-Dev-Requester-Id` dev identity with real session
authentication and migrates `DevRequester` → `User`.

### 11.1 Database migration (two-phase, tracked)

The migration is applied by the orchestrator, never by a plain `prisma migrate deploy`
with Phase C pending:

```
cd server && npm run migrate:lab3 -- run
```

- **Phase A** (`20260917000000_lab3_phase_a_expand`, additive-only): adds `User`, `Role`,
  `Comment`, `InternalNote`, `Ticket.appearsResolved` (nullable), the remaining 7
  `TicketStatus` values, and `Attachment.uploaderUserId`/`removedByUserId` shadow columns.
- **Backfill** (single transaction): every `DevRequester` row becomes a `User` with
  **exact ID preservation**, `role = REQUESTER`, `mustChangePassword = true`, and a
  deterministic password.
- **Phase C** (`20260917000001_lab3_phase_c_contract`): finalizes constraints, converts all
  §9.3 timestamps to `timestamptz(3)` (UTC-preserving), drops the legacy Attachment
  requester columns, and drops `DevRequester`.

**Collision recovery (DM-18):** if the Stage-2 scan finds an email/ID collision, the
orchestrator aborts loudly (`MigrationCollisionError`) and leaves the database in the
documented Phase-A-applied state. Resolve the collision source (manual data fix or user
decision), then re-run the orchestrator — Stage 1 recognizes the Phase-A-applied state and
resumes at Stage 2. **Never** un-apply tracked migrations or hand-edit `_prisma_migrations`.

**Resume identity verification:** when Stage 1 finds the backfill-complete state (Phase A
applied, `User` row count equal to the legacy `DevRequester` count, Phase C unapplied), it does
not resume on the count alone. `verifyBackfillIdentity()` asserts that every legacy
`DevRequester` row has a `User` with the **same `id`**, `role = 'REQUESTER'`, the same
normalized email, the same trimmed `name` and `isActive`, `mustChangePassword = true`, and a
bcrypt-verifiable deterministic initial password. If any row does not match, the orchestrator
throws `MigrationStopAndReportError` naming the mismatched id(s) and leaves the database
untouched — it never resumes at Phase C with a wrong identity mapping.

**Attachment ownership verification:** before Phase C drops the legacy Attachment requester
columns, `verifyAttachmentOwnership()` asserts that `uploaderUserId` and `removedByUserId`
exactly mirror `uploaderRequesterId` and `removedByRequesterId` for every row, and that a
non-null `removedByUserId` resolves to a `User`. The comparison uses `IS DISTINCT FROM` (a plain
`<>` returns NULL when the remover is NULL and would silently pass). The guard runs on the resume
path and again immediately before Phase C is applied, so the drop cannot lose the true
ownership/removal attribution through any entry path.

**`User.id` sequence re-sync:** the backfill inserts Users with **explicit** ids (exact ID
preservation), which does not advance the `User_id_seq` sequence. `syncUserIdSequence()` therefore
runs on **every** entry path (fresh, collision-resume, and Phase-C-resume) immediately before
Phase C, using the three-argument `setval` form so the next id is exactly `MAX(id) + 1` (and `1`
on an empty table). Because it is idempotent and unconditional, a crash in the window between the
backfill commit and the sync — or a database already stuck in that state — is repaired by the next
run. Without it, the first insert that relies on `@default(autoincrement())` (the app's user
creation, and the seed) would reuse a taken id and fail with a duplicate key on `User_pkey`.
`postChecks()` additionally asserts the sequence's next value is greater than `MAX(id)`, so
removing the sync later fails loudly at migration time rather than silently at first user creation.

### 11.2 Session and CSRF configuration (concrete, frozen policy)

- **Session store:** `express-session` + `connect-pg-simple` (`session` table,
  `createTableIfMissing: true`), TTL 1800 s, `rolling: true`, `disableTouch: false`.
- **Cookie:** `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production,
  `maxAge = 30 * 60 * 1000` (30-minute rolling idle expiry; no absolute timeout).
- **CSRF:** session-bound synchronizer token issued via the `X-CSRF-Token` response header on
  `login` **and `me`**; echoed on state-changing calls; missing/invalid → `403 FORBIDDEN`.
  `GET /api/auth/me` re-sends the session's **existing** token (it does not regenerate one), so a
  page reload — where the client calls `fetchMe()` on mount and has no stored token — can still
  perform authenticated mutations.
- **`SESSION_SECRET`:** server-only; `.env.example` carries a placeholder only. The server
  refuses to boot without a real secret (>= 32 chars) in non-test environments; tests inject
  a deterministic test-only secret.

### 11.3 Auth endpoints

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/auth/login` | public; safe generic `401 UNAUTHENTICATED` for invalid credentials or inactive account |
| POST | `/api/auth/logout` | authenticated + CSRF |
| GET | `/api/auth/me` | authenticated; reissues the session's existing `X-CSRF-Token` |
| POST | `/api/auth/change-password` | authenticated + CSRF |

Gate rejections: `requireAuth` → `401 UNAUTHENTICATED`; `requirePasswordChanged` →
`401 PASSWORD_CHANGE_REQUIRED`; `requireCsrf` → `403 FORBIDDEN`.

**Logout failure behavior (BR-33/AC-06):** if `POST /api/auth/logout` fails, the client keeps the
authenticated shell and shows an inline error near the Logout button. Client state is not cleared
until the server confirms logout succeeded — a failed logout is never presented as success.

### 11.4 Local development credentials (no real secrets)

Seeded users are created with the deterministic password
`Lab3-` + first 20 hex chars of `SHA-256(lowercase(trim(email)) + ":" + trim(name))`
(frozen §13 decision 13). The seed provides 4 active + 1 inactive Requesters, 3 active + 1
inactive IT Staff, and 1 active Administrator. Example: `ada@example.com` /
`Lab3-18ea620d20bd6a06d667`. These are development-only values.

Downstream issues (#37/#38/#41) consume the shared client transport `client/src/api-client.ts`
and the fresh-User session authority rule delivered here.

## 12. Lab 3 — IT Staff Ticket Operations (Issue #38)

IT Staff and Administrators operate the Ticket Queue and Ticket Detail. All routes below require
an authenticated session and the password-change gate; state-changing routes additionally require
CSRF.

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/staff/queue` | IT Staff / Administrator | Search, status/priority/owner filters, sort, pagination. Invalid query values fall back to safe defaults and never return `400`. |
| GET | `/api/staff/owners` | IT Staff / Administrator | Eligible Ticket-owner set: active IT Staff/Administrators as `{id, name, role}`. Read-only; no credential field. |
| GET | `/api/staff/tickets/:ticketNumber` | IT Staff / Administrator | Staff Ticket Detail, including Public Comments and Internal Notes. |
| POST | `/api/staff/tickets/:ticketNumber/owner` | IT Staff / Administrator + CSRF | Claim/assign/reassign. `ownerId` must reference an active IT Staff/Administrator. Last-write-wins; no unassign. |
| PATCH | `/api/staff/tickets/:ticketNumber/priority` | IT Staff / Administrator + CSRF | Sets IT Priority only; Requested Priority is never touched. |
| PATCH | `/api/staff/tickets/:ticketNumber/status` | IT Staff / Administrator + CSRF | Permitted transitions only; the Ticket must be owned first. |
| POST/GET | `/api/tickets/:ticketNumber/comments` | owner Requester or IT Staff/Administrator | Public Comments. |
| POST/GET | `/api/staff/tickets/:ticketNumber/notes` | IT Staff / Administrator | Internal Notes; never reach a Requester payload. |
| POST | `/api/tickets/:ticketNumber/appears-resolved` | owner Requester + CSRF | Boolean indicator; never changes the formal status. |

**Eligible-owner lookup (`GET /api/staff/owners`).** Added by Issue #38 under the closed-contract
edge-case policy (`specification.md` §13 decision 20, `api-spec.md` §17a). The frozen contract
exposed no staff-accessible user list — `GET /api/admin/users` is Administrator-only and
`GET /api/app/context` returns only the caller's own identity — so the Queue owner filter and the
Detail ownership control could not otherwise offer owners who own no Tickets. The endpoint is a
**UX affordance only**: `POST /api/staff/tickets/:ticketNumber/owner` remains the final
authorization boundary and independently rejects ineligible targets with `409 CONFLICT`.

**Queue required information (ui-spec §5.6).** Each queue row carries `categoryName` and
`updatedAt` alongside the ticket number, summary, status, requested priority, IT priority, and
owner, so the desktop table and the mobile card can both present every required field.

**PR #49 review remediation (2026-09-23).** The remaining Issue #38 review findings are now
implemented and documented:

- Tablet widths (768–991px) use a condensed table by hiding secondary columns while retaining
  the core row and Open Detail action; mobile cards continue to expose all required fields.
- Queue HTTP 403 responses render distinct access-denied feedback without a misleading Retry
  action; other failures retain the retryable failure state.
- Status controls are disabled for unassigned Tickets with claim/assign guidance. The server's
  `409 CONFLICT` claim-before-status rule remains authoritative.
- Confirmation status refetches preserve a mounted focus target, so focus restoration cannot land
  on a detached control.
- `API-STAFF-11` exercises all 64 source/target status pairs plus every target on unowned Tickets
  against the shared `ticket-status.ts` matrix, asserting persistence or `409` with no mutation.

Focused Issue #38 remediation verification: client **178 passed** across 14 files, including the
52 Queue/Detail tests; server Staff Detail API **41 passed**. The server suite excluding the
known migration harness passed **514 tests across 37 files**; client and server TypeScript builds
also pass. Those are historical Issue #38 results. Issue #42 later ran the complete migration
integration file on a disposable Lab 2-shaped database: **19/19 passed**, including the deliberate
collision and recovery cases. See `artifacts/lab-03/release/rel-12-migration.md`.

## 13. Lab 3 integrated browser verification (Issue #42)

Playwright starts its own API and Vite servers and refuses to reuse an existing server. Set
`E2E_DATABASE_URL` to the disposable `lab3e2e` PostgreSQL database in `server/.env`. This variable
is required; setting only `DATABASE_URL` does not satisfy Playwright configuration. The suite
requires the documented Lab 3 schema before it runs and does not fall back to `DATABASE_URL`.
The same URL is passed to
the Lab 2 requester fixture setup and the API process; no suite should target a development or
production database.

Run `npm run test:e2e -- --workers=1` from the repository root. The initial suite is serial across
desktop (1280×800), tablet (820×1180), and mobile (390×844). The API readiness probe is
`/api/auth/me` and Vite readiness is the Login page at `http://127.0.0.1:5173`. Playwright owns
both processes and stops them after the run. The configuration refuses to start fixtures unless
`E2E_DATABASE_URL` is set.
