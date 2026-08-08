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

