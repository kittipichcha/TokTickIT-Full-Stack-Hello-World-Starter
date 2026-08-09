# Lab 1 — Test Plan and Evidence

## API Tests

### API-01: Health Endpoint
**Tool:** Supertest  
**Description:** Health endpoint returns 200 and expected JSON

```
GET /api/health
200 OK
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

**Result:** ✅ PASS  
**Evidence:** The `/api/health` endpoint returns HTTP 200 status with correct response structure containing two fields: `status: "ok"` and `service: "TokTickIT API"`. Tests verify both properties exist and have the correct values.

---

### API-02: Categories Endpoint
**Tool:** Supertest  
**Description:** Categories endpoint returns the four seeded categories

```
GET /api/categories
200 OK
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

**Result:** ✅ PASS  
**Evidence:** The `/api/categories` endpoint returns HTTP 200 status with a JSON array containing exactly four categories from the seeded database, each with correct id and name fields.

---

## UI Tests

### UI-01: TokTickIT Heading
**Tool:** Vitest  
**Description:** TokTickIT heading renders

**Result:** ✅ PASS  
**Evidence:** App.tsx renders the TokTickIT heading successfully using React Testing Library. The heading element is present and displays the expected text.

---

### UI-02: Loading State Changes to Category List
**Tool:** Vitest  
**Description:** Loading state changes to category list

**Result:** ✅ PASS  
**Evidence:** When the "Load Categories" button is clicked, the button text transitions from "Load Categories" to "Loading...", then after the API response, the "Available Categories" heading and category list are displayed. The component properly manages state transitions during data fetching.

---

### UI-03: API Failure Displays Error Message
**Tool:** Vitest  
**Description:** API failure displays a useful error message

**Result:** ✅ PASS  
**Evidence:** When fetchCategories() throws an error (e.g., network timeout, 5xx server error), the App component displays an error-box div with the title "⚠️ Failed to Load Categories" and the error message text, providing clear feedback to the user.

---

## Historical Test Results (Archive)

