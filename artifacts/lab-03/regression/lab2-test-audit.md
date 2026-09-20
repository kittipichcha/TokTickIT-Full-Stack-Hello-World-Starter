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
| `my-tickets.api.test.ts` | (a) | Fixture swapped only. |
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
| `lab-02-tests/RequesterSelection.integration.test.tsx` | (b) | Entirely superseded (selector flow + `X-Dev-Requester-Id` header + `toktickit.requesterId` storage key). **Retired and replaced** with credentialed-transport assertions. |
| `lab-02-tests/format.test.ts` | (a) | Unchanged — pure formatting helpers, no identity. |

## Ambiguous cases flagged for the human reviewer

| Case | Resolution | Rationale |
|---|---|---|
| `my-tickets-real-db.integration.test.ts` — inactive-requester block | Reclassified from `422 REQUESTER_CONTEXT_INVALID` to `401 UNAUTHENTICATED` | The `422` code belonged to the removed Dev-Requester mechanism. Lab 3's frozen fresh-User authority rule (#35 Rev 8/13) makes an inactive account unable to hold a valid session, so `401` is the contractually correct outcome. The "historical data preserved" assertions are unchanged. |
| `ticket-detail.api.test.ts` — missing-header case | Reclassified from `422` to `401` | Same reason: the header no longer exists; an unauthenticated request is `401 UNAUTHENTICATED` per the frozen §0 canonical table. |
| `reference-data.api.test.ts` — "does not require header" | Renamed to "requires an authenticated session" | The endpoint was public in Lab 2 and is authenticated in Lab 3 (api-spec §5/§6). The assertion direction inverts because the contract changed, not because the test was weakened. |
| `attachments.api.test.ts` — list response shape | Kept as a bare array | The landed Lab 2 response shape is a bare array (not `{data: [...]}`). #37 preserves it (RR-02); the frozen `authorization.api.test.ts` asserts the same shape. |

## Prohibitions honored

- No failing test was deleted to obtain green CI. Every deletion is a class (b)
  retirement of behavior that no longer exists, and each has a replacement assertion
  recorded above.
- No Ticket/Attachment assertion was weakened. Where a signature or response key
  changed, the assertion was updated to the new contract, not relaxed.
- Every test change appears in this mapping.
