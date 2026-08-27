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
`fields` is present for every `400` response and omitted for non-`400` responses.

All errors use this object shape. `error.code` is one of `VALIDATION_ERROR`,
`NOT_FOUND`, `CONFLICT`, `INACTIVE_REFERENCE`, `ATTACHMENT_LIMIT_REACHED`,
`ATTACHMENT_REMOVED`, `TICKET_SEQUENCE_EXHAUSTED`, `REQUESTER_CONTEXT_INVALID`,
`FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, or `INTERNAL_ERROR`. `500` responses use
only `INTERNAL_ERROR` and the message `An unexpected error occurred.`; they must not
expose stack traces, database errors, storage paths, or parser details. `fields` maps
only submitted field names to a human-readable validation message and is required for
every `400` response, including `ATTACHMENT_LIMIT_REACHED`. For a `400` error with no
specific submitted field, `fields` is an empty object. For `ATTACHMENT_LIMIT_REACHED`, `fields` is
`{ "file": "The ticket already has the maximum number of active attachments." }`.
For other multipart parsing errors, `fields` identifies the relevant part when one exists;
otherwise it is `{}`. Error messages may vary except for the frozen `500` message;
automated tests must assert the HTTP status, `error.code`, and required `fields` keys.

**Canonical status/condition → `error.code` table (frozen; implementations must not invent alternatives):**
| HTTP status | Condition | `error.code` |
|---|---|---|
| 400 | Field/body/query validation failure | `VALIDATION_ERROR` |
| 400 | Attachment upload rejected only for exceeding the 5-active-attachment limit | `ATTACHMENT_LIMIT_REACHED` |
| 404 | Resource missing or not owned by the caller (Ticket or Attachment) | `NOT_FOUND` |
| 409 | Referenced `categoryId`/`relatedSystemId` well-formed but nonexistent | `INACTIVE_REFERENCE` |
| 409 | Referenced `categoryId`/`relatedSystemId` exists but is inactive | `INACTIVE_REFERENCE` |
| 409 | Ticket sequence exhausted for the UTC year | `TICKET_SEQUENCE_EXHAUSTED` |
| 409 | Attachment already removed (soft-delete idempotency guard) | `CONFLICT` |
| 410 | Attachment exists but is soft-removed | `ATTACHMENT_REMOVED` |
| 413 | Uploaded file exceeds the byte limit | `FILE_TOO_LARGE` |
| 415 | Uploaded file type/signature not permitted | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `X-Dev-Requester-Id` missing, malformed, unknown, or inactive | `REQUESTER_CONTEXT_INVALID` |
| 500 | Unexpected server error | `INTERNAL_ERROR` |

The "nonexistent" and "inactive" `409` reference-validation cases intentionally share the
same `INACTIVE_REFERENCE` code, since both mean "this reference cannot currently be used";
the human-readable `message` text differentiates the two cases for the caller.

**Request parsing:** JSON endpoints require `Content-Type: application/json`; a malformed
JSON document, a non-object JSON value, or a wrong content type returns `400
VALIDATION_ERROR`. Unknown JSON properties are ignored unless this contract lists them as
stored data. All integer values accept only the decimal grammar `0|[1-9][0-9]*` with no
sign, decimal point, whitespace, or exponent. A malformed or duplicate
`X-Dev-Requester-Id` returns `422 REQUESTER_CONTEXT_INVALID`. Malformed
`attachmentId` or `ticketNumber` path parameters return `404 NOT_FOUND`; malformed query
parameters follow the endpoint-specific rules below. Duplicate
`X-Dev-Requester-Id` headers are invalid and return `422 REQUESTER_CONTEXT_INVALID`;
duplicate query parameters use the first occurrence only.

`DELETE /api/attachments/:attachmentId` accepts an omitted body with no content type, or a
JSON body with `Content-Type: application/json`. If a body is present with another content
type, it returns `400 VALIDATION_ERROR`.

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
`totalItems` and `totalPages` describe the current normalized search/filter result.
`unfilteredTotalItems` is the selected requester's ticket count before search/filtering;
sorting and pagination do not affect it.

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
- `page`: missing, malformed, non-integer, or non-positive → use `1`; valid but beyond `totalPages` → `200` with empty `data` array and correct pagination metadata.
- `pageSize`: invalid or out-of-range → fallback to `10`.

**Ticket numbers and concurrent writes**
- The `{YYYY}` portion uses the server's UTC calendar year.
- Creation allocates the next sequence in a database transaction that serializes allocations
  for the UTC year. Concurrent creates must receive distinct numbers.
- If all `000001` through `999999` sequences are allocated for a year, creation returns
  `409 TICKET_SEQUENCE_EXHAUSTED` and creates no ticket.

**Attachment multi-file partial success**
- Files are processed sequentially.
- A failed file does not roll back previous successful files.
- Remaining files continue to upload.
- Failures are reported per file.
- Failed files may be retried later from Ticket Detail.

**Attachment filename and content rules**
| Extension (case-insensitive) | Stored MIME type | Required leading bytes |
|---|---|---|
| `.jpg`, `.jpeg` | `image/jpeg` | `FF D8 FF` |
| `.png` | `image/png` | `89 50 4E 47 0D 0A 1A 0A` |
| `.webp` | `image/webp` | `RIFF` at bytes 0-3 and `WEBP` at bytes 8-11 |
| `.pdf` | `application/pdf` | `%PDF-` |

Files with no extension, multiple terminal extensions whose final extension is not listed,
or a mismatch between the terminal extension and required signature return `415
UNSUPPORTED_MEDIA_TYPE`. The request-supplied MIME type is never trusted. Original
filenames are display metadata only; control characters and path separators are replaced
with `_` before persistence. Downloads use a sanitized ASCII `filename` fallback plus an
RFC 5987 UTF-8 `filename*` value in `Content-Disposition`.

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

**Inherited error matrix:** All requester-scoped endpoints require a valid active requester
context and return `422` for a missing, unknown, or inactive `X-Dev-Requester-Id`, and `500`
with the standard safe generic error for an unexpected failure. Owned-resource endpoints also
return the same `404` shape for a missing or non-owned resource. Each endpoint below lists only
additional validation or conflict cases specific to that capability.

Bootstrap and reference-data endpoints do not require requester context, but they return `500`
with the same safe generic error for unexpected failures.

**Attachment storage & access boundary (frozen):** uploaded attachment files are never served
through a public/static file route. The only way to retrieve file bytes is via
`GET /api/attachments/:attachmentId/download` and `GET /api/attachments/:attachmentId/preview`,
both of which re-validate ownership (the ticket's `requesterId` matches the caller's
`X-Dev-Requester-Id`) and `isRemoved` status before returning bytes. A soft-removed
attachment's file remains on disk for audit purposes but is unreachable through any endpoint
once `isRemoved=true`.

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
- `categoryId`, `relatedSystemId`: required, must reference an **active** record. Error matrix: missing/non-integer → `400` validation error (`VALIDATION_ERROR`); well-formed but nonexistent ID → `409` Conflict (`INACTIVE_REFERENCE`); existing but inactive record → `409` Conflict (`INACTIVE_REFERENCE`).
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
- `409` — `categoryId` or `relatedSystemId` is well-formed but nonexistent, **or** refers to an existing but inactive record (both use `INACTIVE_REFERENCE`)
- `500` — unexpected error; ticket is not partially created (all-or-nothing)

---

## 5. GET /api/tickets
Retrieve the selected Requester's own Tickets — search, filter, sort, paginate.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive substring match on `ticketNumber` or `summary`. Trimmed; blank-after-trim treated as no search active. |
| `categoryId` | int | — | Filter by category. Malformed (non-integer) → 400; nonexistent but well-formed → 409 (`INACTIVE_REFERENCE`); stale/inactive → 409 (`INACTIVE_REFERENCE`). |
| `requestedPriority` | `LOW\|MEDIUM\|HIGH` | — | Filter by requested priority. Invalid enum value (e.g., "URGENT") → 400. |
| `status` | `NEW` | — | Filter by status. Invalid enum value (e.g., "CLOSED") → 400. (Only `NEW` possible in Lab 2.) |
| `sort` | `createdAt\|ticketNumber\|summary\|requestedPriority` | `createdAt` | Sort field. Invalid value → fallback to default. |
| `order` | `asc\|desc` | `desc` | Sort direction. Invalid value → fallback to default. |
| `page` | int ≥1 | `1` | Missing, malformed, non-integer, or non-positive → use 1. Valid but beyond totalPages → 200 with empty data array; totalPages set correctly. |
| `pageSize` | int 1–50 | `10` | Page size. Invalid/out-of-range → fallback to default (10). |

**Pagination behavior for out-of-range pages and UI states:**
- If `page > totalPages` (e.g., requesting page 999 when totalPages=3), return `200 OK` with `data: []` and accurate metadata showing `totalPages: 3`.
- Frontend must not confuse an out-of-range empty array with a normal empty state: when
  `totalPages > 0`, it reloads the last valid page.
- When `totalPages = 0`, display **Empty** only when `unfilteredTotalItems = 0`; otherwise
  display **No-Results**, including when the current normalized filters are active.

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
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1, "unfilteredTotalItems": 1 }
}
```
An empty `data` array with `totalItems: 0` covers both the Empty and No-Results UI states.
The frontend uses `unfilteredTotalItems` to distinguish them: zero means Empty; a positive
value means No-Results. Normalized search/filter values determine the current result set;
blank or whitespace-only `search` is inactive.

