# TokTickIT - Full Stack Hello World Starter

This repository is now being aligned to Lab 2: TokTickIT Requester Ticketing MVP.

## 1. Scope for Lab 2
The target behavior is defined in these files:
- `docs/lab-02/specification.md`
- `docs/lab-02/api-spec.md`
- `docs/lab-02/tests.md`
- `docs/lab-02/ui-spec.md`

In summary, Lab 2 requires:
- Development requester selection (testing identity, not real auth)
- Create ticket flow (category, related system, summary, description, requested priority)
- Ticket number generation on backend
- My Tickets with search, filter, sort, pagination
- Ticket detail with ownership enforcement
- Attachment upload/list/preview/download/soft-remove
- Responsive Zen Green UI and keyboard-accessible flows

## 2. Current Implementation Status (as of 2026-08-30)
Implemented in code right now:
- `GET /api/categories` (active-only)
- `GET /api/dev-requesters` (active-only, `{ "data": [...] }` envelope)
- `GET /api/related-systems` (active-only, `{ "data": [...] }` envelope)
- `GET /api/requester-context` (requires `X-Dev-Requester-Id`, returns `422` if missing/unknown/inactive)
- `POST /api/tickets` (create ticket with integer lexical validation, trim-then-validate normalization, category/related-system reference checks, JSON request-parsing contract enforcement, single-transaction atomic allocation)
- `GET /api/tickets/:ticketNumber` (detail with requester ownership enforcement, attachment removal metadata)
- `GET /api/tickets` (My Tickets list with search, filter, sort, pagination, ownership enforcement, `unfilteredTotalItems`)
- Prisma models: `Category`, `DevRequester`, `RelatedSystem` (all with `isActive`), `Ticket`, `Attachment`, `TicketSequence`
- Atomic ticket number generation: `TKT-<UTC-year>-<6-digit seq>` via `INSERT ... ON CONFLICT ... RETURNING` inside a single database transaction with one authoritative timestamp
- Ticket indexes: `@@index([requesterId])`, `@@index([currentStatus])`, `@@index([createdAt])`
- Attachment model: `storedFilename @unique`, `@@index([ticketId])`, `uploaderRequester` and `removedByRequester` relations to `DevRequester`
- Seed data: 4 categories, 4 active + 1 inactive development requesters, related systems (idempotent upserts)
- Frontend: Development Requester Selection screen + application shell (requester identity, Change Requester) + Create Ticket form + Ticket Detail view + My Tickets screen
- Requester context is persisted in `sessionStorage` and sent via the `X-Dev-Requester-Id` header on requester-scoped calls
- View Ticket action navigates to Ticket Detail with loading/error/not-found states
- My Tickets frontend screen with sortable table, mobile cards, loading/empty/no-results/error states, pagination footer, and requester-switch data reset

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
|  |  |- requester-context.ts
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
PORT=3000
```

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
npm run test:e2e
```

Important:
- `docs/lab-02/tests.md` is the full Lab 2 test plan. Issue #12 was amended
  (2026-08-24) to scope down to the requester-selection foundation only. Its required
  rows (`API-REQ-01`, `UI-REQ-01..07`) are implemented and passing. The five
  cross-feature rows previously listed in #12 (`API-REQ-02`, `API-REQ-03`,
  `API-CONTRACT-01`, `UI-MY-03`, `E2E-05`) have been formally reassigned to #13, #14,
  and #18 where their dependent models/endpoints/screens exist.
- Server tests: 335 passing across 26 files; client tests: 100 passing across 8 files.
- Lab 2 E2E suite: 159 passing, 0 failing (desktop/tablet/mobile).
- Visual/responsive evidence: 82 screenshots (26 states × 3 viewports + 4 E2E workflow shots).
- Final release verification evidence lives in `artifacts/lab-02/release/` and was
  produced at the authoritative baseline `8cdebe824272cf101570bb78772379a9090b497f`.
- Lab 3 (Issue #35) current counts: server **403 passing across 34 files**; client
  **120 passing across 12 files**. Evidence bundle: `artifacts/lab-03/issue-35/`.

## 8. API Implemented Today

### `GET /api/categories`
Returns active categories only. Response example:

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

### `GET /api/dev-requesters`
Returns active development requesters only (no requester header required). Response example:

```json
{
  "data": [
    { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com" }
  ]
}
```

### `GET /api/requester-context`
Requires the `X-Dev-Requester-Id` header. Validates the requester is active. Response example:

```json
{ "data": { "requesterId": 1 } }
```

Missing, malformed, unknown, or inactive requester headers return
`422` with `{ "error": { "code": "REQUESTER_CONTEXT_INVALID", "message": "A valid active requester is required." } }`.

### `GET /api/related-systems`
Returns active related systems only (no requester header required). Response example:

```json
{
  "data": [
    { "id": 1, "name": "Corporate Laptop" },
    { "id": 2, "name": "Campus Wi-Fi" }
  ]
}
```

### `POST /api/tickets`
Creates a ticket for the active requester (requires `X-Dev-Requester-Id`).
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
Returns ticket detail for the active requester (requires `X-Dev-Requester-Id`).
Enforces ownership: a ticket owned by another requester returns `404 NOT_FOUND`.
Malformed `ticketNumber` path parameters return `404 NOT_FOUND`.

### `GET /api/tickets`
Returns the active requester's paginated ticket list (requires `X-Dev-Requester-Id`).
Supports search (`?search=`), filter (`?categoryId=`, `?requestedPriority=`, `?status=`),
sort (`?sort=createdAt|ticketNumber|summary|requestedPriority`, `?order=asc|desc`),
and pagination (`?page=`, `?pageSize=`). Returns `{ data: [...], pagination: { page, pageSize, totalItems, totalPages, unfilteredTotalItems } }`.

### `POST /api/tickets/:ticketNumber/attachments`
Uploads a single attachment (multipart) for the active requester's ticket (requires
`X-Dev-Requester-Id`). Validates type/size/content-signature, enforces a 5-active
limit (concurrency-safe via a row lock on the parent ticket), and stores the file
under a UUID + validated extension. Returns `201` with the attachment metadata.

### `GET /api/tickets/:ticketNumber/attachments`
Lists the ticket's attachments (active + removed) for the active requester, in
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
2. ~~Requester identity mechanism (`X-Dev-Requester-Id`) and selector flow~~ ✅
3. ~~`DevRequester` model~~ ✅ / ~~remaining data models (`RelatedSystem`, `Ticket`, `Attachment`)~~ ✅
4. ~~Ticket creation API + UI + validation~~ ✅
5. ~~Ticket number generation (`ticket-number.ts`)~~ ✅
6. ~~Ticket detail API~~ ✅
7. ~~My Tickets API + UI + query behavior~~ ✅
8. ~~Attachment lifecycle API + UI~~ ✅
9. ~~Responsive/visual/accessibility pass~~ ✅
10. ~~Full Lab 2 test evidence and docs completion~~ ✅

## 10. Notes
- Lab 2 uses development requester identity only, not real authentication.
- Keep ownership enforcement server-side for all requester-owned resources.
- Keep `docs/lab-02/tests.md` and `docs/lab-02/ai-use.md` updated as work progresses.

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