# Lab 3 API Contract — TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 0. Conventions

**Base path:** `/api`

**Authentication (session cookie):** Lab 3 replaces the Lab 2 `X-Dev-Requester-Id` header with
a real authenticated session. On successful login the backend establishes an httpOnly session
cookie. Protected endpoints require a valid session. The authenticated user identity, never a
client-supplied `requesterId`, determines ownership of Requester operations (BR-03).

**Standard error shape:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and password are required.",
    "fields": { "email": "Email is required." }
  }
}
```
`fields` is present when the `400` response represents a field/body/query validation failure
(`VALIDATION_ERROR`) and is omitted for non-`400` responses and for `400`-level conditions that
are not field-validation errors (e.g. `ATTACHMENT_LIMIT_REACHED`).

All API error responses use this JSON error object shape. `error.code` is one of `VALIDATION_ERROR`, `UNAUTHENTICATED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INACTIVE_REFERENCE`, `TICKET_SEQUENCE_EXHAUSTED`,
`ATTACHMENT_LIMIT_REACHED`, `ATTACHMENT_REMOVED`, `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`,
`INTERNAL_ERROR`, or `PASSWORD_CHANGE_REQUIRED`. `500` responses use only `INTERNAL_ERROR` and
the message `An unexpected error occurred.`; they must not expose stack traces, database errors,
storage paths, or parser details.

**Canonical status/condition → `error.code` table (frozen; implementations must not invent alternatives):**
| HTTP status | Condition | `error.code` |
|---|---|---|
| 400 | Field/body/query validation failure | `VALIDATION_ERROR` |
| 401 | No valid session / not authenticated | `UNAUTHENTICATED` |
| 401 | Authenticated but must change password before proceeding | `PASSWORD_CHANGE_REQUIRED` |
| 403 | Authenticated but role not permitted | `FORBIDDEN` |
| 404 | Resource missing or not owned by the caller (Ticket, Attachment, Note) | `NOT_FOUND` |
| 409 | Referenced `categoryId`/`relatedSystemId` well-formed but nonexistent | `INACTIVE_REFERENCE` |
| 409 | Referenced `categoryId`/`relatedSystemId` exists but is inactive | `INACTIVE_REFERENCE` |
| 409 | Ticket sequence exhausted for the UTC year | `TICKET_SEQUENCE_EXHAUSTED` |
| 409 | Forbidden status transition | `CONFLICT` |
| 409 | Duplicate email address | `CONFLICT` |
| 409 | Attachment already removed (soft-delete idempotency guard) | `CONFLICT` |
| 410 | Attachment exists but is soft-removed | `ATTACHMENT_REMOVED` |
| 413 | Uploaded file exceeds the byte limit | `FILE_TOO_LARGE` |
| 415 | Uploaded file type/signature not permitted | `UNSUPPORTED_MEDIA_TYPE` |
| 500 | Unexpected server error | `INTERNAL_ERROR` |

**Request parsing:** JSON endpoints require `Content-Type: application/json`; a malformed JSON
document, a non-object JSON value, or a wrong content type returns `400 VALIDATION_ERROR`.
Unknown JSON properties are ignored unless this contract lists them as stored data. All integer
values accept only the decimal grammar `0|[1-9][0-9]*` with no sign, decimal point, whitespace,
or exponent.

**Standard pagination metadata (list endpoints):**
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 42,
    "totalPages": 5,
    "unfilteredTotalItems": 57
  }
}
```

**Authentication/session decisions (frozen):**
- Mechanism: httpOnly session cookie backed by a server-side session store.
- Password hashing: bcrypt.
- Session expiration: 30-minute idle timeout (see Security configuration policy below).
- Concurrent sessions: a user may hold **multiple concurrent sessions** (e.g. several devices or
  browsers). Logging in from a second device does **not** invalidate an existing session; each
  session remains valid until it independently times out or logs out (Section 13, decision 16 of
  `specification.md`).