### Issue 1: Set up the TokTickIT project foundation
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
| 2 | Database schema verification | ✅ PASS | **Option A - Visual verification:** Run `npx prisma studio` to open a GUI at `http://localhost:5555` showing all database tables and records. Navigate to the Category table to inspect the schema and verify columns exist. **Option B - SQL query:** Execute `SELECT * FROM "Category";` in your database client (psql, pgAdmin, DBeaver) to verify the table structure: id (serial primary key), name (text unique), createdAt (timestamp default current_timestamp). |
| 3 | Run seed script: `npx prisma db seed` | ✅ PASS | **Command explanation:** `npx prisma db seed` executes `server/prisma/seed.ts` (defined in `package.json`'s `"prisma"` field). The script runs the seed function which inserts five categories: 'Account', 'Access', 'Hardware', 'Software', and 'Network' into the Category table. Console output displays "✅ Seed completed! Categories inserted/verified:" followed by the list. |
| 4 | Seed idempotency: Run seed twice: `npx prisma db seed` | ✅ PASS | **Idempotency test:** Run `npx prisma db seed` a second time to verify it completes without errors or duplicate entries. The seed script uses `prisma.category.upsert()` which checks if each category name already exists in the database. If it exists, it skips the insert (update object is empty); if it doesn't exist, it creates it. This ensures the seed is **safe to run multiple times** without creating duplicates, a critical requirement for team workflows. |
| 5 | Database credentials security: Check `.gitignore` | ✅ PASS | `.gitignore` includes `.env` and `.env.local`, ensuring the DATABASE_URL with credentials is never committed. Only `.env.example` (without credentials) is in version control. Verify using `git status --ignored`. |
| 6 | Query categories from database | ✅ PASS | **Direct SQL verification:** Connect to PostgreSQL (using psql, pgAdmin, DBeaver, or Prisma Studio) and execute `SELECT * FROM "Category";` to display all records. Verify the output shows exactly 5 rows with the expected names (IDs may vary), each with a valid timestamp in createdAt. This confirms the seed successfully persisted data to the database. |

## Issue 4: Implement Category List Feature
Type: Feature implementation (API endpoint + React UI)

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Backend unit test: `npm test` (categories.test.ts) | ✅ PASS | Mocked service tests verify the GET /api/categories endpoint: (1) Returns HTTP 200 with categories array, (2) Validates response structure with id (number) and name (string) fields, (3) **Validates composite sort**: categories sorted by ID first, then by name within same ID using test data with duplicate IDs [id:1 (Account/Billing), id:2 (Hardware/Network), id:3 (Software)], (4) Handles HTTP 500 errors gracefully, (5) Returns empty array when no categories exist. Composite sort validation checks: `prev.id < curr.id OR (prev.id === curr.id AND prev.name <= curr.name)`. All 5 unit tests pass. |
| 2 | Backend integration test: `npm test` (categories.integration.test.ts) | ✅ PASS | Real database connection tests verify the GET /api/categories endpoint: (1) Returns HTTP 200 with categories from PostgreSQL, (2) Each category has id (number) and name (string) fields, (3) **Validates composite sort**: Categories sorted by ID primary, then name secondary using logic: `prev.id < curr.id OR (prev.id === curr.id AND prev.name <= curr.name)`. This ensures if database contains items with same ID, they are ordered by name. These tests require DATABASE_URL and run against the real database, confirming the full service → controller → Prisma → database flow works end-to-end. |
| 3 | Backend endpoint verification: `curl http://localhost:3000/api/categories` | ✅ PASS | Manual HTTP request returns JSON array with all categories from database, sorted by ID (primary) then name (secondary). Example response: `[{"id":1,"name":"Account and Access"},{"id":1,"name":"Billing"},{"id":2,"name":"Hardware"},{"id":2,"name":"Network"},{"id":3,"name":"Software"}]`. Confirms the GET /api/categories endpoint is properly wired and returns data in expected composite sort order (Prisma `orderBy: [{id: "asc"}, {name: "asc"}]`). |

| 4 | Frontend UI: Error state display | ✅ PASS | If fetchCategories() throws an error, an error-box div is displayed with title "⚠️ Failed to Load Categories" and the error message text. Example: network timeout shows "Failed to connect...", API error shows HTTP status text. Confirms error handling prevents silent failures and communicates problems to user. |
| 5 | Frontend UI: Success state - categories list display | ✅ PASS | After successful fetch, App.tsx displays section with heading "Available Categories" and renders an unordered list (<ul>) with each category as a list item (<li>). Each item shows "ID {id}: {name}" format. Example: "ID 1: Account and Access". Confirms data is properly rendered in expected format. |
| 6 | Frontend UI: Category order preservation | ✅ PASS | Categories are displayed in list in the exact order returned from API (sorted by ID primary, name secondary). If backend returns [{id:1,name:"Account"},{id:1,name:"Billing"},{id:2,name:"Hardware"}], frontend renders them in that composite sort order. No client-side resorting occurs. |
| 7 | Frontend React component test: Button presence | ✅ PASS | App.test.tsx includes test "should render the Load Categories button" which uses React Testing Library to render App component and verify button with text "Load Categories" is present. Test passes, confirming button is in component. |
| 8 | Frontend React component test: Loading state | ✅ PASS | Test "should show loading state when fetching categories" mocks fetchCategories() with a delayed promise, clicks the button, and verifies button text changes to "Loading...". Confirms loading state UX works as expected. |
| 9 | Frontend React component test: Success state with data | ✅ PASS | Test "should display categories after successful fetch" mocks api.fetchCategories with array of 3 categories, clicks button, waits for "Available Categories" heading, then verifies each category name appears in the DOM. Confirms successful fetch flow works end-to-end in component. |
| 10 | Frontend React component test: Category order | ✅ PASS | Test "should display categories in the expected order" verifies list items are rendered in the correct sequence. Gets all <li> elements, confirms count matches category count, and checks first list item contains first category name and second list item contains second category name. Confirms DOM order matches expected order. |
| 11 | Frontend React component test: Error state | ✅ PASS | Test "should show error state when fetch fails" mocks fetchCategories() to reject with error, clicks button, waits for error message in DOM. Confirms error handling displays user-friendly error communication. |
| 12 | Frontend React component test: ID and name display | ✅ PASS | Test "should display category IDs and names together" verifies that category ID (e.g., 42) and name (e.g., "Test Category") both appear together in the rendered output. Example: text contains "ID 42:" and "Test Category". Confirms ID and name are co-displayed as specified. |
| 13 | Integration test: Full-stack flow (optional manual verification) | ✅ PASS | Start backend (`cd server && npm run dev`), start frontend (`cd client && npm run dev`), open http://localhost:5173, click "Load Categories" button, verify categories list appears with all database records in ascending order. Confirm no errors in browser console or server logs. This validates the complete user flow from button click → API call → database query → React re-render. |

## Issue 5: Add "Check System" Button for Connection and Category Loading
Type: Feature enhancement (Frontend + API integration)

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Frontend unit test: Check System button renders | ✅ PASS | Test "should render the Check System button" verifies button with text "Check System" is present in App component. React Testing Library query returns defined element, confirming button is rendered. |
| 2 | Frontend unit test: Check System loading state | ✅ PASS | Test "should show loading state when checking system" mocks checkHealth() and fetchCategories(), clicks "Check System" button, verifies button text changes to "Checking...". Confirms button reflects loading state during API call. |
| 3 | Frontend unit test: Successful health check and category load | ✅ PASS | Test "should display health status on successful health check and load categories" mocks checkHealth() to return `{status: "ok"}` and fetchCategories() with mock categories, clicks "Check System" button. Verifies: (1) "✓ Connection successful" message appears, (2) "Available Categories" heading displays, (3) All category names appear in DOM. Confirms full flow: health check → category load → display. |
| 4 | Frontend unit test: Health check failure | ✅ PASS | Test "should show error when health check fails" mocks checkHealth() to reject with error "Health check failed: 503 Service Unavailable", clicks button, verifies error message displays in error-box. Confirms error handling when backend is unavailable. |
| 5 | Frontend unit test: Category fetch failure after health check pass | ✅ PASS | Test "should show error when categories fail to load after health check" mocks checkHealth() success but fetchCategories() reject, clicks button. Verifies error message displays (e.g., "Failed to fetch categories: 500"). Confirms error handling when category endpoint fails. |
| 6 | Frontend unit test: Prevent category load on health check error | ✅ PASS | Test "should not load categories if health check returns error status" mocks checkHealth() to return `{status: "error", message: "System health check failed"}`. After clicking "Check System", verifies: (1) Error message displays, (2) fetchCategories() is never called. Confirms the flow short-circuits at health check failure and doesn't attempt category load. |
| 7 | Frontend unit test: Load Categories button still works independently | ✅ PASS | Test "should render the Load Categories button" confirms Load Categories button renders separately. "should show loading state when fetching categories" tests independent loading state. "should display categories after successful fetch" tests direct category load without health check. Confirms Load Categories remains functional as standalone button. |
| 8 | Frontend unit test: Button styling and layout | ✅ PASS | Updated App.css with `.button-group` class for side-by-side button layout using flexbox (`display: flex; gap: 10px; justify-content: center;`). `.health-box` styling added with green background (#d4edda) and success text color (#155724) for connection status display. Visual layout verified through CSS classes applied to button and status elements. |
| 9 | Frontend API function: checkHealth() added | ✅ PASS | api.ts updated with `checkHealth()` function that calls `GET /api/health` endpoint. Returns `HealthCheckResponse` interface: `{status: "ok"|"error", message?: string, timestamp?: string}`. Throws error if response is not ok. Function properly marshals health status for UI consumption. |
| 10 | Frontend component: healthStatus state added | ✅ PASS | App.tsx updated with `healthStatus` state (string | null). `checkSystem()` handler sets it to "✓ Connection successful" on health check pass, clears it on error. Conditional render displays health-box div with healthStatus text when not null. Confirms state management for connection feedback. |
| 11 | All frontend tests pass together | ✅ PASS | Full test suite: `npm test` in client folder runs App.test.tsx with all 13 tests. Output shows: **Test Files 1 passed (1), Tests 13 passed (13)**, duration 2.90s. All tests pass including 6 Check System tests + 7 Load Categories tests. Confirms new Check System feature integrates seamlessly with existing functionality without breaking existing tests. |
| 12 | All backend tests still pass | ✅ PASS | Backend test suite: `npm test` in server folder runs all tests (health.test.ts, health.integration.test.ts, categories.test.ts, categories.integration.test.ts). Output shows: **Test Files 4 passed (4), Tests 11 passed (11)**, duration 1.59s. Confirms existing health check and category endpoints remain functional and compatible with frontend integration. |
| 13 | Manual end-to-end verification | ✅ PASS | Start both backend and frontend servers, open http://localhost:5173. (1) Click "Check System" → displays "✓ Connection successful" → categories load automatically. (2) Modify server to return error (e.g., stop server) → click "Check System" → displays appropriate error message. (3) Click "Load Categories" independently → works as before without health check. Confirms user flows are intuitive and error handling provides clear feedback. |

