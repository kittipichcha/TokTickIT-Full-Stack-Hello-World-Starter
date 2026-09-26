## Summary

Retrofits the **existing** Lab 2 Requester Ticket/Attachment routes to authenticated identity and role-based authorization, replacing the Dev-Requester header/selector mechanism entirely. Implements Issue #37 per plan Revision 12.

**Depends on:** #35 (merged into `lab3-staging` as PR #46, merge commit `c521562`).
**Blocks:** #38, #41, #42.

## What changed

### Authorization primitives (new)
`server/src/authorization.ts`:
- `requireRole(allowedRoles)` — generic role gate; authenticated but disallowed role → `403 FORBIDDEN`.
- `requireTicketReadAccess` — Staff/Admin may read any Ticket; a Requester only their own, else `404 NOT_FOUND` (never 403 — no existence leak, BR-32).
- `authorizeAttachmentReadByRoleOrRequesterOwnership` — the same owner-or-staff rule for the three shared attachment-read routes.

### Route-chain cutover
| Route | Chain |
|---|---|
| `POST /api/tickets` | `requireAuth → requirePasswordChanged → requireCsrf → requireRole(["REQUESTER"])` |
| `GET /api/tickets` | `requireAuth → requirePasswordChanged → requireRole(["REQUESTER"])` |
| `GET /api/tickets/:ticketNumber` | `requireAuth → requirePasswordChanged → requireTicketReadAccess` |
| `POST .../attachments`, `DELETE /api/attachments/:id` | `requireAuth → requirePasswordChanged → requireCsrf → requireRole(["REQUESTER"]) → ownership` |
| 3 shared attachment reads | `requireAuth → requirePasswordChanged → authorizeAttachmentReadByRoleOrRequesterOwnership` |
| `GET /api/categories`, `/api/related-systems` | `requireAuth → requirePasswordChanged` |

### Service-layer shared reads
`getTicketByNumber`, `listAttachments`, `getAttachmentById`, `downloadAttachment`, `previewAttachment` now take an explicit `{userId, role}` access context, so a Staff/Admin request that passes the route gate is not then rejected by a Requester-only filter inside the service. Upload and soft-remove remain Requester-owner-only at both layers.