- Logout invalidates the session server-side.
- CSRF: protected endpoints require a CSRF token for state-changing requests where applicable.
- Safe errors: login failure returns a generic message that does not reveal whether the email
  exists or the password was wrong.

**Security configuration policy (frozen):** The exact session-cookie attributes and CSRF
mechanism are repository/environment configuration decisions, not invented by the
implementation agent. The implementation must satisfy the following required
security properties, and the concrete configuration must be documented in the repository
configuration and reflected in the planned security tests:

- **Session idle timeout (frozen value):** The Lab 3 contract value is **30 minutes** of idle
  time. An idle session expires after 30 minutes and behaves exactly like an unauthenticated
  session (`401 UNAUTHENTICATED`); the user must log in again. Any request refreshes the idle
  timer. There is no separate absolute timeout in Lab 3.
- **Session-cookie attributes:** The session cookie is `httpOnly` and `SameSite`-protected. In
  production it is `Secure`. The cookie must not be readable by client-side script.
- **CSRF:** Every state-changing (non-`GET`/`HEAD`/`OPTIONS`) protected endpoint is protected
  against cross-site request forgery. The CSRF token is obtained from the authenticated session
  and validated server-side before the mutation is applied. A missing or invalid CSRF token
  rejects the request with `403 FORBIDDEN`. The exact token mechanism (e.g. synchronizer token
  or double-submit cookie) is a configuration decision, but the property that all state-changing
  protected endpoints require a valid CSRF token is normative.
- **Password transport:** Passwords are transmitted only over a protected transport (HTTPS in
  production) (BR-06).

---

## 1. POST /api/auth/login

**Auth:** none (public).

**Request body**
```json
{ "email": "requester@example.com", "password": "secret" }
```

**Validation**
- `email` required, valid email format.
- `password` required, non-empty.

**Response 200**
```json
{ "data": { "id": 1, "name": "Requester One", "email": "requester@example.com", "role": "REQUESTER", "mustChangePassword": false } }
```

**Error cases**
- `400 VALIDATION_ERROR` — missing/invalid email or password.
- `401 UNAUTHENTICATED` — invalid credentials or inactive account (safe generic message).

---

## 2. POST /api/auth/logout

**Auth:** authenticated session.

**Response 200**
```json
{ "data": { "success": true } }
```

**Error cases**
- `401 UNAUTHENTICATED` — no valid session.

---

## 3. GET /api/auth/me

**Auth:** authenticated session.

**Response 200**
```json
{ "data": { "id": 1, "name": "Requester One", "email": "requester@example.com", "role": "REQUESTER", "mustChangePassword": false } }
```

**Error cases**
- `401 UNAUTHENTICATED` — no valid session.

---

## 4. POST /api/auth/change-password

**Auth:** authenticated session.

**Request body**
```json
{ "currentPassword": "old", "newPassword": "new-secret" }
```

