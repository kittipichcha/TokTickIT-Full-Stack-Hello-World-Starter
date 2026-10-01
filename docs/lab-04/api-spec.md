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
Ticket identifiers use canonical form such as `TKT-2026-000001`.

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
  "data": [{ "id": 1, "ticketNumber": "TKT-2026-000001", "description": "Replaced cable",
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

Header `Idempotency-Key` is required; 1–128 printable ASCII characters. Normalize the recognized
ordered fields `description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`,
`assigneeUserId` before validation and hashing. Trim text; normalize absent, null, or blank optional
text to `null`; default absent `followUpRequired` to `false` (explicit null or non-boolean fails);
normalize absent/null `assigneeUserId` to `null`, otherwise require a positive JSON integer.
Ignore unknown and server-owned fields. Validate normalized values. Hash UTF-8
`JSON.stringify` of the normalized ordered fields with SHA-256.

Persist an idempotency record atomically with the Action for 24 hours, uniquely scoped by
authenticated actor, concrete route (including Ticket number), and key. Store the normalized
request hash, Action identity, original `201` response, creation time, and expiry. Repeating the
same key and hash before expiry returns the original `201` response and creates no row; a different
hash returns `409 CONFLICT`. Treat a record as expired when `now >= expiresAt`, regardless of
whether cleanup has run. At or after expiry, validate the current actor, Ticket, and request
normally, then atomically replace the expired idempotency record with a record for a fresh Action,
request hash, original `201` response, and 24-hour retention. Keep the old Action. Concurrent
identical reuse of an expired key creates exactly one fresh Action; later requests replay its new
`201` response and identity. Failed operations create neither a replacement record nor an Action.
Actors and concrete routes have independent key scopes.

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

## 7. Shared Ticket concurrency

The existing `POST /api/staff/tickets/:ticketNumber/owner`,
`PATCH /api/staff/tickets/:ticketNumber/priority`, and
`PATCH /api/staff/tickets/:ticketNumber/status` accept optional positive integer
`expectedVersion`. An invalid supplied value returns `400 VALIDATION_ERROR`; a stale value returns
`409 CONFLICT` without mutation. Omission preserves Lab 3 compatibility. Compare, mutation, and
version increment are atomic across these endpoints. Every accepted owner or priority mutation
increments shared `Ticket.version` exactly once, including when the requested value equals the
current value. Formal status changes follow the transition matrix: a request for the current status
is forbidden and returns `409 CONFLICT` without mutation or version increment. Preserve the complete
Ticket state, including `currentStatus`, `updatedAt`, and `resolvedAt`, and append no
`TicketStatusChange` row. Each permitted status transition increments the version exactly once and
appends one history row. Initialize `Ticket.version` to 1 for new and existing
Tickets. Include `version` in staff Ticket Detail and successful mutation responses.

`expectedVersion` is an optional JSON body field, not a query parameter or header. The exact
additive owner request is:

```json
{ "ownerId": 5, "expectedVersion": 2 }
```

Omitting `expectedVersion` preserves the Lab 3 request `{ "ownerId": 5 }`. On success, the exact
`200` response is `{ "data": { "ticketOwnerId": 5, "version": 3 } }`.

The exact additive priority request is:

```json
{ "itPriority": "HIGH", "expectedVersion": 2 }
```

Omitting `expectedVersion` preserves the Lab 3 request `{ "itPriority": "HIGH" }`. On success,
the exact `200` response is `{ "data": { "itPriority": "HIGH", "version": 3 } }`. The status
request and response shapes are frozen in §8. The `version` in each success response is the
post-mutation Ticket version; no other response fields are added to these mutation responses.

A Ticket must have a non-null owner before a status change, but any authorized IT Staff or
Administrator may make the change; the acting user need not be the Ticket Owner. The Lab 4 UI
sends current version for all three mutations. On conflict, preserve recoverable input, refresh
the Ticket, and do not retry automatically.

## 8. Ticket status compatibility extension

Retain status route's Lab 3 body and response semantics. Old clients that send only
`{ "status": "IN_PROGRESS" }` remain valid. The exact Lab 4 request with version is
`{ "status": "IN_PROGRESS", "expectedVersion": 2 }`; omission remains compatible. A successful
status request returns exactly
`{ "data": { "currentStatus": "IN_PROGRESS", "version": 3 } }`; `version` is additive.
The status update and Pending Action resolution check run atomically. Serialize against Action
creation and completion/cancellation so no committed state can have a `RESOLVED` Ticket with a
Pending Action. A Pending Action blocks only transition to `RESOLVED`; zero Actions or all
terminal Actions permit resolution when Lab 3 transition and owner-presence rules permit it.

Each successful status change appends immutable `TicketStatusChange` with Ticket ID, actor ID,
UTC timestamp, from/to status, and version before/after. The Ticket's current status remains the
source of truth. Reopening a Ticket does not restore old Actions to Pending; a new Action is a
distinct record.

## 9. GET /api/staff/tickets/:ticketNumber/status-history

Auth: IT Staff/Administrator. Requesters receive `403 FORBIDDEN`; unauthenticated callers receive
`401 UNAUTHENTICATED`; an absent Ticket returns `404 NOT_FOUND`.

Query: `page` defaults to 1; `pageSize` defaults to 10 and has maximum 50. Both must be positive
integers. Invalid values return `400 VALIDATION_ERROR`. Results have fixed ascending
`(changedAt, id)` order.

Response `200` contains `data` entries with exactly `id`, `ticketNumber`,
`changedBy: { id, name }`, `changedAt`, `fromStatus`, `toStatus`, `versionBefore`, and
`versionAfter`, plus `pagination: { page, pageSize, totalItems, totalPages }`. No Requester
history route or projection exists. Each successful formal status change writes exactly one
immutable row; failed changes write none.

## 10. GET /api/requester/dashboard

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

## 11. GET /api/staff/dashboard

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
| My Pending Actions | Each matching row opens its associated Ticket Detail Actions section and selects that row's Action ID | Action `assigneeUserId = authenticated user`, status `PENDING` |
| Recently Performed | Each matching row opens its associated Ticket Detail Actions section and selects that row's Action ID | Action `performedByUserId = authenticated user`, `createdAt >= windowStart` |
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
`byStatus` is an object with exactly these eight keys, each a non-negative integer count:
`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`,
`CANCELLED`. `drillDowns.byStatus` contains exactly the same eight keys. For each status key `S`,
the value is `{ "path": "/api/staff/queue", "query": { "status": "S" } }` with that exact
status value. `byPriority` is an object with exactly `LOW`, `MEDIUM`, and `HIGH`, each a
non-negative integer count; `drillDowns.byPriority` contains exactly those three keys, mapped to
the corresponding exact Queue priority query. No enum key may be omitted, renamed, or replaced
with an aggregate. `recentlyUpdatedTickets` has no status
restriction. `urgentTickets` uses `priority=HIGH&openOnly=true`. `myTickets` and
`unassignedTickets` include terminal Tickets because their counts do. Action list rows are
`{ "id": integer, "ticketNumber": string, "description": string, "status": ActionStatus,
"createdAt": ISO-8601 UTC string }`; each Action row also includes `destination: { "path":
"/api/tickets/:ticketNumber", "anchor": "actions", "actionId": integer }`, populated from that
row's Ticket number and Action ID. The aggregate Action metric's `drillDowns` entry contains only
its matching `filter`, with no `path` or `actionId`; the metric itself is not an interactive
destination. Each Action row, not the aggregate card, has the Ticket Detail destination. Ticket
summary rows are `{ "ticketNumber": string,
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
    "byStatus": {
      "NEW": { "path": "/api/staff/queue", "query": { "status": "NEW" } },
      "OPEN": { "path": "/api/staff/queue", "query": { "status": "OPEN" } },
      "IN_PROGRESS": { "path": "/api/staff/queue", "query": { "status": "IN_PROGRESS" } },
      "WAITING_FOR_REQUESTER": { "path": "/api/staff/queue", "query": { "status": "WAITING_FOR_REQUESTER" } },
      "RESOLVED": { "path": "/api/staff/queue", "query": { "status": "RESOLVED" } },
      "CLOSED": { "path": "/api/staff/queue", "query": { "status": "CLOSED" } },
      "REOPENED": { "path": "/api/staff/queue", "query": { "status": "REOPENED" } },
      "CANCELLED": { "path": "/api/staff/queue", "query": { "status": "CANCELLED" } }
    },
    "byPriority": {
      "LOW": { "path": "/api/staff/queue", "query": { "priority": "LOW" } },
      "MEDIUM": { "path": "/api/staff/queue", "query": { "priority": "MEDIUM" } },
      "HIGH": { "path": "/api/staff/queue", "query": { "priority": "HIGH" } }
    },
    "myPendingAssignedActions": { "filter": { "assignee": "me", "status": "PENDING" } },
    "myRecentlyPerformedActions": { "filter": { "performedBy": "me", "createdAtGte": "2026-09-01T10:00:00.000Z" } },
    "recentlyUpdatedTickets": { "path": "/api/staff/queue", "query": { "updatedSince": "2026-09-01T10:00:00.000Z" } },
    "urgentTickets": { "path": "/api/staff/queue", "query": { "priority": "HIGH", "openOnly": "true" } }
  } } }
```

## 12. Concurrency, migration, and regression requirements

Action updates use version compare-and-swap. Ticket owner/priority/status writes, Action creation,
and Action status writes must use a database transaction/locking strategy that serializes the
shared version and resolution invariant. Persist `ActionCreateIdempotency` rows with actor ID,
concrete route, key, normalized request SHA-256, Action ID, original 201 response, creation time,
and 24-hour expiry; enforce uniqueness on actor/route/key and create the row atomically with the
Action. Migration adds Action, ActionTakenRevision, TicketStatusChange,
ActionCreateIdempotency, Ticket version, and nullable `resolvedAt`; it preserves existing row IDs
and values. Do not infer historical `resolvedAt` from `updatedAt`. Seed is repeatable.
`ActionCreateIdempotency` is the durable record for Action-create idempotency: unique
`(actorUserId, route, key)`, normalized request SHA-256, Action ID, original 201 response, created
time, and expiry exactly 24 hours after creation. The unique constraint is on the ordered tuple
`(actorUserId, route, key)`; `route` is the concrete Action-create route including Ticket number.
Required indexes/constraints are: `ActionTaken(ticketId, createdAt, id)`;
`ActionTaken(assigneeUserId, status, createdAt, id)` for assigned Action queries;
`ActionTaken(performedByUserId, createdAt, id)` for recent performed Actions;
`ActionTakenRevision(actionId, editedAt, id)`; `TicketStatusChange(ticketId, changedAt, id)`;
`ActionCreateIdempotency(expiresAt, id)`; and the unique idempotency tuple above. An hourly
cleanup invocation deletes at most 500 expired rows, ordered by `(expiresAt, id)`, using one
transaction per batch. It emits the deleted-row count and a success/failure result; the next hourly
invocation continues remaining expired rows. Each batch deletes only rows with `expiresAt <= now`
evaluated once in UTC for that invocation. Expiry is enforced during key lookup even if cleanup
has not run. Do not add Ticket indexes beyond those already
present in the integrated Lab 3 schema; the Lab 4 migration creates no new index on `Ticket`.

Migration precondition is completed and verified Lab 3 Phase A, identity/attachment/priority
backfill, and Phase C. Stop application writers; take a full custom-format PostgreSQL snapshot
and paired attachment-storage snapshot; record identifiers, versions, counts, and hashes. Restore
the database into a separate empty rehearsal DB and verify migration history, counts, IDs, foreign
keys, and representative attachment references. Verify every attachment object hash. Only then
apply additive Lab 4 migration and validate preserved records, relationships, attachment hashes,
and zero-Action Ticket behavior before writers resume. Before any accepted Lab 4 write, a failed
migration or validation restores the database and attachment snapshots together. After any Lab 4
write is accepted, never restore the old snapshots; stop affected writes, preserve current state,
and forward-recover through an approved corrective migration/fix. The implementation issue must
test each gate and recovery boundary.

Retain Lab 3 authentication/session, CSRF, role and ownership checks, existing Ticket routes and
semantics, attachments, Public Comments, Internal Notes, and administrator operations. Add only
the approved Action, status-history, concurrency, dashboard, and response-field behavior. Existing
Lab 3 clients may omit optional `expectedVersion`; Lab 4 clients send current versions. Keep old
Lab 1/Lab 2/Lab 3 automated test paths and assertions. Adapt an old expectation only when an
explicit Lab 4 additive contract changes it; document the specific expectation and replacement
assertion, then run the complete prior-lab API/integration/E2E regression set against the integrated
branch.
