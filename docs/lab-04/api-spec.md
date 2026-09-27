# Lab 4 API Contract — Draft for Human Review

> This is a contract only. No Lab 4 route, model, migration, seed, or test is claimed as implemented.

## 1. Compatibility and conventions

Base path is `/api`. Preserve Lab 3 authentication sessions, CSRF checks, canonical JSON error
shape, role checks, safe ownership behavior, JSON parsing, and unknown-property handling. Every
mutation requires the authenticated session and the Lab 3 CSRF token. Requester identity always
comes from the session. Action writes and staff dashboard reads are IT Staff/Administrator only;
Requester dashboard and Action reads are Requester-only and ownership-scoped.

Errors use Lab 3's `{ "error": { "code", "message", "fields?" } }` shape. Use `400
VALIDATION_ERROR` for invalid supplied values, `401 UNAUTHENTICATED` for missing session,
`403 FORBIDDEN` for wrong role, `404 NOT_FOUND` for missing or unowned Ticket/Action, and `409
CONFLICT` for forbidden transitions, stale versions, duplicate idempotency keys with different
payloads, or workflow races. Never expose Internal Notes or audit metadata to Requesters.

Integer IDs, versions, pages, and limits use non-negative decimal integer syntax. JSON bodies
must be objects with `Content-Type: application/json`; unknown fields are ignored, consistent
with Lab 3. The maximum Action list page size is 50. Dashboard summary lists are bounded to 10.

## 2. Action data contract

Enums are `PENDING`, `COMPLETED`, `CANCELLED`; Ticket statuses use the Lab 3 enum. An Action
response contains `id`, `ticketNumber`, `description`, `result`, `followUpRequired`,
`followUpNote`, `attachmentNotes`, `status`, `performedBy: { id, name }`, `assignee: { id, name,
role } | null`, `createdAt`, `updatedAt`, and integer `version`. Dates are ISO-8601 UTC strings.
Staff Action representations contain `performedBy: { id, name }` and
`assignee: { id, name, role } | null`. Requester representations contain
`performedBy: { name }` and `assignee: { name } | null`, plus the current Action text, status,
and creation time; they omit user IDs, assignee role, version, and all revision/audit history.
They remain read-only. Requesters may see performer and assignee names as display-only
attribution, but cannot see or change assignment controls or private audit data.
The exact Requester Action object is `{ "id": integer, "ticketNumber": string,
"description": string, "result": string|null, "followUpRequired": boolean,
"followUpNote": string|null, "attachmentNotes": string|null, "status": ActionStatus,
"performedBy": { "name": string }, "assignee": { "name": string }|null,
"createdAt": ISO-8601 UTC string, "updatedAt": ISO-8601 UTC string }`.

Bounds: `description` 1–2,000 characters after trim; `result` optional while Pending, at most
2,000 characters, required nonblank when completing; `followUpNote` at most 1,000 characters,
required nonblank when `followUpRequired=true`; `attachmentNotes` at most 1,000 characters.
Text is trimmed before validation and storage. Whitespace-only optional text becomes `null`.
Attachment Notes are plain text; they do not upload files or authorize access. The backend
sets performer and timestamps. A new Action is always `PENDING`; client-supplied `status`,
`performedByUserId`, `createdAt`, `updatedAt`, `version`, or revision data are ignored.

## 3. GET /api/tickets/:ticketNumber/actions

Auth: IT Staff/Administrator may read any Ticket in the Lab 3 staff scope. Requester may read
only an owned Ticket. Requester cross-owner or missing Ticket returns the same `404 NOT_FOUND`.

Query: `page` default 1, positive integer; `pageSize` default 10, range 1–50. Invalid values
return `400 VALIDATION_ERROR`. Sort is fixed ascending by `(createdAt, id)`; clients cannot
override it.

Response `200`:

```json
{
  "data": [{ "id": 1, "ticketNumber": "TK-2026-0001", "description": "Replaced cable",
    "result": null, "followUpRequired": false, "followUpNote": null,
    "attachmentNotes": null, "status": "PENDING",
    "performedBy": { "id": 4, "name": "Staff One" }, "assignee": null,
    "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z",
    "version": 1 }],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```

The Requester projection includes current performer/assignee display names but excludes `version`
and revision history. Empty results return an empty `data` array and zero totals. Staff list
items use the full staff Action representation; Requester list items use the restricted projection
above.

## 4. POST /api/tickets/:ticketNumber/actions

Auth: IT Staff/Administrator. Ticket must be accessible under the Lab 3 staff scope and not be
`RESOLVED`, `CLOSED`, or `CANCELLED`. A Pending Action is not created on a terminal Ticket.

Header `Idempotency-Key` is required; 1–128 printable ASCII characters. Repeating the same key
and canonical request for the same authenticated actor returns the original `201` response and
creates no second row; every successful identical replay uses `201` consistently. Reusing the key
with a different payload returns `409 CONFLICT`. Keys are
scoped to actor and endpoint; retain them for at least 24 hours. Client must reuse the key only
for retry of the same operation.

Body:

```json
{ "description": "Replaced cable", "result": null,
  "followUpRequired": false, "followUpNote": null, "attachmentNotes": null,
  "assigneeUserId": 7 }
```

`description` required. `result`, `followUpNote`, `attachmentNotes`, and `assigneeUserId` are
optional and nullable as shown. `followUpRequired` defaults to false and must be boolean.
Assignee, if present, must be an active IT Staff or Administrator. It need not be the Ticket
Owner or performer. Assignment does not change the Ticket Owner. The selector uses the existing
`GET /api/staff/owners` eligible-user list.

Response `201`: `{ "data": <Action response> }`. Malformed assignee ID returns `400
VALIDATION_ERROR`; well-formed nonexistent, inactive, or Requester assignee returns `409
CONFLICT`, matching Lab 3 Ticket-owner eligibility behavior. No Action is written. Idempotent
replay returns `201` with the identical original `{ "data": ... }` and same Action identity.

## 5. GET /api/tickets/:ticketNumber/actions/:actionId

Same roles and Ticket ownership rules as the list route. `actionId` must belong to the specified
Ticket. Response `200` uses the current Action representation; Requester projection is read-only
and excludes version and private revision history. Missing, mismatched, or unowned resources
return `404 NOT_FOUND`.

## 6. PATCH /api/tickets/:ticketNumber/actions/:actionId

Auth: IT Staff/Administrator. Only a current `PENDING` Action may be edited. Body must include
integer `expectedVersion` and at least one editable field. Allowed fields are `description`,
`result`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `assigneeUserId`, and `status`.
`status` may remain `PENDING` or transition once to `COMPLETED` or `CANCELLED`; terminal states
cannot be edited or reopened. Completion requires nonblank Result. A partial patch validates the
combined resulting Action, including follow-up dependency.

The backend atomically compares `expectedVersion` with current version, writes the fields,
increments version, and appends one immutable `ActionTakenRevision` containing actor, UTC time,
version before/after, and complete before/after editable-field snapshots. A mismatch returns
`409 CONFLICT` and changes nothing. Response `200`: `{ "data": <updated Action response> }`.

## 7. Ticket status compatibility extension

Retain `PATCH /api/staff/tickets/:ticketNumber/status` and its Lab 3 role, ownership, body, and
response semantics. Accept optional positive integer `expectedVersion`. Old clients that send
only `{ "status": "IN_PROGRESS" }` remain valid. The Lab 4 UI must always send the current
Ticket `version`; supplied stale versions return `409 CONFLICT` without mutation. Return
`{ "data": { "currentStatus": "IN_PROGRESS", "version": 3 } }`; `version` is additive.

Add integer `Ticket.version`, initially 1. Increment it on each formal Ticket status transition.
Include `version` in the staff Ticket Detail response and in the successful status response. This
field is additive; existing clients may ignore it. The Lab 4 UI reads it from staff Ticket Detail.
The status update and Pending Action resolution check run atomically. Serialize against Action
creation and completion/cancellation so no committed state can have a `RESOLVED` Ticket with a
Pending Action. A Pending Action blocks only transition to `RESOLVED`; zero Actions or all
terminal Actions permit resolution when the Lab 3 transition and ownership rules permit it.

Each successful status change appends immutable `TicketStatusChange` with Ticket ID, actor ID,
UTC timestamp, from/to status, and version before/after. The Ticket's current status remains the
source of truth. Do not change unrelated Lab 3 response fields. Reopening a Ticket does not
restore old Actions to Pending; a new Action is a distinct record.

## 8. GET /api/requester/dashboard

Auth: Requester. Every query uses the session Requester ID. Response has `data.generatedAt` UTC,
`windowStart` UTC, numeric `counts`, and bounded `lists`; an empty count is 0 and an empty list is
`[]`. No endpoint accepts caller-supplied identity or returns full Ticket rows.

Counts: `openTickets` counts owned Tickets in `NEW`, `OPEN`, `IN_PROGRESS`,
`WAITING_FOR_REQUESTER`, `REOPENED`; `waitingForRequester` counts owned `WAITING_FOR_REQUESTER`;
`recentlyUpdated` counts owned Tickets with `updatedAt >= generatedAt - 7 days`;
`recentlyResolved` counts owned Tickets currently `RESOLVED` with non-null
`resolvedAt >= generatedAt - 7 days`. All times use rolling seven 24-hour days in UTC. Legacy
Resolved Tickets with null `resolvedAt` are excluded.

Lists: `attentionTickets` contains up to 10 owned open Tickets ordered by `updatedAt DESC,
 ticketNumber DESC`; `recentTickets` contains up to 10 owned Tickets updated within the same
window, ordered identically. A summary contains only `ticketNumber`, `summary`, `currentStatus`,
`updatedAt`, and `appearsResolved`.

Each summary item is exactly `{ "ticketNumber": string, "summary": string,
"currentStatus": TicketStatus, "updatedAt": ISO-8601 UTC string, "appearsResolved": boolean }`.
`drillDowns` is required and contains `openTickets`, `waitingForRequester`, `recentlyUpdated`,
and `recentlyResolved`; each value is `{ "path": "/api/tickets", "query": object }`.
The exact query predicates are `scope=open`, `status=WAITING_FOR_REQUESTER`, `updatedSince=<windowStart>`,
and `status=RESOLVED&resolvedSince=<windowStart>`, respectively. The dashboard passes its returned
`windowStart`; opening an item uses `GET /api/tickets/:ticketNumber` for that owned Ticket.

Extend Requester `GET /api/tickets` with optional `scope=open`, `updatedSince`, and
`resolvedSince` filters. `scope=open` means exactly `NEW`, `OPEN`, `IN_PROGRESS`,
`WAITING_FOR_REQUESTER`, or `REOPENED`; `updatedSince` means `updatedAt >=` the supplied UTC
instant; `resolvedSince` means current status `RESOLVED`, non-null `resolvedAt`, and
`resolvedAt >=` the supplied UTC instant. These filters combine with existing filters using AND;
`scope=open` and `status` are mutually exclusive. Timestamps must be valid ISO-8601 UTC values
or return `400 VALIDATION_ERROR`. With all new parameters omitted, Lab 3 query behavior is
unchanged. Dashboard links use the same predicates as their counts and returned summary lists.

Response shape:

```json
{ "data": { "generatedAt": "2026-09-08T10:00:00.000Z",
  "windowStart": "2026-09-01T10:00:00.000Z",
  "counts": { "openTickets": 2, "waitingForRequester": 1,
    "recentlyUpdated": 2, "recentlyResolved": 0 },
  "lists": { "attentionTickets": [], "recentTickets": [] },
  "drillDowns": {
    "openTickets": { "path": "/api/tickets", "query": { "scope": "open" } },
    "waitingForRequester": { "path": "/api/tickets",
      "query": { "status": "WAITING_FOR_REQUESTER" } },
    "recentlyUpdated": { "path": "/api/tickets",
      "query": { "updatedSince": "2026-09-01T10:00:00.000Z" } },
    "recentlyResolved": { "path": "/api/tickets",
      "query": { "status": "RESOLVED", "resolvedSince": "2026-09-01T10:00:00.000Z" } }
  } } }
```

## 9. GET /api/staff/dashboard

Auth: IT Staff/Administrator. Counts use the authenticated user for “mine”; no user ID query is
accepted. `generatedAt` and `windowStart` follow the Requester dashboard UTC rule. Counts:
`unassignedTickets` (Ticket Owner null, any status), `myTickets` (Ticket Owner is caller, any
status), `byStatus` (all eight statuses), `byPriority` (IT Priority LOW/MEDIUM/HIGH, any
status), `myPendingAssignedActions` (Pending Action assigned to caller),
`myRecentlyPerformedActions` (Action performer is caller and Action created within seven days),
`recentlyUpdatedTickets` (Ticket updated within seven days, any status), `urgentTickets` (HIGH
IT Priority and nonterminal). Missing legacy IT Priority is not counted in a priority count or as
HIGH.

Summary lists are bounded to 10, stable by `updatedAt DESC, ticketNumber DESC` or
`createdAt DESC, id DESC` for Actions. Each list item contains concise identifiers and display
fields only. No Internal Notes or Action revision history is included. The response includes
filter payloads for every card so the destination uses identical predicates:

| Card/list | Drill-down | Exact filter |
|---|---|---|
| Unassigned | `GET /api/staff/queue?ownerScope=unassigned` | `ticketOwnerId IS NULL`, any status |
| My Tickets | `GET /api/staff/queue?ownerScope=me` | `ticketOwnerId = authenticated user`, any status |
| Status | `GET /api/staff/queue?status={status}` | Exact current status |
| Priority | `GET /api/staff/queue?priority={priority}` | Exact IT Priority, any status |
| My Pending Actions | Ticket Detail Actions section | Action `assigneeUserId = authenticated user`, status `PENDING`; open each returned Action's Ticket Detail |
| Recently Performed | Ticket Detail Actions section | Action `performedByUserId = authenticated user`, `createdAt >= windowStart`; open each returned Action's Ticket Detail |
| Recently Updated | Queue | `updatedAt >= windowStart`, any status |
| Urgent | Queue | IT Priority HIGH, nonterminal |

Existing Queue query semantics remain intact. Keep `ownerId` as the existing positive integer
Ticket Owner ID filter. Add `ownerScope=unassigned` or `ownerScope=me` for dashboard links;
`ownerScope` and `ownerId` are mutually exclusive. Add `openOnly=true` to filter to
`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; `false`/omitted preserves
the current full Queue. Add optional ISO UTC `updatedSince` for recent-updated drill-down. The
Urgent link uses `priority=HIGH&openOnly=true`; other staff metric links include terminal Tickets
when their count includes them. If list truncation applies, dashboard link still opens the exact
filtered Queue, not only the summary subset. Action dashboard lists link to the associated Ticket
Detail; no new write endpoint is implied.

For Queue extension validation, `ownerId` remains a positive integer and retains Lab 3's exact
filter and invalid-value semantics. `ownerScope` accepts only `me` or `unassigned`; `openOnly`
accepts only `true` or `false`. `updatedSince` must be a valid ISO-8601 UTC timestamp.
Invalid extension values return `400 VALIDATION_ERROR`. All supplied Queue filters combine with
AND semantics; the dashboard response returns precisely the query values needed by each card.
`byStatus` and `byPriority` return a count and matching `drillDowns` entry for every enum value.
Status and priority links use exact matching values. `recentlyUpdatedTickets` has no status
restriction. `urgentTickets` uses `priority=HIGH&openOnly=true`. `myTickets` and
`unassignedTickets` include terminal Tickets because their counts do. Action list rows are
`{ "id": integer, "ticketNumber": string, "description": string, "status": ActionStatus,
"createdAt": ISO-8601 UTC string }`; Ticket summary rows are `{ "ticketNumber": string,
"summary": string, "currentStatus": TicketStatus, "itPriority": LOW|MEDIUM|HIGH|null,
"updatedAt": ISO-8601 UTC string }`. Lists are bounded at 10 and contain no Internal Notes
or Action revision history. Action drill-down entries identify the exact matching Action and
Ticket Detail `actions` anchor; Queue entries contain exact Queue query parameters.

Response shape:

```json
{ "data": { "generatedAt": "2026-09-08T10:00:00.000Z",
  "windowStart": "2026-09-01T10:00:00.000Z",
  "counts": { "unassignedTickets": 0, "myTickets": 0,
    "byStatus": { "NEW": 0, "OPEN": 0, "IN_PROGRESS": 0,
      "WAITING_FOR_REQUESTER": 0, "RESOLVED": 0, "CLOSED": 0,
      "REOPENED": 0, "CANCELLED": 0 },
    "byPriority": { "LOW": 0, "MEDIUM": 0, "HIGH": 0 },
    "myPendingAssignedActions": 0, "myRecentlyPerformedActions": 0,
    "recentlyUpdatedTickets": 0, "urgentTickets": 0 },
  "lists": { "unassignedTickets": [], "myTickets": [], "pendingActions": [],
    "recentActions": [], "recentTickets": [], "urgentTickets": [] },
  "drillDowns": {
    "unassignedTickets": { "path": "/api/staff/queue", "query": { "ownerScope": "unassigned" } },
    "myTickets": { "path": "/api/staff/queue", "query": { "ownerScope": "me" } },
    "byStatus": { "NEW": { "path": "/api/staff/queue", "query": { "status": "NEW" } } },
    "byPriority": { "HIGH": { "path": "/api/staff/queue", "query": { "priority": "HIGH" } } },
    "myPendingAssignedActions": { "path": "/api/tickets/:ticketNumber", "anchor": "actions",
      "actionId": 1, "filter": { "assignee": "me", "status": "PENDING" } },
    "myRecentlyPerformedActions": { "path": "/api/tickets/:ticketNumber", "anchor": "actions",
      "actionId": 1, "filter": { "performedBy": "me", "createdAtGte": "2026-09-01T10:00:00.000Z" } },
    "recentlyUpdatedTickets": { "path": "/api/staff/queue", "query": { "updatedSince": "2026-09-01T10:00:00.000Z" } },
    "urgentTickets": { "path": "/api/staff/queue", "query": { "priority": "HIGH", "openOnly": "true" } }
  } } }
```

## 10. Concurrency, migration, and regression requirements

Action updates use version compare-and-swap. Ticket status writes, Action creation, and Action
status writes must use a database transaction/locking strategy that serializes the resolution
invariant. Idempotency persistence is unique by actor/key/route. Migration adds Action,
ActionTakenRevision, TicketStatusChange, Ticket version, and nullable `resolvedAt`; it preserves
existing row IDs and values. Do not infer historical `resolvedAt` from `updatedAt`. Seed is
repeatable. Recovery and backup/restore steps must be documented and tested by the owning
implementation issue. No Lab 3 endpoint response changes except the additive optional status
version contract; dashboard filter query extensions for Requester Tickets and the staff Queue
are additive and preserve all existing query behavior when omitted.
