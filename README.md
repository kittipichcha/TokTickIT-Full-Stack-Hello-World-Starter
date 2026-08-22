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

## 2. Current Implementation Status (as of 2026-08-22)
Implemented in code right now:
- `GET /api/health`
- `GET /api/categories`
- Prisma model: `Category` only
- Seed data: 4 categories
- Frontend screen: health check + categories display

Not yet implemented for Lab 2:
- All requester selection features and requester-scoped routing
- Ticket, related system, dev requester, attachment data models
- All ticket and attachment endpoints from Lab 2 API contract
- My Tickets and Ticket Detail UI
- Lab 2 test suites (unit/api/ui/e2e/responsive/visual)

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
|  |  |- service.ts
|  |- tests/
|  |  |- categories.integration.test.ts
|  |  |- categories.test.ts
|  |  |- health.integration.test.ts
|  |  |- health.test.ts
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
- Lab 2 test suites in `docs/lab-02/tests.md` are a target plan.
- Most listed Lab 2 test files do not exist yet in this starter branch.

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
Response example:

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

## 9. Lab 2 Implementation Order (Recommended)
1. Requirement baseline + docs alignment
2. Requester identity mechanism (`X-Dev-Requester-Id`) and selector flow
3. Data model expansion (DevRequester, RelatedSystem, Ticket, Attachment)
4. Ticket creation API + UI + validation
5. My Tickets API + UI + query behavior
6. Attachment lifecycle API + UI
7. Responsive/visual/accessibility pass
8. Full Lab 2 test evidence and docs completion

## 10. Notes
- Lab 2 uses development requester identity only, not real authentication.
- Keep ownership enforcement server-side for all requester-owned resources.
- Keep `docs/lab-02/tests.md` and `docs/lab-02/ai-use.md` updated as work progresses.