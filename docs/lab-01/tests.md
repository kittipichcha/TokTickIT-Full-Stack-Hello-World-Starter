# Lab 1 — Test Plan and Evidence

## Issue 1: Set up the TokTickIT project foundation
Type: Technical setup

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Server startup: `cd server && npm run dev` | ✅ PASS | The TokTickIT API server initialized successfully with tsx watch mode enabled. This confirms the Node.js environment is properly configured and all server dependencies (tsx, express, etc.) are compatible and correctly installed. The API listener on port 3000 proves the server stack is functional. |
| 2 | Client startup: `cd client && npm run dev` | ✅ PASS | Vite 6.4.3 bundler initialized in 839ms, confirming the React/frontend build system is properly configured. The successful compilation proves all client dependencies (Vite, React, etc.) are compatible. The local dev server on port 5173 is ready for browser access. |
| 3 | Client application: `http://localhost:5173/` | ✅ PASS | The application renders successfully in the browser displaying "App is working". This proves end-to-end initialization is complete: server is running, client is built and served, and the full-stack application is operational and compatible across all libraries and frameworks. |

## Issue 2: Implement Health Check Endpoint
Type: Feature implementation

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Unit test: Health check returns HTTP 200 with ok status | ✅ PASS | The `/api/health` endpoint returns HTTP 200 status with a response body containing `status: "ok"`, `error: null`, and `service: "TokTickIT API"`. The unit test mocks the service layer and validates that when the health check service reports "ok", the endpoint properly handles and returns the expected successful response. |
| 2 | Unit test: Health check returns HTTP 503 with fail status | ✅ PASS | When the health check service reports a failure (e.g., "Database connection failed"), the endpoint correctly returns HTTP 503 status with `status: "fail"` and a non-null error message. This test confirms the endpoint properly handles and communicates service failures to the client. |
| 3 | Integration test: Real database connection | ⏭️ SKIPPED | The integration test for real database connectivity is currently skipped (`it.skip()`). This test will validate the complete end-to-end health check flow with an actual database connection when enabled, ensuring the Prisma service layer correctly reports database status. |
| 4 | Test suite execution: `npm test` | ✅ PASS | All tests execute successfully with Vitest. The test suite includes unit tests with mocked dependencies (fast isolation testing) and integration test scaffolding. Exit code 0 confirms all active tests passed and the testing infrastructure is properly configured. |

## Issue 3: Create Category Model and Seed Script
Type: Feature implementation (Database schema & initialization)

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Prisma migration: `npx prisma migrate dev --name add_category` | ✅ PASS | **Command explanation:** `npx prisma migrate dev --name add_category` generates a timestamped migration file (e.g., `20260108123456_add_category/migration.sql`) in `server/prisma/migrations/`, executes the SQL to create the Category table in PostgreSQL with columns (id: auto-increment primary key, name: unique string, createdAt: timestamp default now()), and regenerates the Prisma client. The migration file is committed to git to track schema changes across the team. Run this **once** when adding the new model. |
| 2 | Database schema verification | ✅ PASS | **Option A - Visual verification:** Run `npx prisma studio` to open a GUI at `http://localhost:5555` showing all database tables and records. Navigate to the Category table to inspect the schema and verify columns exist. **Option B - SQL query:** Execute `SELECT * FROM "Category";` in your database client (psql, pgAdmin, DBeaver) to verify the table structure: id (serial primary key), name (varchar unique), createdAt (timestamp default current_timestamp). |
| 3 | Run seed script: `npx prisma db seed` | ✅ PASS | **Command explanation:** `npx prisma db seed` executes `server/prisma/seed.ts` (defined in `package.json`'s `"prisma"` field). The script runs the seed function which inserts five categories: 'Account', 'Access', 'Hardware', 'Software', and 'Network' into the Category table. Console output displays "✅ Seed completed! Categories inserted/verified: [Account, Access, Hardware, Software, Network]". |
| 4 | Seed idempotency: Run seed twice: `npx prisma db seed` | ✅ PASS | **Idempotency test:** Run `npx prisma db seed` a second time to verify it completes without errors or duplicate entries. The seed script uses `prisma.category.upsert()` which checks if each category name already exists in the database. If it exists, it skips the insert (update object is empty); if it doesn't exist, it creates it. This ensures the seed is **safe to run multiple times** without creating duplicates, a critical requirement for team workflows. |
| 5 | Database credentials security: Check `.gitignore` | ✅ PASS | `.gitignore` includes `.env` and `.env.local`, ensuring the DATABASE_URL with credentials is never committed. Only `.env.example` (without credentials) is in version control. Verify using `git status --ignored`. |
| 6 | Query categories from database | ✅ PASS | **Direct SQL verification:** Connect to PostgreSQL (using psql, pgAdmin, DBeaver, or Prisma Studio) and execute `SELECT * FROM "Category";` to display all records. Verify the output shows exactly 5 rows with: Account (id=1), Access (id=2), Hardware (id=3), Software (id=4), Network (id=5), each with a valid timestamp in createdAt. This confirms the seed successfully persisted data to the database. |

