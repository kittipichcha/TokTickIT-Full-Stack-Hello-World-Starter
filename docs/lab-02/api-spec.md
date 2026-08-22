# Lab 2 API Contract — TokTickIT Requester Ticketing MVP

## 0. Conventions

**Base path:** `/api`

**Requester identity (not authentication):** Every requester-scoped endpoint that reads or writes
requester-owned data requires the header:
```
X-Dev-Requester-Id: <integer>
```
Bootstrap/reference endpoints are exempt (`GET /api/dev-requesters`, `GET /api/categories`,
`GET /api/related-systems`). This is a Lab 2 testing convenience (BR-21). The backend still
validates the header value against active `DevRequester` records on every requester-scoped call
— it is never trusted blindly.

**Standard error shape:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Summary must be between 5 and 120 characters.",
    "fields": { "summary": "Must be between 5 and 120 characters." }
  }
}
```
`fields` is present only for `400` validation errors and omitted otherwise.

**Standard pagination metadata (list endpoints):**
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

### Normative edge-case matrices
The following cases are mandatory and part of the implemented contract; the implementation must not choose a different behavior.

**Summary / Description normalization**
- Trim first, then validate.
- Persist the trimmed value.
- Whitespace-only strings are invalid.
- Summary: 5–120 chars after trim accepted; 4 or fewer rejected; 121 or more rejected.
- Description: 10–2000 chars after trim accepted; 9 or fewer rejected; 2001 or more rejected.

**Reference ID validation**
- `categoryId` / `relatedSystemId` missing → `400 VALIDATION_ERROR`
- non-integer value → `400 VALIDATION_ERROR`
- negative or zero value → `400 VALIDATION_ERROR`
- positive but nonexistent ID → `409 Conflict`
- active but stale/inactive record → `409 Conflict`

**List endpoint query validation**
- `search`: trim then compare case-insensitive substring; blank-after-trim is treated as no active filter.
- `categoryId`: malformed → `400`; well-formed nonexistent/inactive → `409`.
- `requestedPriority` / `status`: invalid enum → `400`.
- `sort`: invalid field → fallback to `createdAt`.
- `order`: invalid direction → fallback to `desc`.
- `page`: invalid or out-of-range → `200` with empty `data` array and correct pagination metadata.
- `pageSize`: invalid or out-of-range → fallback to `10`.

**Attachment multi-file partial success**
- Files are processed sequentially.
- A failed file does not roll back previous successful files.
- Remaining files continue to upload.
- Failures are reported per file.
- Failed files may be retried later from Ticket Detail.

**Status code usage across this API**
| Code | Meaning here |
|---|---|
| 200 | Successful retrieval |
| 201 | Resource created |
| 400 | Invalid input (validation) |
| 404 | Resource not found **or** not owned by the requesting `X-Dev-Requester-Id` |
| 409 | Conflict (e.g., referenced Category/RelatedSystem is inactive) |
| 410 | Resource existed but has been intentionally removed (e.g., soft-deleted attachment) |
| 413 | Uploaded file exceeds 5,000,000 bytes |
| 415 | Uploaded file type not permitted |
| 422 | Requester in `X-Dev-Requester-Id` is missing, unknown, or inactive |
| 500 | Unexpected server error (safe generic message only) |

---

## 1. GET /api/categories
Retrieve active Categories for the Create Ticket form.

**Auth header:** not required (public reference data).

**Response 200**
```json
[ { "id": 1, "name": "Hardware" }, { "id": 2, "name": "Software" } ]
```

Compatibility note: Lab 2 preserves the existing Lab 1 raw-array response shape for
`GET /api/categories` (no `{ "data": [...] }` envelope for this endpoint). In contrast,
`GET /api/related-systems` and `GET /api/dev-requesters` use the standard `{ "data": [...] }`
envelope by design.

## 2. GET /api/related-systems
Retrieve active Related Systems.

**Response 200**
```json
{ "data": [ { "id": 1, "name": "Corporate Laptop" }, { "id": 2, "name": "Campus Wi-Fi" } ] }
```

## 3. GET /api/dev-requesters
Retrieve active Development Requesters for the Selector screen. Inactive requesters are
excluded server-side (BR-04) — the frontend never filters this itself.

**Response 200**
```json
{ "data": [ { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" } ] }
```

**Response 200, empty list case**
```json
{ "data": [] }
```
Frontend shows the "no active requesters" empty state.

---

## 4. POST /api/tickets
Create a Ticket owned by the requester in `X-Dev-Requester-Id`.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Request body**
```json
{
  "categoryId": 2,
  "relatedSystemId": 6,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains much faster than usual even when idle. Started after last week's Windows update.",
  "requestedPriority": "MEDIUM"
}
```

**Validation**
- `categoryId`, `relatedSystemId`: required, must reference an **active** record. Error matrix: missing/non-integer → `400` validation error (`VALIDATION_ERROR`); well-formed but nonexistent ID → `409` Conflict (`INACTIVE_REFERENCE`); existing but inactive record → `409` Conflict.
- `summary`: required, trimmed, 5–120 chars after trim; whitespace-only rejected → else `400` (`VALIDATION_ERROR`)
- `description`: required, trimmed, 10–2000 chars after trim; whitespace-only rejected → else `400` (`VALIDATION_ERROR`)
- `requestedPriority`: required, one of `LOW|MEDIUM|HIGH` → else `400` (`VALIDATION_ERROR`)

**Response 201**
```json
{
  "data": {
    "id": 501,
    "ticketNumber": "TKT-2026-000123",
    "requesterId": 1,
    "categoryId": 2,
    "relatedSystemId": 6,
    "summary": "Laptop battery drains quickly",
    "description": "Battery drains much faster than usual even when idle. Started after last week's Windows update.",
    "requestedPriority": "MEDIUM",
    "itPriority": null,
    "ticketOwnerId": null,
    "currentStatus": "NEW",
    "createdAt": "2026-08-21T09:14:00.000Z",
    "updatedAt": "2026-08-21T09:14:00.000Z"
  }
}
```

**Error cases**
- `422` — header missing / requester unknown / requester inactive
- `400` — validation failure (see `fields`)
- `409` — `categoryId` or `relatedSystemId` refers to an inactive record
- `500` — unexpected error; ticket is not partially created (all-or-nothing)

---

## 5. GET /api/tickets
Retrieve the selected Requester's own Tickets — search, filter, sort, paginate.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive substring match on `ticketNumber` or `summary`. Trimmed; blank-after-trim treated as no search active. |
| `categoryId` | int | — | Filter by category. Malformed (non-integer) → 400; nonexistent but well-formed → 409; stale/inactive → 409. |
| `requestedPriority` | `LOW\|MEDIUM\|HIGH` | — | Filter by requested priority. Invalid enum value (e.g., "URGENT") → 400. |
| `status` | `NEW` | — | Filter by status. Invalid enum value (e.g., "CLOSED") → 400. (Only `NEW` possible in Lab 2.) |
| `sort` | `createdAt\|ticketNumber\|summary\|requestedPriority` | `createdAt` | Sort field. Invalid value → fallback to default. |
| `order` | `asc\|desc` | `desc` | Sort direction. Invalid value → fallback to default. |
| `page` | int ≥1 | `1` | Page number. Out-of-range (beyond totalPages) or invalid → return 200 with empty data array; totalPages set correctly. |
| `pageSize` | int 1–50 | `10` | Page size. Invalid/out-of-range → fallback to default (10). |

**Pagination behavior for out-of-range pages:**
- If `page > totalPages` (e.g., requesting page 999 when totalPages=3), return `200 OK` with `data: []` and accurate metadata showing `totalPages: 3`.
- Frontend must not confuse empty array with normal Empty state; the `pagination.totalPages` value disambiguates.

Deterministic ordering rules:
- Primary sort: requested `sort` field + requested `order`
- Secondary sort: `createdAt desc`
- Tertiary sort: `id desc`
- When `sort=requestedPriority`, logical order is `LOW < MEDIUM < HIGH` (not alphabetical)

**Example**
```
GET /api/tickets?search=laptop&categoryId=2&sort=createdAt&order=desc&page=1&pageSize=10
```

**Response 200**
```json
{
  "data": [
    {
      "id": 501,
      "ticketNumber": "TKT-2026-000123",
      "summary": "Laptop battery drains quickly",
      "categoryId": 2,
      "categoryName": "Hardware",
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "currentStatus": "NEW",
      "createdAt": "2026-08-21T09:14:00.000Z",
      "updatedAt": "2026-08-21T09:14:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```
An empty `data` array with `totalItems: 0` covers **both** the Empty and No-Results UI
states (BR-23) — the frontend distinguishes them by whether any `search`/filter query
params were present on the request that returned zero results.

---

## 6. GET /api/tickets/:ticketNumber
Retrieve one owned Ticket's full detail, including its active + removed attachment list.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200**
```json
{
  "data": {
    "id": 501,
    "ticketNumber": "TKT-2026-000123",
    "requesterId": 1,
    "requesterName": "Jennifer Anderson",
    "requesterIsActive": true,
    "categoryId": 2,
    "categoryName": "Hardware",
    "relatedSystemId": 6,
    "relatedSystemName": "Corporate Laptop",
    "summary": "Laptop battery drains quickly",
    "description": "Battery drains much faster than usual...",
    "requestedPriority": "MEDIUM",
    "itPriority": null,
    "ticketOwnerId": null,
    "currentStatus": "NEW",
    "createdAt": "2026-08-21T09:14:00.000Z",
    "updatedAt": "2026-08-21T09:14:00.000Z",
    "attachments": [
      {
        "id": 9001,
        "originalFilename": "battery-report.pdf",
        "mimeType": "application/pdf",
        "fileSizeBytes": 214532,
        "uploadedAt": "2026-08-21T09:15:00.000Z",
        "isRemoved": false
      }
    ]
  }
}
```

**Response 404** — ticket doesn't exist, or exists but is owned by a different requester
than the one in `X-Dev-Requester-Id` (BR-24: identical response either way).

---

## 7. POST /api/tickets/:ticketNumber/attachments
Upload a permitted attachment to an owned Ticket. `multipart/form-data`, field name `file`.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Validation**
- Ticket must exist and be owned by requester → else `404`
- Ticket must have <5 active attachments → else `400` (`ATTACHMENT_LIMIT_REACHED`)
- File type must be JPG/JPEG/PNG/WEBP/PDF, verified by extension **and** content sniffing → else `415`
- File size must be ≤ `5,000,000` bytes (`4,999,999` and `5,000,000` accepted; `5,000,001` rejected) → else `413`

**Response 201**
```json
{
  "data": {
    "id": 9002,
    "ticketId": 501,
    "originalFilename": "screenshot.png",
    "mimeType": "image/png",
    "fileSizeBytes": 88213,
    "uploadedAt": "2026-08-21T09:20:00.000Z",
    "isRemoved": false
  }
}
```

## 8. GET /api/tickets/:ticketNumber/attachments
List attachment metadata (active and removed) for an owned Ticket. Results are ordered deterministically by `uploadedAt asc, id asc` for stable pagination and test reproducibility.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200** — same shape as the `attachments` array in Section 6, including removed
entries with `isRemoved: true`, `removedAt`, `removalReason`, `removedByRequesterId`.

## 9. GET /api/attachments/:attachmentId/download
Download the raw file bytes of an **active** attachment on an owned ticket.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200** — binary stream, `Content-Type` set from stored `mimeType`,
`Content-Disposition: attachment; filename="<originalFilename>"`.

**Error cases**
- `404` — attachment/ticket not found or not owned
- `410` — attachment exists but `isRemoved: true` ("Gone" — file was intentionally removed)

## 10. GET /api/attachments/:attachmentId/preview
Return a previewable representation of an **active** attachment: the image itself, or the
rendered first page of a PDF (as an image). This endpoint is a Lab 2 enhancement beyond
the minimum handout requirement (see `specification.md` §11).

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200** — `image/*` bytes suitable for inline `<img>` display.
**Error cases** — same `404`/`410` rules as Download.

## 11. DELETE /api/attachments/:attachmentId
Soft-remove an owned attachment.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Request body**
```json
{ "removalReason": "Wrong file, replaced by a clearer screenshot." }
```
`removalReason` is optional. Normalization: trimmed; omitted or blank-after-trim → persisted as null; non-string → 400 validation error; 1–200 chars after trim → accepted and persisted; >200 chars after trim → rejected with 400 validation error.

**Response 200**
```json
{
  "data": {
    "id": 9002,
    "isRemoved": true,
    "removedAt": "2026-08-21T09:30:00.000Z",
    "removalReason": "Wrong file, replaced by a clearer screenshot.",
    "removedByRequesterId": 1
  }
}
```

**Error cases**
- `404` — attachment/ticket not found or not owned
- `409` — attachment is already removed (idempotency guard; removing twice is not silently accepted)