**Validation**
- `currentPassword` required.
- `newPassword` required and must satisfy the frozen password policy (Section 13, decision 12
  of `specification.md`): 12–128 characters; at least one uppercase ASCII letter (A–Z), one
  lowercase ASCII letter (a–z), one digit (0–9), and one ASCII special character from
  `!@#$%^&*()-_=+[]{};:,.?/\`; not trimmed before validation; whitespace permitted.

**Response 200**
```json
{ "data": { "success": true, "mustChangePassword": false } }
```

**Error cases**
- `400 VALIDATION_ERROR` — missing/invalid fields, `newPassword` violates the password policy
  (too short, too long, or missing a required character class), or `currentPassword` does not
  match the account's current password. The wrong-`currentPassword` message is generic (e.g.
  "current password is incorrect") and does not reveal anything beyond that; it must not hint
  at why it was wrong (BR-07-style safe failure).
- `401 UNAUTHENTICATED` — no valid session.
- No `PASSWORD_CHANGE_REQUIRED` case: a user who must change their password is the legitimate
  caller of this endpoint (FR-05, BR-02). `BR-02`'s gate blocks access to *normal application*
  screens and endpoints, not to the password-change endpoint itself.

**Guard note (frozen):** For other endpoints, a user who must change their password before
proceeding receives `401 PASSWORD_CHANGE_REQUIRED`; that code is **not** returned by the
`change-password` endpoint itself.

---

## 5. GET /api/categories

**Auth:** authenticated session (public reference data, but requires login in Lab 3).

**Response 200**
```json
{ "data": [ { "id": 1, "name": "Hardware", "isActive": true } ] }
```

---

## 6. GET /api/related-systems

**Auth:** authenticated session.

**Response 200**
```json
{ "data": [ { "id": 1, "name": "POS", "isActive": true } ] }
```

---

## 7. POST /api/tickets

**Auth:** authenticated Requester.

**Request body**
```json
{ "categoryId": 1, "relatedSystemId": 1, "summary": "Printer not working", "description": "The printer is offline.", "requestedPriority": "MEDIUM" }
```

**Validation**
- `categoryId`, `relatedSystemId` must reference active records.
- `summary` 5–120 chars after trim.
- `description` 10–2,000 chars after trim.
- `requestedPriority` one of `LOW`, `MEDIUM`, `HIGH`.

**Response 201**
```json
{ "data": { "id": 501, "ticketNumber": "TKT-2026-000123", "currentStatus": "NEW", "requestedPriority": "MEDIUM", "itPriority": "MEDIUM", "ticketOwnerId": null } }
```

**Error cases**
- `400 VALIDATION_ERROR` — invalid fields.
- `409 INACTIVE_REFERENCE` — nonexistent/inactive category or related system.
- `409 TICKET_SEQUENCE_EXHAUSTED` — sequence exhausted.

---

## 8. GET /api/tickets

**Auth:** authenticated Requester. Returns only owned Tickets (My Tickets).

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | substring match on `ticketNumber` and `summary` |
| `categoryId` | int | — | filter |
| `requestedPriority` | enum | — | filter |
| `status` | enum | — | filter |
| `sort` | string | `createdAt` | one of `createdAt`, `ticketNumber`, `summary`, `status`, `priority` |
| `order` | string | `desc` | `asc`/`desc` |
| `page` | int | `1` | page |
| `pageSize` | int | `10` | 1–50 |

**Query semantics (frozen):** `search` is a case-insensitive substring match against
`ticketNumber` and `summary`; filters combine with AND; `sort` accepts only `createdAt`,
`ticketNumber`, `summary`, `status`, and `priority`; default is `createdAt desc`; `pageSize`
defaults to `10` and accepts `1`–`50`. Invalid query values fall back to safe defaults (never
`400`), matching `tests.md` `API-QUE-02`.

**Response 200**
```json
{ "data": [ /* owned tickets */ ], "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5, "unfilteredTotalItems": 57 } }
```

---

## 9. GET /api/tickets/:ticketNumber

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Response 200**
```json
{ "data": { "id": 501, "ticketNumber": "TKT-2026-000123", "summary": "Printer not working", "currentStatus": "NEW", "requestedPriority": "MEDIUM", "itPriority": "MEDIUM", "ticketOwnerId": null, "requesterId": 1 } }
```

**Error cases**
- `404 NOT_FOUND` — not found or not owned (Requester).

---

## 10. POST /api/tickets/:ticketNumber/attachments

**Auth:** authenticated Requester (owner of the Ticket). Attachment mutation is Requester-only
(BR-12); IT Staff/Administrator may view but not upload Attachments.

**Request:** multipart `file` upload.

**Response 201**
```json
{ "data": { "id": 10, "originalFilename": "photo.jpg", "mimeType": "image/jpeg", "fileSizeBytes": 12345, "isRemoved": false } }
```

**Error cases**
- `400 ATTACHMENT_LIMIT_REACHED` — exceeds 5 active attachments.
- `413 FILE_TOO_LARGE` — exceeds byte limit.
- `415 UNSUPPORTED_MEDIA_TYPE` — type/signature not permitted.

---

## 11. GET /api/tickets/:ticketNumber/attachments

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Response 200**
```json
{ "data": [ /* attachments */ ] }
```

---

## 12. GET /api/attachments/:attachmentId/download

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Response 200:** file bytes with content headers.

**Error cases**
- `404 NOT_FOUND` — not found or not owned.
- `410 ATTACHMENT_REMOVED` — soft-removed.

---

## 13. GET /api/attachments/:attachmentId/preview

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Response 200:** image inline or PDF first page.

**Error cases**
- `404 NOT_FOUND` — not found or not owned.
- `410 ATTACHMENT_REMOVED` — soft-removed.

---

## 14. DELETE /api/attachments/:attachmentId

**Auth:** authenticated Requester (owner of the Ticket). Attachment mutation is Requester-only
(BR-12); IT Staff/Administrator may view but not remove Attachments.

**Response 200**
```json
{ "data": { "id": 10, "isRemoved": true, "removedAt": "2026-09-10T00:00:00Z" } }
```

**Error cases**
- `404 NOT_FOUND` — not found or not owned.
- `409 CONFLICT` — already removed.

---

## 15. GET /api/staff/queue

**Auth:** IT Staff or Administrator.

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | substring match on `ticketNumber` and `summary` |
| `status` | enum | — | filter; one of the eight Ticket statuses |
| `priority` | enum | — | filter; `LOW`/`MEDIUM`/`HIGH` (matches IT Priority) |
| `ownerId` | int | — | filter; Ticket Owner user id |
| `sort` | string | `createdAt` | one of `createdAt`, `ticketNumber`, `summary`, `status`, `priority` |
| `order` | string | `desc` | `asc`/`desc` |
| `page` | int | `1` | page |
| `pageSize` | int | `10` | 1–50 |

**Query semantics (frozen):**
- `search` is a case-insensitive substring match against `ticketNumber` and `summary`. A match
  on either field qualifies.
- `status`, `priority`, and `ownerId` are exact-match filters; multiple filters combine with
  AND.
- `sort` accepts only `createdAt`, `ticketNumber`, `summary`, `status`, and `priority`. `order`
  is `asc` or `desc`; default is `createdAt desc`.
- `page` defaults to `1`; `pageSize` defaults to `10` and accepts `1`–`50`.
- **Invalid query values fall back to safe defaults** (e.g. an unknown `sort` value falls back
  to `createdAt desc`; an out-of-range `pageSize` is clamped to the nearest bound; a malformed
  `page` falls back to `1`). Invalid values never return `400`; they are treated as absent.
  This matches `tests.md` `API-QUE-02`.

**Response 200**
```json
{ "data": [ /* tickets with ownership/status/priority */ ], "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5, "unfilteredTotalItems": 57 } }
```

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.

---

## 16. GET /api/staff/tickets/:ticketNumber

**Auth:** IT Staff or Administrator.

**Response 200**
```json
{ "data": { "id": 501, "ticketNumber": "TKT-2026-000123", "summary": "Printer not working", "currentStatus": "NEW", "requestedPriority": "MEDIUM", "itPriority": "MEDIUM", "ticketOwnerId": null, "requesterId": 1, "publicComments": [], "internalNotes": [] } }
```

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.
- `404 NOT_FOUND` — not found.

---

## 17. POST /api/staff/tickets/:ticketNumber/owner

**Auth:** IT Staff or Administrator.

**Request body**
```json
{ "ownerId": 5 }
```

**Validation**
- `ownerId` must reference an active IT Staff or Administrator user.

**Response 200**
```json
{ "data": { "ticketOwnerId": 5 } }
```

**Concurrency (frozen):** Two simultaneous claim/reassign requests for the same Ticket are
handled as **last-write-wins**. Both requests may succeed; whichever transaction commits last is
recorded as the final `ticketOwnerId`. No conflict error is surfaced to the "losing" caller
(Section 13, decision 15 of `specification.md`).

**Error cases**
- `400 VALIDATION_ERROR` — invalid ownerId.
- `403 FORBIDDEN` — not IT Staff/Administrator.
- `404 NOT_FOUND` — Ticket not found.
- `409 CONFLICT` — owner not active IT Staff/Administrator.

---

## 18. PATCH /api/staff/tickets/:ticketNumber/priority

**Auth:** IT Staff or Administrator.

**Request body**
```json
{ "itPriority": "HIGH" }
```

**Validation**
- `itPriority` one of `LOW`, `MEDIUM`, `HIGH`.

**Response 200**
```json
{ "data": { "itPriority": "HIGH" } }
```

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.
- `404 NOT_FOUND` — Ticket not found.

---

## 19. PATCH /api/staff/tickets/:ticketNumber/status

**Auth:** IT Staff or Administrator.

**Request body**
```json
{ "status": "IN_PROGRESS" }
```

**Validation**
- `status` must be a permitted transition per the Status Transition Matrix.

**Response 200**
```json
{ "data": { "currentStatus": "IN_PROGRESS" } }
```

**Claim-before-status-change (frozen):** A status change on a Ticket that is not yet owned
(`ticketOwnerId` is `null`) is rejected with `409 CONFLICT` — the Ticket must be claimed via
`POST /api/staff/tickets/:ticketNumber/owner` before its status can be changed. The status
endpoint never auto-claims a Ticket (Section 13, decision 14 of `specification.md`).

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.
- `404 NOT_FOUND` — Ticket not found.
- `409 CONFLICT` — forbidden transition, or the Ticket is not yet claimed (see above).

---

## 20. POST /api/tickets/:ticketNumber/comments

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Request body**
```json
{ "content": "Please check the printer." }
```

**Validation**
- `content` 1–2,000 chars after trim; whitespace-only rejected.

**Response 201**
```json
{ "data": { "id": 1, "content": "Please check the printer.", "authorId": 1, "createdAt": "2026-09-10T00:00:00Z" } }
```

---

## 20a. POST /api/tickets/:ticketNumber/appears-resolved

**Auth:** authenticated Requester (owner of the Ticket). (BR-05, FR-13)

**Request body**
```json
{ "appearsResolved": true }
```

**Validation**
- `appearsResolved` required boolean.

**Response 200**
```json
{ "data": { "ticketNumber": "TKT-2026-000123", "appearsResolved": true, "currentStatus": "NEW" } }
```

**Error cases**
- `404 NOT_FOUND` — not found or not owned by the authenticated Requester (BR-12). A Requester-
  supplied ownership mismatch returns `404`, never `403`, so a non-owner cannot confirm the
  Ticket exists. (`403 FORBIDDEN` is not used here.)

**Notes:** This sets only the Requester "Problem Appears Resolved" boolean indicator (BR-19). It
must **not** change the formal Ticket status to Resolved or Closed.

---

## 21. GET /api/tickets/:ticketNumber/comments

**Auth:** authenticated Requester (owned) or IT Staff/Administrator.

**Response 200**
```json
{ "data": [ /* public comments */ ] }
```

---

## 22. POST /api/staff/tickets/:ticketNumber/notes

**Auth:** IT Staff or Administrator.

**Request body**
```json
{ "content": "Internal note." }
```

**Validation**
- `content` 1–2,000 chars after trim; whitespace-only rejected.

**Response 201**
```json
{ "data": { "id": 1, "content": "Internal note.", "authorId": 5, "createdAt": "2026-09-10T00:00:00Z" } }
```

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.

---

## 23. GET /api/staff/tickets/:ticketNumber/notes

**Auth:** IT Staff or Administrator.

**Response 200**
```json
{ "data": [ /* internal notes */ ] }
```

**Error cases**
- `403 FORBIDDEN` — not IT Staff/Administrator.

---

## 24. GET /api/admin/users

**Auth:** Administrator.

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | name/email substring |
| `role` | enum | — | optional role filter |

**Query semantics (frozen):** `search` is a case-insensitive substring match against `name` and
`email`. `role` is an exact-match filter on `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. An
**unrecognized `role` value is treated as no filter applied** (matches the Staff Queue precedent
in §15); it never returns `400`.

**Response 200**
```json
{ "data": [ { "id": 1, "name": "Requester One", "email": "requester@example.com", "role": "REQUESTER", "isActive": true } ] }
```

**Error cases**
- `403 FORBIDDEN` — not Administrator.

---

## 25. POST /api/admin/users

**Auth:** Administrator.

**Request body**
```json
{ "name": "New User", "email": "new@example.com", "role": "REQUESTER", "isActive": true, "initialPassword": "temp-secret" }
```

**Validation**
- `name` required.
- `email` required, valid, unique.
- `role` one of `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
- `initialPassword` must satisfy the frozen password policy (Section 13, decision 12 of
  `specification.md`): 12–128 characters; at least one uppercase ASCII letter (A–Z), one
  lowercase ASCII letter (a–z), one digit (0–9), and one ASCII special character from
  `!@#$%^&*()-_=+[]{};:,.?/\`; not trimmed before validation; whitespace permitted.

**Response 201**
```json
{ "data": { "id": 2, "name": "New User", "email": "new@example.com", "role": "REQUESTER", "isActive": true, "mustChangePassword": true } }
```

**Error cases**
- `400 VALIDATION_ERROR` — invalid fields, or `initialPassword` violates the password policy.
- `409 CONFLICT` — duplicate email.

---

## 26. PATCH /api/admin/users/:userId

**Auth:** Administrator.

**Request body**
```json
{ "name": "Updated", "email": "updated@example.com", "role": "IT_STAFF", "isActive": true }
```

**Validation**
- `name`, `email`, `role`, `isActive` as above.
- Cannot deactivate own account.
- Cannot deactivate the last active Administrator.
- Cannot change the last active Administrator's role to a non-Administrator role.
- An Administrator **may** change their own role away from Administrator, provided at least one
  other active Administrator remains after the change (BR-34). The last-active-Administrator
  guard (BR-28) blocks only the *last* active Administrator from stepping down; it does not
  block a non-last Administrator from doing so.

**Response 200**
```json
{ "data": { "id": 2, "name": "Updated", "email": "updated@example.com", "role": "IT_STAFF", "isActive": true } }
```

**Error cases**
- `400 VALIDATION_ERROR` — invalid fields.
- `403 FORBIDDEN` — not Administrator.
- `404 NOT_FOUND` — user does not exist.
- `409 CONFLICT` — duplicate email, self-deactivation, last-active-Administrator deactivation,
  or last-active-Administrator role change to a non-Administrator role.

---

## 27. POST /api/admin/users/:userId/initial-password

**Auth:** Administrator.

**Request body**
```json
{ "initialPassword": "new-temp-secret" }
```

**Validation**
- `initialPassword` must satisfy the frozen password policy (Section 13, decision 12 of
  `specification.md`): 12–128 characters; at least one uppercase ASCII letter (A–Z), one
  lowercase ASCII letter (a–z), one digit (0–9), and one ASCII special character from
  `!@#$%^&*()-_=+[]{};:,.?/\`; not trimmed before validation; whitespace permitted.

**Response 200**
```json
{ "data": { "id": 2, "mustChangePassword": true } }
```

**Error cases**
- `400 VALIDATION_ERROR` — invalid password (violates the frozen password policy).
- `403 FORBIDDEN` — not Administrator.
- `404 NOT_FOUND` — user does not exist.