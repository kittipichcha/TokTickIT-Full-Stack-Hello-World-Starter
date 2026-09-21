# Lab 3 Final Cutover Gate — Issue #37

**Issue:** #37 — Authorization + Requester Migration / Regression
**Branch:** `feature/issue-37-authorization-requester-migration`
**Base:** `lab3-staging` @ `c521562` (Merge PR #46 — Issue #35)
**Date:** 2026-09-19

## Purpose

The final cutover gate (Locked Decision, Rev 12) proves the integrated state before
#38/#41 consume it. It is an **integration checkpoint**, never a new Test-DD row.
#42 Rev 12 consumes it as release-blocking upstream evidence.

Gate sequence: clean checkout → `npx prisma generate` → server `tsc` build → client
build → authenticated Requester Ticket/Attachment smoke → old-header death proof
(grep + live rejection) → full Lab 2 regression green per the RR-04-audited fixtures.

## 1. Dependency gate (#35 landed)

Verified against actual branch content, not issue/Kanban state:

| Artifact | Status |
|---|---|
| `User` / `Role` model in `server/prisma/schema.prisma` | Present |
| `requireAuth` / `requirePasswordChanged` / `requireCsrf` in `server/src/session.ts` | Present |
| Fresh-User authority (`res.locals.role`/`mustChangePassword` from the current DB row per request) | Present |
| Renamed Attachment columns `uploaderUserId` / `removedByUserId` (legacy requester columns dropped) | Present |
| `Attachment.isRemoved` preserved | Present |
| DM-17 legacy-caller compatibility set (identity from `User` for the legacy header gate + the two legacy read routes; soft-remove write on `removedByUserId`) | Present |
| DM-17 integration-gate log (`artifacts/lab-03/migration/integration-gate.md`) | Present |
| DM-17 grep-gate output (`artifacts/lab-03/issue-35/grep-gate.txt`) | Present |
| `client/src/api-client.ts` shared transport | Present |

## 2. Build gate

| Step | Command | Result |
|---|---|---|
| Prisma client | `npx prisma generate` | OK |
| Server typecheck | `cd server && npx tsc --noEmit` | 0 errors |
| Server build | `cd server && npm run build` | exit 0 |
| Client typecheck | `cd client && npx tsc --noEmit` | 0 errors |
| Client build | `cd client && npm run build` | `✓ built in 3.36s` (36 modules) |

## 3. Authenticated Requester smoke

Exercised through the real HTTP surface with a real login (session cookie + CSRF
token) in `server/tests/lab-03/requester.api.test.ts`:

| Step | Assertion | Result |
|---|---|---|
| Login | `POST /api/auth/login` → 200 + httpOnly cookie + `X-CSRF-Token` | Pass |
| Create ticket | `POST /api/tickets` → 201, owned by the authenticated identity, `itPriority === requestedPriority` | Pass |
| My Tickets | `GET /api/tickets` → 200, only the authenticated Requester's tickets | Pass |
| Ticket detail | `GET /api/tickets/:ticketNumber` → 200 for the owner | Pass |
| Attachment upload | `POST /api/tickets/:ticketNumber/attachments` → 201 | Pass |
| Attachment list | `GET /api/tickets/:ticketNumber/attachments` → 200 | Pass |
| Attachment download / preview | `GET /api/attachments/:id/download` / `/preview` → 200 | Pass |
| Attachment soft-remove | `DELETE /api/attachments/:id` → 200, `isRemoved = true`, `removedByUserId` = owner | Pass |

## 4. Old-header death proof

### 4a. Grep gate (RR-VERIFY-01)

Command:

```
grep -rn "X-Dev-Requester-Id|getRequesterHeaders|requesterHeaders|activeRequester|Change Requester|requester-context|dev-requesters|devRequesterId" server/src client/src
```

Result — **no live identity/authorization reference remains**:

| Identifier | Live hits |
|---|---|
| `X-Dev-Requester-Id` | 0 (one explanatory comment in `server/src/test-seams.ts` describing the removed fixture) |
| `getRequesterHeaders` / `requesterHeaders` | 0 |
| `activeRequester` | 0 |
| `Change Requester` | 0 |
| `requester-context` | 0 |
| `dev-requesters` | 0 |
| `devRequesterId` | 0 |

`server/src/requester-context.ts` is deleted; `GET /api/dev-requesters` and
`GET /api/requester-context` are unregistered.

#### 4a-ii. Extended grep gate (E2E — Issue #37 remediation)

Command (now includes the E2E suite and the Playwright config):

```
grep -rn "X-Dev-Requester-Id\|Change Requester\|toktickit.requesterId\|dev-requesters\|requester-context\|requester-select\|selectRequester" e2e server/src client/src playwright.config.ts
```

Result — **no live identity hits**:

| Location | Live hits |
|---|---|
| `e2e/**` | 0 live — only explanatory comments in `helpers.ts` / `ownership.spec.ts` / `responsive-visual.spec.ts` describing the removed mechanism |
| `playwright.config.ts` | 0 |
| `server/src/**` | 0 live — one explanatory comment in `test-seams.ts` |
| `client/src/**` | 0 live — only explanatory comments and absence assertions in `lab-02-tests/RequesterSelection*.test.tsx` / `App.test.tsx` / `UiStyles.test.tsx` / `MyTickets.test.tsx` / `AttachmentSection.test.tsx` |

The dead `.requester-select` CSS rule was also removed from `client/src/App.css`.


### 4b. Live old-header rejection

A request bearing `X-Dev-Requester-Id` and **no session** is rejected:

| Request | Expected | Result |
|---|---|---|
| `GET /api/tickets` + `X-Dev-Requester-Id: 1` | 401 `UNAUTHENTICATED` | Pass |
| `GET /api/tickets/TKT-2026-000001` + `X-Dev-Requester-Id: 1` | 401 `UNAUTHENTICATED` | Pass |
| `GET /api/dev-requesters` | 404 (route removed) | Pass |
| `GET /api/requester-context` | 404 (route removed) | Pass |

Asserted in `server/tests/lab-02/dev-requesters.api.test.ts` and
`server/tests/lab-02/requester-selection.integration.test.ts`.

## 5. Lab 2 regression (per the RR-04 audit)

Full suites re-run under authenticated identity, per
`artifacts/lab-03/regression/lab2-test-audit.md`:

| Suite | Result | Raw evidence |
|---|---|---|
| Server (`cd server && npm test`) | 34 files passed, 431 tests passed, **0 skipped** | `artifacts/lab-03/regression/server-vitest.txt` |
| Client (`cd client && npx vitest run`) | 12 files passed, 120 tests passed, 0 skipped | `artifacts/lab-03/regression/client-vitest.txt` |
| Lab 2 E2E (`npx playwright test e2e/lab-02 --project=desktop --project=tablet --project=mobile`) | 156 passed across 3 projects (desktop/tablet/mobile) | `artifacts/lab-03/regression/lab2-e2e-run.txt` |

Class (a) suites keep every functional assertion and only swap the identity fixture;
class (b) suites asserting removed Dev-Requester behavior were retired and replaced
with authenticated-identity assertions; no class (c) regression was found in the
server/client suites. The E2E migration surfaced one class (c) client regression
(`fetchCategories` response shape), which was fixed in the code — see the audit's
"Class (c) regressions found and fixed" section.

**Follow-up (2026-09-20) — My Tickets status/sort contract alignment.** The P2 review
finding was fixed in the code (full `TicketStatus` filter set; documented sort keys
`createdAt`/`ticketNumber`/`summary`/`status`/`priority` with `requestedPriority` retained
as a Lab 2 alias; logical-order `status`/`priority` sorting; frontend dropdown and sortable
columns aligned). One Lab 2 assertion was **superseded** by the widened enum: `API-MY-07`'s
`status=CLOSED → 400` probe, since `CLOSED` is a valid Lab 3 status. The probe moved to
`NOT_A_STATUS` (rule unchanged) with a replacement case asserting `CLOSED` is accepted; the
mapping is recorded in `lab2-test-audit.md`. Server **431 passed / 0 skipped**, client
**120 passed / 0 skipped**.

## 6. Gate result

**PASSED.** The integrated state compiles from a clean checkout, no reachable route
trusts `X-Dev-Requester-Id`, and the Lab 2 regression is green per the RR-04 mapping.
#38/#41 are unblocked on this basis.