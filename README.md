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

## 2. Current Implementation Status (as of 2026-08-24)
Implemented in code right now:
- `GET /api/health`
- `GET /api/categories` (active-only)
- `GET /api/dev-requesters` (active-only, `{ "data": [...] }` envelope)
- `GET /api/requester-context` (requires `X-Dev-Requester-Id`, returns `422` if missing/unknown/inactive)
- Prisma models: `Category` (with `isActive`), `DevRequester`
- Seed data: 4 categories, 4 active + 1 inactive development requesters (idempotent upserts)
- Frontend: Development Requester Selection screen + application shell (requester identity, Change Requester), plus the Lab 1 System Overview / health-check screen
- Requester context is persisted in `sessionStorage` and sent via the `X-Dev-Requester-Id` header on requester-scoped calls

Not yet implemented for Lab 2 (downstream issues):
- Ticket, related system, and attachment data models
- All ticket and attachment endpoints from the Lab 2 API contract
- Create Ticket, My Tickets, and Ticket Detail UI
- Lab 2 test suites for tickets/attachments (unit/api/ui/e2e/responsive/visual)

## 3. Repository Structure

```text
.
|- client/
|  |- src/
|  |  |- api.ts
|  |  |- App.css
|  |  |- App.test.tsx
|  |  |- App.tsx
|  |  |- main.tsx
|  |  |- lab-02-tests/
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
|  |- tests/
|  |  |- categories.integration.test.ts
|  |  |- categories.service.test.ts
|  |  |- categories.test.ts
|  |  |- health.integration.test.ts
|  |  |- health.test.ts
|  |  |- lab-02/
|  |  |  |- api-contract.api.test.ts
|  |  |  |- dev-requesters.api.test.ts
|  |  |  |- requester-context.api.test.ts
|  |  |  |- requester-selection.integration.test.ts
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
- `docs/lab-02/tests.md` is the full Lab 2 test plan. The Issue #12 (Requester Selection)
  rows are implemented and passing; ticket/attachment rows remain `Planned` until their
  owning downstream features exist (see `docs/lab-02/tests.md` §5.1).
- Server tests: 48 across 9 files; client tests: 18 across 4 files.

## 8. API Implemented Today

### `GET /api/health`
Response example:

```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

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

## 9. Lab 2 Implementation Order (Recommended)
1. ~~Requirement baseline + docs alignment~~ ✅
2. ~~Requester identity mechanism (`X-Dev-Requester-Id`) and selector flow~~ ✅
3. ~~`DevRequester` model~~ ✅ / remaining data models (`RelatedSystem`, `Ticket`, `Attachment`)
4. Ticket creation API + UI + validation
5. My Tickets API + UI + query behavior
6. Attachment lifecycle API + UI
7. Responsive/visual/accessibility pass
8. Full Lab 2 test evidence and docs completion

## 10. Notes
- Lab 2 uses development requester identity only, not real authentication.
- Keep ownership enforcement server-side for all requester-owned resources.
- Keep `docs/lab-02/tests.md` and `docs/lab-02/ai-use.md` updated as work progresses.