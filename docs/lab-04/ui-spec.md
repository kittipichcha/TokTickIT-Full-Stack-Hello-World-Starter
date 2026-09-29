# Lab 4 UI Contract — Draft for Human Review

> Contract only. No Lab 4 screen or interaction is claimed as implemented.

## 1. Shared visual and interaction rules

Retain Lab 3 Zen Green tokens, type scale, spacing, controls, field states, and shell. Do not add
ad-hoc colors. Pair every status/priority with text or an icon; color alone never communicates
meaning. All controls have visible text or an accessible name, keyboard operation, visible focus,
semantic labels, and inline field errors. Keep existing Lab 2/3 workflows and navigation intact.

At desktop (≥992px), use a readable two-column dashboard grid and full staff layouts. At tablet
(768–991px), collapse dashboard grids and condense tables without hiding required Ticket data.
At mobile (<768px), use one-column cards, stack forms, and preserve usable actions without
horizontal overflow. Respect the Lab 3 compact mobile shell and navigation behavior.

Every remote view has loading, empty, forbidden, not-found where applicable, conflict, and safe
failure states. Disable the submitted control during mutation, prevent duplicate submission, keep
recoverable values after failure, and show success only after a successful response. Do not
automatically retry writes.

## 2. Role landing dashboards

Requester lands on Requester Dashboard; IT Staff and Administrator land on Staff Dashboard.
Administrator sees the same staff dashboard and Ticket operations as IT Staff. Preserve Admin
User Management navigation. Requester never sees staff cards, internal notes, Action assignment
controls, user IDs, assignee role, or audit history. Requesters may see performer and assignee
display names as read-only attribution. Staff dashboards never expose Admin user metrics.

Requester cards show Open Tickets, Waiting for Requester, Recently Updated (rolling 7 days), and
Recently Resolved (rolling 7 days). Staff cards show Unassigned, My Tickets, counts by each
Ticket status, counts by IT Priority, My Pending Assigned Actions, My Recently Performed Actions,
Recently Updated, and Urgent. Dashboard count definitions, UTC window, zero behavior, and bounded
summaries follow the API contract exactly. Show “0” for zero counts and concise empty copy; do not
render an error for empty data.

Each card/list provides a working drill-down with the exact API contract filters. Requester cards
open My Tickets using `scope=open`, `status=WAITING_FOR_REQUESTER`, `updatedSince=windowStart`,
or `status=RESOLVED&resolvedSince=windowStart`, matching each count and list predicate; each item
opens its owned Ticket Detail. Staff Ticket cards open the Queue using `ownerScope=unassigned`,
`ownerScope=me`, exact `status`, exact `priority`, `updatedSince=windowStart`, or
`priority=HIGH&openOnly=true`, matching each count. Action cards open the associated Ticket
Detail, select the matching Action, and focus or anchor the Actions area.
Show the UTC seven-day window in human-readable local display while preserving the server UTC
boundary. State that the period is the last seven days; do not imply calendar-week dates.

Dashboard loading uses labeled skeletons or text. Failure retains the dashboard frame and offers
Retry for reads. A `403 FORBIDDEN` is shown as access denied without Retry. Empty lists have
role-appropriate next actions but never expose unauthorized destinations.

## 3. Staff Ticket Detail — Actions Taken

Place an Actions Taken section alongside existing Ticket Detail content without displacing
ownership, priority, status, comments, notes, or attachment continuity. List all Actions in API
stable order. Show description, Result, follow-up indicator/note, Attachment Notes, Action status,
assignee, performer, and created time to authorized staff. Keep Internal Notes visually and
semantically separate.

The dashboard is the first useful screen for each role, but it does not replace the Lab 3
application shell or routes. Preserve existing navigation and working flows for Ticket Queue,
Ticket Detail, ownership, priority, status, attachment upload/download, Public Comments, Internal
Notes, and administrator functions. Dashboard cards link into those existing Queue or Ticket
Detail destinations. Keep existing route behavior and controls available when a user navigates
away from the dashboard; do not duplicate or strand prior-lab functions.

Staff/Admin can create Actions, assign/unassign an eligible staff/Admin, and edit a Pending Action.
Creation form fields: Description (required), Result, Follow-up Required, conditional Follow-up
Note, Attachment Notes, and optional Assignee. Do not expose a client-editable performer, created
time, version, or initial Action status. The API creates each Action in Pending. After creation,
show its server-returned performer and time.

Pending Action edit supports current text, assignee, and status. Status choices are only Completed
and Cancelled, plus current Pending where needed to preserve unchanged state. Completing requires
Result. Terminal Actions are read-only. Every Lab 4 Action update sends current `expectedVersion`;
on `409 CONFLICT`, retain recoverable form data, explain that the Action changed, and offer
refresh/review before retry.

For Tickets in Resolved, Closed, or Cancelled, hide/disable creation and explain that a permitted
reopen/transition is needed before recording new work. The server remains authoritative. A Pending
Action blocks Resolved; show clear guidance beside the status control and handle a backend conflict
even if the UI's summary is stale. Zero Actions do not block resolution.

Requester Ticket Detail shows a read-only Actions list for its own Ticket, with current Action
text, status, performer/assignee display names, and creation time. Do not show user IDs, assignee
role, version, revision history, Internal Notes, or Action write/assignment controls. Preserve
ownership-safe 404 behavior.

## 4. Ticket status history and concurrency

Staff and Administrators can open formal Ticket status history from Ticket Detail. Show
`changedAt`, previous/next status, actor name, and version before/after in paginated ascending
chronological order with a stable tie-breaker. Requesters have no history control or history data.

Ownership, priority, and status mutations send the current Ticket `expectedVersion`. On stale
conflict, retain recoverable form data, explain that Ticket changed, and refresh before another
attempt; never retry automatically. Status changes continue to show the pending-Action resolution
conflict safely.

## 5. Ticket status control

Offer only transitions permitted by the specification matrix for the current status and role.
Reopened offers In Progress and Cancelled; In Progress offers Waiting for Requester, Resolved,
and Cancelled; other options follow the complete matrix. Require confirmation for Resolved,
Closed, and Cancelled per Lab 3. The confirmation dialog states the target status and consequence,
supports keyboard focus management, and cancel/Escape makes no request.

Every Lab 4 status mutation sends `expectedVersion` from the latest Ticket representation. Legacy
clients may omit it; Lab 4 UI may not. On success, update current status/version and refresh the
Ticket summary. On stale version or resolution-gate conflict, preserve the current screen and
explain that Ticket state changed; refresh before a retry. A requester “Problem Appears Resolved”
control remains advisory and never changes status.

## 6. Accessibility, responsive behavior, and state coverage

Dashboard cards are links/buttons with meaningful accessible names that include metric and count.
Do not make non-interactive card containers focusable. Action forms associate labels, required
markers, errors, and conditional Follow-up Note using semantic markup and `aria-describedby`.
Announce asynchronous success/failure politely; move focus to validation summary only when needed.
Dialogs trap focus, start focus inside, close on Escape where safe, and restore focus to the
invoking control.

At mobile width, display Queue links/cards with needed Ticket identity and status; no dashboard
card, form control, conflict message, or primary action clips. At tablet, retain all required
information through condensed rows or Ticket Detail. Verify keyboard traversal and visible focus
for navigation, dashboard cards, Action create/edit, assignee, status, confirmations, retry, and
drill-downs. See `tests.md` for planned responsive/accessibility assertions; none are reported as
executed here.