**Additional errors:** `400` for malformed filter values, `409` for unknown or inactive
Category filters, and the inherited `422`/`500` requester-context and unexpected-error responses.

---

## 6. GET /api/tickets/:ticketNumber
Retrieve one owned Ticket's full detail, including its active + removed attachment list.

`ticketNumber` must exactly match `TKT-{4-digit year}-{6 digits}`. Any other value is treated
as not found. The embedded `attachments` array uses the same `uploadedAt asc, id asc`
ordering as the dedicated attachment-list endpoint.

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
        "isRemoved": false,
        "removedAt": null,
        "removalReason": null,
        "removedByRequesterId": null
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
The required `file` part must be present; when it is missing, the endpoint returns `400
VALIDATION_ERROR` and does not create metadata or storage.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Validation**
- Ticket must exist and be owned by requester → else `404`
- Ticket must have <5 active attachments → else `400` (`ATTACHMENT_LIMIT_REACHED`). The
  count check and metadata insert occur in one database transaction/lock scope, so concurrent
  uploads cannot create more than five active attachments.
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
List attachment metadata (active and removed) for an owned Ticket. Results are ordered deterministically by `uploadedAt asc, id asc` for stable display ordering and reproducible tests.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200** — same shape as the `attachments` array in Section 6, including removed
entries with `isRemoved: true`, `removedAt`, `removalReason`, `removedByRequesterId`.

The response is a raw JSON array, not a `{ "data": [...] }` envelope:
```json
[
  {
    "id": 9001,
    "ticketId": 501,
    "originalFilename": "battery-report.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 214532,
    "uploadedAt": "2026-08-21T09:15:00.000Z",
    "isRemoved": false,
    "removedAt": null,
    "removalReason": null,
    "removedByRequesterId": null
  }
]
```

## 9. GET /api/attachments/:attachmentId/download
Download the raw file bytes of an **active** attachment on an owned ticket.

**Headers:** `X-Dev-Requester-Id: <int>` (required)

**Response 200** — binary stream, `Content-Type` set from stored `mimeType`,
`Content-Disposition` containing both a sanitized ASCII fallback and an RFC 5987 UTF-8
filename value, for example:
`attachment; filename="battery-report.pdf"; filename*=UTF-8''battery-report.pdf`.
The fallback replaces control characters, path separators, and non-ASCII characters with
`_`; `filename*` contains the original display filename after percent encoding. Neither
value may expose the generated stored filename or an on-disk path.

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
- `409` — attachment is already removed (idempotency guard; removing twice is not silently accepted; code `CONFLICT`)