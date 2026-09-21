# Lab 2 Regression Compatibility Audit (RR-04)

**Issue:** #37 — Authorization + Requester Migration / Regression
**Branch:** `feature/issue-37-authorization-requester-migration`
**Base:** `lab3-staging` @ `c521562` (Merge PR #46 — Issue #35)
**Date:** 2026-09-19

## Purpose

RR-04 requires that **before any existing Lab 2 test is modified**, every test is
classified as:

- **(a)** behavior unchanged + auth fixture updated — the `X-Dev-Requester-Id` header
  injection is replaced by an authenticated identity; **every functional assertion is
  unchanged**;
- **(b)** superseded Dev-Requester-specific behavior (selector / header / legacy
  endpoints / old field names) → **retired and replaced** with an authenticated-identity
  assertion;
- **(c)** actual regression → **fix the code, never the test**.

**Prohibited:** quietly deleting a failing test, weakening a Ticket/Attachment
assertion, or any test change absent from this mapping.

## Identity fixture (class (a) mechanism)

Lab 2 tests injected identity with the `X-Dev-Requester-Id` header. That mechanism is
removed by #37. Two fixtures replace it:

| Fixture | Used by | Mechanism |
|---|---|---|
| `server/tests/lab-02/helpers/identity.ts` | Mocked suites (service module stubbed) | Sets `testSeams.sessionIdentity`, which `requireAuth`/`requireCsrf` honor. These suites exercise routing/validation/business logic and never exercised the session/login path. |
| `server/tests/lab-03/helpers/auth.ts` | Real-DB integration suites | Real login (`POST /api/auth/login`) → session cookie + CSRF token. `registerSession(userId)` snapshots the `User` row and `clearSessions()` restores it, so the fixture is non-destructive. |
| `client/src/lab-02-tests/helpers/user.ts` | Client suites | `App` now receives `user` from `AuthGate`; the fixture supplies the authenticated `AuthUser`. |

The real authentication boundary (login → session cookie → fresh-User authority) is
covered by #35's auth suite and by #37's frozen `authorization.api.test.ts` /
`requester.api.test.ts`, which use real logins.

## Server — `server/tests/lab-02/`

| Test file | Class | Change |
|---|---|---|
| `api-contract.api.test.ts` | (a) + (b) | Request-parsing assertions unchanged; fixture swapped to a real session. The `API-CONTRACT-01 requester context contract` block asserted the removed selector/context endpoints → **retired** (replacement in `dev-requesters.api.test.ts`). |
| `attachments.api.test.ts` | (a) | Fixture swapped to the seam identity. `attachmentOwnedByRequester` added to the service mock (the shared-read middleware now resolves ownership). Call-signature assertions updated: `downloadAttachment(123, {userId, role})`; response key `removedByRequesterId` → `removedByUserId`. |
| `create-ticket.api.test.ts` | (a) | Fixture swapped. `API-TKT-04` renamed from "Ownership assigned from X-Dev-Requester-Id" to "…from the authenticated identity"; the test now also asserts a body-supplied `requesterId` is ignored (strengthened, not weakened). |
| `create-ticket-normalization.api.test.ts` | (a) | Fixture swapped only. |
| `integer-validation.api.test.ts` | (a) | Fixture swapped only. |
| `my-tickets.api.test.ts` | (a) + (b) | Fixture swapped only. **Follow-up (2026-09-20):** the `API-MY-07` "returns 400 for invalid status enum" case probed `status=CLOSED`, which was out-of-enum in Lab 2 (only `NEW` existed) but is a **valid** value under Lab 3's frozen eight-value `TicketStatus` enum (api-spec §8). The assertion is **superseded** → the probe value moved to `NOT_A_STATUS` (the rule under test — out-of-enum status is a validation error, not a fallback default — is unchanged), and a replacement case asserts `status=CLOSED` is now accepted and forwarded to the service. |
| `reference-data.api.test.ts` | (a) | Fixture swapped. The two "does not require X-Dev-Requester-Id header" tests renamed to "requires an authenticated session (no longer public)" — the endpoint is no longer public (api-spec §5/§6). |
| `ticket-detail.api.test.ts` | (a) + (b) | Fixture swapped; `ticketOwnedByRequester` stubbed for the shared-read middleware; response key renamed. The `returns 422 for missing requester header` case is **superseded** (the header is gone) → replaced with `returns 401 for an unauthenticated request`. |
| `dev-requesters.api.test.ts` | (b) | Entirely superseded (asserted `GET /api/dev-requesters` payload shape). **Retired and replaced** with assertions that the endpoint is gone, the legacy header authorizes nothing, and authenticated reference data is served. |
| `dev-requesters.service.test.ts` | (b) | Entirely superseded (asserted `getActiveDevRequesters` Prisma query). **Deleted** — the service function no longer exists. |
| `requester-context.api.test.ts` | (b) | Entirely superseded (asserted `GET /api/requester-context` + `getRequesterIdFromHeaders`). **Deleted** — the module and route no longer exist. |
| `requester-selection.integration.test.ts` | (b) | Entirely superseded (real-DB assertions on the selector endpoints). **Retired and replaced** with real-login identity assertions and removed-endpoint checks. |
| `attachment-concurrency.integration.test.ts` | (a) | Fixture swapped to real sessions (`registerSession` + `sess`). All concurrency assertions unchanged. |
| `attachment-ownership.integration.test.ts` | (a) | Fixture swapped to real sessions. All ownership assertions unchanged. |
| `attachment-persistence-compensation.integration.test.ts` | (a) | Fixture swapped to real sessions; response key renamed. All compensation assertions unchanged. |
| `create-ticket-real-db.integration.test.ts` | (a) | Fixture swapped to real sessions. `API-TKT-INT-03` test renamed from "…from X-Dev-Requester-Id header" to "…from the authenticated identity". |
| `create-ticket-reference-validation.integration.test.ts` | (a) | Fixture swapped to real sessions only. |
| `my-tickets-real-db.integration.test.ts` | (a) + (b) | Fixture swapped to real sessions. The `API-REQ-02: Historical inactive requester` block asserted the removed `422 REQUESTER_CONTEXT_INVALID` behavior → **superseded**: under Lab 3 fresh-User authority an inactive account cannot hold a valid session, so the assertions became `401 UNAUTHENTICATED` (login rejected; protected routes rejected). The "data preserved" assertions are unchanged. |
| `ticket-number-concurrency.integration.test.ts` | (a) | Fixture swapped to real sessions only. |

## Server — outside `lab-02`

| Test file | Class | Change |
|---|---|---|
| `tests/categories.test.ts` | (a) | Fixture swapped to the seam identity (the endpoint now requires a session). |
| `tests/categories.integration.test.ts` | (a) | Fixture swapped to a real session. |
| `tests/lab-03/ticket-priority.integration.test.ts` | (a) | Fixture swapped to a real session. All `itPriority` assertions unchanged. |

## Client — `client/src/`

| Test file | Class | Change |
|---|---|---|
| `App.test.tsx` | (a) + (b) | Renders `<App user={TEST_USER} />`. The "selected requester" and "Change Requester" assertions are **superseded** → replaced with assertions that the selector and Change Requester action are absent. |
| `lab-02-tests/MyTickets.test.tsx` | (a) + (b) | Fixture swapped. `UI-MY-03` ("Requester switch clears prior data…") is **superseded** → replaced with "loads only the authenticated identity's tickets and offers no requester switch". All other assertions unchanged. |
| `lab-02-tests/CreateTicket.test.tsx` | (a) | Fixture swapped; `uploadAttachment` call-signature assertion updated to `(ticketNumber, file)`. All form/validation assertions unchanged. |
| `lab-02-tests/AttachmentSection.test.tsx` | (a) + (b) | Fixture swapped; call-signature assertions updated (`previewAttachmentFile(id)`, `downloadAttachmentFile(id)`, `removeAttachment(id, reason)`, `uploadAttachment(ticketNumber, file)`); response key renamed. The "failed attachment from prior requester is absent after requester switch" test is **superseded** → replaced with a ticket-scope assertion (no requester switch exists). |
| `lab-02-tests/UiStyles.test.tsx` | (a) + (b) | Fixture swapped. "renders the header with Change Requester secondary-style button" is **superseded** → replaced with "does not render a Change Requester action". All CSS-token assertions unchanged. |
| `lab-02-tests/RequesterSelection.test.tsx` | (b) | Entirely superseded (selector flow, storage key, header). **Retired and replaced** with authenticated-identity assertions. |
| `lab-02-tests/RequesterSelection.integration.test.tsx` | (b) | Entirely superseded (selector flow + `X-Dev-Requester-Id` header + `toktickit.requesterId` storage key). **Retired and replaced** with credentialed-transport assertions. The `/api/categories` mock was corrected to a bare array to match the landed response shape (class (c) fix — see below). |
| `lab-02-tests/format.test.ts` | (a) | Unchanged — pure formatting helpers, no identity. |

## E2E — `e2e/lab-02/`

The Lab 2 Playwright suite drove the removed Dev-Requester selector and the
`X-Dev-Requester-Id` header. Every spec now logs in through the real Login screen
(class (a) fixture swap) or replaces a retired selector/header behavior with an
authenticated-identity assertion (class (b)). A Playwright `globalSetup`
(`e2e/lab-02/global-setup.ts`) ensures two dedicated E2E Requester accounts exist
with `mustChangePassword = false`; credentials are test-only constants in
`e2e/lab-02/helpers.ts` (no real secrets).

| Spec file | Class | Change |
|---|---|---|
| `requester-ticket-flow.spec.ts` | (a) | `selectRequester` → `loginAsRequesterById`. All flow assertions unchanged. |
| `attachment-lifecycle.spec.ts` | (a) | `selectRequester` → `loginAsRequesterById`. All lifecycle assertions unchanged. |
| `partial-success-attachment.spec.ts` | (a) | `selectRequester` → `loginAsRequesterById`. All BR-17 assertions unchanged. |
| `keyboard-access.spec.ts` | (a) + (b) | Fixture swapped. The `sessionStorage.removeItem("toktickit.requesterId")` line is removed. "visible focus indicators on requester selector and Continue button" is **superseded** → replaced with "visible focus indicators on the Login form controls". "mandatory keyboard-only flow: Requester Selection → Continue → Create Ticket" is **superseded** → replaced with "mandatory keyboard-only flow: Login → Create Ticket". "Change Requester is keyboard-accessible" is **superseded** → replaced with "Logout is keyboard-accessible" (the Logout button is in the `AuthGate` header). Focus-trap modal assertions unchanged. |
| `ownership.spec.ts` | (a) + (b) | Fixture swapped. `X-Dev-Requester-Id` headers replaced with real API logins using isolated Playwright request contexts (one cookie jar per Requester, so both stay authenticated). "Change Requester" UI steps replaced with logout + re-login. The 404-for-other-Requester assertions and the 200-for-owner sanity checks are **unchanged** (never weakened). |
| `responsive-visual.spec.ts` | (a) + (b) | Fixture swapped. The `/api/dev-requesters` + `/api/requester-context` intercepts and the `toktickit.requesterId` init scripts are removed; the shell is stubbed by intercepting `/api/auth/me` (authenticated) instead. The "Requester Selection" screenshot/visual blocks are **superseded** → replaced with "Login" blocks (default / validation-error / failure / responsive / touch-target / clipped-label). "Change Requester" assertions in the My Tickets layout checks are replaced with the "Logout" control. Every layout, overflow, and touch-target assertion is retained. |

**Screenshot evidence.** The migrated suite writes the replacement Login screenshots to
`artifacts/lab-02/screenshots/login/`. The historical
`artifacts/lab-02/screenshots/requester-selection/` images are retained as Lab 2 release
evidence (still referenced by `docs/lab-02/ui-spec.md` and
`artifacts/lab-02/release/final-gate.md`); they are no longer regenerated because the
selector screen no longer exists.

## Ambiguous cases flagged for the human reviewer

| Case | Resolution | Rationale |
|---|---|---|
| `my-tickets-real-db.integration.test.ts` — inactive-requester block | Reclassified from `422 REQUESTER_CONTEXT_INVALID` to `401 UNAUTHENTICATED` | The `422` code belonged to the removed Dev-Requester mechanism. Lab 3's frozen fresh-User authority rule (#35 Rev 8/13) makes an inactive account unable to hold a valid session, so `401` is the contractually correct outcome. The "historical data preserved" assertions are unchanged. |
| `ticket-detail.api.test.ts` — missing-header case | Reclassified from `422` to `401` | Same reason: the header no longer exists; an unauthenticated request is `401 UNAUTHENTICATED` per the frozen §0 canonical table. |
| `reference-data.api.test.ts` — "does not require header" | Renamed to "requires an authenticated session" | The endpoint was public in Lab 2 and is authenticated in Lab 3 (api-spec §5/§6). The assertion direction inverts because the contract changed, not because the test was weakened. |
| `attachments.api.test.ts` — list response shape | Kept as a bare array | The landed Lab 2 response shape is a bare array (not `{data: [...]}`). #37 preserves it (RR-02); the frozen `authorization.api.test.ts` asserts the same shape. |
| `my-tickets.api.test.ts` — `API-MY-07` "returns 400 for invalid status enum" | Probe value moved from `CLOSED` to `NOT_A_STATUS` (rule unchanged); replacement case asserts `CLOSED` is now accepted | Lab 2 had only the `NEW` status, so `CLOSED` was out-of-enum. Lab 3's frozen contract (api-spec §8) filters on the full eight-value `TicketStatus` enum, so `CLOSED` is now a **valid** filter value. The rule under test — an out-of-enum status is a validation error, not a fallback default — is preserved; only the probe value had to move to a value genuinely outside the enum. Found by the full server suite during the 2026-09-20 review follow-up. |

## Results Log (newest first)

- **2026-09-20 — Issue #37 review follow-up (My Tickets status/sort contract alignment)**
  - **P2 — My Tickets diverged from the frozen Lab 3 filtering and sorting contract (real defect,
    fixed in the code).** `getMyTicketsHandler` accepted only `status=NEW` (any other valid status
    returned `400 VALIDATION_ERROR`) and did not recognize the documented `sort=status` /
    `sort=priority`; the frontend mirrored both gaps. `server/src/controller.ts` now validates
    `status` against the full frozen `TicketStatus` enum and accepts
    `createdAt/ticketNumber/summary/status/priority` (with `requestedPriority` retained as a Lab 2
    alias); `server/src/service.ts` orders `status` by the logical workflow sequence and `priority`
    by `LOW < MEDIUM < HIGH`; `client/src/MyTickets.tsx` offers all eight statuses and makes the
    Requested Priority / Current Status columns sortable; `client/src/App.css` gained badge styles
    for the seven previously unstyled statuses.
  - **Invalid-value behavior deliberately unchanged.** Safe-default fallback applies only to
    `sort`/`order`/`page`/`pageSize`; out-of-enum `status`/`requestedPriority` and malformed
    `categoryId` remain `400 VALIDATION_ERROR` (nonexistent/inactive `categoryId` →
    `409 INACTIVE_REFERENCE`), per the preserved Lab 2 contract. Both classes are now documented
    explicitly in `api-spec.md` §8.
  - **`requesterId` clarification (documentation only).** A mismatched client-supplied
    `requesterId` is **ignored** (frozen convention; BR-03), not rejected; `api-spec.md` §0 now
    records this explicitly, including that the Issue #37 checklist wording is satisfied in
    substance but the literal HTTP behavior is *ignore*, not *reject*.
  - **Tests.** Extended the frozen `API-REQ-02` row (non-`NEW` status filtering; five documented
    sort keys in both directions; `sort=status` and `sort=priority` logical-order assertions; the
    retained alias; invalid-`sort` fallback; preserved `400` for out-of-enum filters) and added
    supplementary `UI-MY-08` for the frontend dropdown and sort keys. One Lab 2 assertion
    (`API-MY-07`'s `CLOSED` probe) was **superseded** by the widened enum — recorded in the table
    above.
  - Results: server **431 passed, 0 skipped**; client **120 passed, 0 skipped**; Lab 2 E2E
    **156 passed** across 3 projects (desktop/tablet/mobile), matching the recorded baseline.
  - Note: an initial E2E run reported 13 `[mobile]` failures, all
    `page.goto: net::ERR_CONNECTION_REFUSED` — an **environment failure** (the dev servers had
    been stopped), not an implementation defect. The re-run with the servers up was fully green.
  - Follow-up: none.

## Class (c) regressions found and fixed (fix the code, never the test)

| Case | Resolution | Rationale |
|---|---|---|
| `client/src/api.ts` — `fetchCategories` response shape | Fixed the code: `fetchCategories` now returns the bare array | Commit `1bfd8c0` wrapped the response in `{data: [...]}` and read `payload.data`, but `GET /api/categories` returns a bare array. This crashed `MyTickets` (`categories.map is not a function`) the moment an authenticated session rendered the shell. The Lab 2 E2E migration surfaced it. Fixed to the landed contract; the client test mock was aligned to the bare-array shape. `fetchRelatedSystems` already matched its `{data: [...]}` contract and was left unchanged. |

## Prohibitions honored

- No failing test was deleted to obtain green CI. Every deletion is a class (b)
  retirement of behavior that no longer exists, and each has a replacement assertion
  recorded above.
- No Ticket/Attachment assertion was weakened. Where a signature or response key
  changed, the assertion was updated to the new contract, not relaxed.
- Every test change appears in this mapping — server unit/integration suites, client
  suites, and the `e2e/lab-02/` Playwright suite.
- The E2E suite is covered by the same rule: no layout, overflow, touch-target,
  ownership, or partial-success assertion was removed; retired selector/header
  assertions each have an authenticated-identity replacement recorded above.
- One class (c) regression (`fetchCategories` response shape) was found while
  migrating the E2E suite and was fixed in the code, not by changing the test.