### Dev-Requester removal (RR-01)
- Deleted `server/src/requester-context.ts` (including #35's DM-17 compatibility adaptation).
- Unregistered `GET /api/dev-requesters` and `GET /api/requester-context`.
- Removed the client header/sessionStorage helpers, `activeRequester` state, and the Change Requester action.
- All Requester calls now use #35's shared credentialed transport (`credentials: "include"` + `X-CSRF-Token` on mutations).

## Frozen Test-DD rows executed

| Row | File | Status |
|---|---|---|
| SEC-AUTHZ-01, SEC-AUTHZ-04, SEC-AUTHZ-05, SEC-AUTHZ-07, SEC-AUTHZ-10 | `server/tests/lab-03/authorization.api.test.ts` | Passed |
| API-REQ-01, API-REQ-02 | `server/tests/lab-03/requester.api.test.ts` | Passed |

`SEC-AUTHZ-07` asserts `403 FORBIDDEN` on every then-protected mutation route (including #35's two auth mutations), plus explicit no-state-change checks for create (no ticket is left behind) and logout (the session remains valid). `SEC-AUTHZ-08` and `API-REQ-04` remain owned by #38 and are not implemented here.

## RR-03 (verify-and-assert)

The soft-remove path preserves `isRemoved = true` + `removedAt` + `removalReason` and the atomic `WHERE isRemoved = false` guard; the remover-identity write targets `removedByUserId` (landed by #35's DM-17 step). The supplementary invariant assertion confirms the forbidden state (`removedAt` set with `isRemoved = false`) never occurs. No service change was needed.

## RR-04 Lab 2 regression audit

**Every** existing Lab 2 test — server unit/integration suites, client suites, **and the `e2e/lab-02/` Playwright suite** — was classified **(a)** unchanged behavior + auth fixture, **(b)** superseded Dev-Requester behavior → retired/replaced, or **(c)** actual regression → code fix, **before** modification. The before/after mapping is at `artifacts/lab-03/regression/lab2-test-audit.md`.

- **Class (a):** mocked suites use a `testSeams` identity fixture; real-DB suites use real logins; E2E specs log in through the real Login screen. Every functional assertion unchanged.
- **Class (b):** the selector/header/legacy-endpoint suites were retired and replaced with authenticated-identity assertions. The inactive-requester and missing-header cases moved from `422 REQUESTER_CONTEXT_INVALID` to `401 UNAUTHENTICATED` (an inactive account cannot hold a valid session under Lab 3 fresh-User authority). The retired "Change Requester is keyboard-accessible" E2E test is replaced by "Logout is keyboard-accessible"; the "Requester Selection" screenshot blocks are replaced by "Login" blocks.
- **Class (c):** one client regression found and **fixed in the code** (see below).

No failing test was deleted to obtain green CI; no Ticket/Attachment assertion was weakened; every removal has a recorded replacement.

### E2E migration (B-1)
- `e2e/lab-02/helpers.ts`: `selectRequester(page, id)` → `loginAsRequester(page, email, password)` (real Login screen → `.app-shell`). Legacy ids `"1"`/`"2"` map to two seeded E2E Requester accounts.
- `e2e/lab-02/global-setup.ts` (new): ensures the two E2E Requester accounts exist with `mustChangePassword = false`; credentials are test-only constants (no real secrets).
- `ownership.spec.ts`: `X-Dev-Requester-Id` headers replaced with real API logins using **isolated** Playwright request contexts (one cookie jar per Requester); the 404-for-other-Requester and 200-for-owner assertions are unchanged.
- `responsive-visual.spec.ts`: the `/api/dev-requesters` + `/api/requester-context` intercepts and `toktickit.requesterId` init scripts are removed; the shell is stubbed by intercepting `/api/auth/me`. Every layout, overflow, and touch-target assertion is retained.

### Class (c) regression fixed
Migrating the E2E suite to a real login surfaced a genuine bug that no mocked test caught: commit `1bfd8c0` made `fetchCategories` read `payload.data` from `GET /api/categories`, which returns a **bare array**, crashing `MyTickets` (`categories.map is not a function`) the moment an authenticated shell rendered. Per the audit rule, the **code** was fixed (`client/src/api.ts`) and the client test mock was aligned to the same shape.

### ⚠️ Ambiguous classifications flagged for human review

| Case | Resolution | Rationale |
|---|---|---|
| `my-tickets-real-db.integration.test.ts` — inactive-requester block | `422` → `401 UNAUTHENTICATED` | The `422` code belonged to the removed Dev-Requester mechanism. Data-preservation assertions unchanged. |
| `ticket-detail.api.test.ts` — missing-header case | `422` → `401 UNAUTHENTICATED` | The header no longer exists; unauthenticated is `401` per the frozen §0 table. |
| `reference-data.api.test.ts` — "does not require header" | Renamed to "requires an authenticated session" | The endpoint was public in Lab 2 and is authenticated in Lab 3 (api-spec §5/§6). |
| `attachments.api.test.ts` — list response shape | Kept as a bare array | Landed Lab 2 shape preserved (RR-02 / decision D-18). |

## API-spec alignment (B-2)

`docs/lab-03/api-spec.md` §11 now matches the landed code: the attachment list is a **bare array** (preserved from Lab 2; decision D-18 / RR-02), and `removedByUserId` is documented in §11 and §14. The decision is recorded in `docs/lab-03/specification.md` under "Assumptions and Decisions".

## Test-seam guard (N-3)

`requireAuth` and `requireCsrf` now honor `testSeams.sessionIdentity` **only** when `NODE_ENV === "test"`, so the seam is inert in production. Supplementary `UNIT-AUTHZ-02` in `authorization.api.test.ts` proves that with `NODE_ENV=production` and the seam set, a session-less request still gets `401 UNAUTHENTICATED`.

## Cutover gate

Recorded at `artifacts/lab-03/regression/cutover-gate.md`:

| Gate | Result |
|---|---|
| Dependency gate (#35 landed, incl. DM-17 set + evidence) | Verified |
| `npx prisma generate` | OK |
| Server `tsc` / `npm run build` | 0 errors / exit 0 |
| Client `tsc` / `npm run build` | 0 errors |
| Authenticated Requester smoke (login → create → My Tickets → detail → attachments) | Pass |
| Old-header death proof (grep + live rejection) | Pass |
| Extended grep gate (incl. `e2e/`) | No live hits |
| Lab 2 regression (server + client + E2E) | Green |

## Test results

| Suite | Result | Raw evidence |
|---|---|---|
| Server (`cd server && npm test`) | 34 files, 424 tests passed, **0 skipped** | `artifacts/lab-03/regression/server-vitest.txt` |
| Client (`cd client && npx vitest run`) | 12 files, 117 tests passed, 0 skipped | `artifacts/lab-03/regression/client-vitest.txt` |
| Lab 2 E2E (`npx playwright test e2e/lab-02 --project=desktop --project=tablet --project=mobile`) | 156 passed across 3 projects | `artifacts/lab-03/regression/lab2-e2e-run.txt` |

## Notes for the reviewer

- The Lab 2 suites injected identity with a header and never exercised the session path. Rather than rewrite ~200 tests around real logins, a `testSeams` identity fixture (mirroring the repository's existing `testSeams` pattern) covers the mocked suites, and real logins cover the real-DB integration suites and the E2E suite. The real authentication boundary is covered by #35's auth suite and by this PR's frozen authorization/requester API tests, which use real logins. The seam is now gated on `NODE_ENV === "test"` (N-3).
- The real-DB fixture (`registerSession`) snapshots and restores the `User` rows it mutates, because Lab 2 integration suites reuse the seeded requesters and the migration suite asserts on their original state.
- `docs/lab-03/tests.md` statuses were updated row-by-row, evidence-driven, for #37-owned rows only. No other row was touched.
