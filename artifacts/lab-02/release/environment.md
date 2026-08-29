# Lab 2 Release Verification — Environment

**Issue:** #18 — Lab 2 Final Integration and Release Verification
**PR:** #30
**Branch:** `feature/issue-18-integration-verification`
**Base:** `lab2-staging`
**Date:** 2026-08-29

## Toolchain

| Component | Version / Value |
|---|---|
| Node.js | v24.14.0 |
| npm | 11.9.0 |
| PostgreSQL | accepting connections on `localhost:5432` |
| Prisma | 5.22.0 (schema up to date, 5 migrations applied) |
| Playwright | ^1.62.1 |
| Vite | 6.4.3 |
| Vitest | 4.1.10 |
| TypeScript | 5.7.2 |

## Database

- **DATABASE_URL** (from `server/.env`): `postgresql://kitti:***@localhost:5432/tocktick?schema=public`
- **Migration status**: `Database schema is up to date!` (5 migrations found)
- **Seed**: 4 active + 1 inactive development requesters, 4 categories, 6 related systems (idempotent upserts)

## Server

- **Start command**: `cd server && npm run dev` (tsx watch `src/index.ts`)
- **Port**: 3000
- **Base path**: `/api`
- **Requester identity**: `X-Dev-Requester-Id` header (BR-21, not authentication)

## Client

- **Start command**: `cd client && npm run dev` (Vite)
- **Port**: 5173
- **API base**: `http://localhost:3000` (default `VITE_API_URL`)

## Playwright / Browser

- **Config**: `playwright.config.ts`
- **Viewport projects**: desktop (1280×800), tablet (820×1180), mobile (390×844)
- **baseURL**: `http://localhost:5173`
- **Reporter**: `list`
- **Trace**: `on-first-retry`
- **Screenshot**: `only-on-failure`

## Verification Commands

```bash
# Full Lab 2 E2E suite (desktop/tablet/mobile)
npx playwright test e2e/lab-02

# Client unit/component tests
cd client && npm test

# Server unit/integration tests (real database)
cd server && npm test

# Build / type checks
cd client && npm run build
cd server && npm run build
```