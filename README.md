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

## 2. Current Implementation Status (as of 2026-08-27)
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

**Implemented:**
- My Tickets API (`GET /api/tickets`)
- My Tickets UI (My Tickets screen with search, filter, sort, pagination)

**Deferred to Issue #15:**
- Attachment upload, preview, download, and soft-removal endpoints
- Full attachment action controls on Ticket Detail
- Attachment lifecycle / Ticket Detail attachment controls

## 3. Repository Structure

```text
.
|- client/
|  |- src/
|  |  |- api.ts
|  |  |- App.css
|  |  |- App.test.tsx
|  |  |- App.tsx
|  |  |- CreateTicket.tsx
|  |  |- main.tsx
|  |  |- vite-env.d.ts
|  |  |- lab-02-tests/
|  |  |  |- CreateTicket.test.tsx
|  |  |  |- MyTickets.test.tsx
|  |  |  |- RequesterSelection.integration.test.tsx
|  |  |  |- RequesterSelection.test.tsx
|  |- package.json
|  |- tsconfig.json
|  |- vite.config.ts
|  |- vitest.config.ts
|- docs/
|  |- lab-01/
|  |- lab-02/
|     |- ai-use.md
|     |- api-spec.md
|     |- reviewer.md
|     |- specification.md
|     |- tests.md
|     |- ui-spec.md
|- server/
|  |- prisma/
|  |  |- migrations/
|  |  |- schema.prisma
|  |  |- seed.ts
|  |- src/
|  |  |- app.ts
|  |  |- controller.ts
|  |  |- index.ts
|  |  |- module.ts
|  |  |- prisma.ts
|  |  |- requester-context.ts
|  |  |- service.ts
|  |  |- ticket-number.ts
|  |- tests/
|  |  |- categories.integration.test.ts
|  |  |- categories.service.test.ts
|  |  |- categories.test.ts

|  |  |- lab-02/
|  |  |  |- api-contract.api.test.ts
|  |  |  |- create-ticket-normalization.api.test.ts
|  |  |  |- create-ticket.api.test.ts
|  |  |  |- database-migration.integration.test.ts
|  |  |  |- dev-requesters.api.test.ts
|  |  |  |- dev-requesters.service.test.ts
|  |  |  |- reference-data.api.test.ts
|  |  |  |- requester-context.api.test.ts
|  |  |  |- requester-selection.integration.test.ts
|  |  |  |- seed.integration.test.ts
|  |  |  |- ticket-detail.api.test.ts
|  |  |  |- ticket-number-concurrency.integration.test.ts
|  |- package.json
|  |- tsconfig.json
|  |- vitest.config.ts
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

Important:
- `docs/lab-02/tests.md` is the full Lab 2 test plan. Issue #12 was amended
  (2026-08-24) to scope down to the requester-selection foundation only. Its required
  rows (`API-REQ-01`, `UI-REQ-01..07`) are implemented and passing. The five
  cross-feature rows previously listed in #12 (`API-REQ-02`, `API-REQ-03`,
  `API-CONTRACT-01`, `UI-MY-03`, `E2E-05`) have been formally reassigned to #13, #14,
  and #18 where their dependent models/endpoints/screens exist.
- Server tests: 154 passing across 13 files; client tests: 30 passing across 5 files.

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
    { "id": 1, "name": "Email" },
    { "id": 2, "name": "Payroll" }
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

## 9. Lab 2 Implementation Order (Recommended)
1. ~~Requirement baseline + docs alignment~~ ✅
2. ~~Requester identity mechanism (`X-Dev-Requester-Id`) and selector flow~~ ✅
3. ~~`DevRequester` model~~ ✅ / ~~remaining data models (`RelatedSystem`, `Ticket`, `Attachment`)~~ ✅
4. ~~Ticket creation API + UI + validation~~ ✅
5. ~~Ticket number generation (`ticket-number.ts`)~~ ✅
6. ~~Ticket detail API~~ ✅
7. ~~My Tickets API + UI + query behavior~~ ✅
8. Attachment lifecycle API + UI
9. Responsive/visual/accessibility pass
10. Full Lab 2 test evidence and docs completion

## 10. Notes
- Lab 2 uses development requester identity only, not real authentication.
- Keep ownership enforcement server-side for all requester-owned resources.
- Keep `docs/lab-02/tests.md` and `docs/lab-02/ai-use.md` updated as work progresses.