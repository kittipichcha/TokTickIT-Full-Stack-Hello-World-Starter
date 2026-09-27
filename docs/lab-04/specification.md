# Lab 4 Sprint Engineering Specification — Contract Draft

> **Status:** Contract draft for human review. This document defines Lab 4 behavior; it does not claim Lab 4 implementation or test results. No Lab 4 implementation issue may start until this contract is approved against the integrated Lab 3 baseline.

## 1. Sprint Goal

Extend TokTickIT with auditable Actions Taken, a complete Ticket resolution workflow, and useful Requester and IT Staff dashboards while preserving Lab 2 and Lab 3 behavior and data. Keep the established Zen Green interface responsive and accessible.

## 2. Stakeholder Request

IT Staff need to record what they did on a Ticket, who performed it, the outcome, and any follow-up. A Ticket has at most one primary owner, but another IT Staff member may perform and record an Action. Staff need a clear rule for when work permits formal resolution. Requesters need a read-only account of all Actions Taken on their own Tickets and a concise view of Tickets needing attention. IT Staff need an operational dashboard with counts and links to the relevant Tickets. Administrators retain the Lab 3 Ticket-operation overlap and user-management responsibilities.

## 3. Scope

### Included

- Actions Taken model, assignment and status lifecycle, automatic performer/time recording, audit history, migration, seed data, APIs, and Ticket Detail UI.
- Complete Ticket transition matrix and backend resolution gate.
- Backend-calculated Requester and IT Staff dashboard metrics, empty states, and drill-downs; Administrator may reuse the staff dashboard.
- Authentication, authorization, ownership, validation, concurrency, safe errors, and retry behavior for new operations.
- Lab 2/3 preservation, regression, responsive/accessibility checks, planned tests, and release evidence.

### Excluded

- Automated SLA clocks, escalation engines, on-call scheduling, and breach notifications.
- Email, SMS, LINE, push, or other external notifications.
- Inventory, spare parts, purchasing, cost accounting, time-sheet billing, payroll, or labor costing.
- Multi-level approvals, electronic signatures, advanced BI/report builders, or export warehouses.
- Multi-tenant organizations, production-scale cloud operations, or unapproved features.
- New attachment upload flows for Actions Taken: Attachment Notes describe existing files; they are text, not an upload mechanism.

### Authority and dependencies

The supplied `SE+Lab+4.pdf` is the Lab 4 handout. The integrated Lab 3 contracts govern existing roles, Ticket statuses, ownership, security, and API behavior until Lab 4 explicitly extends them. This Issue #50 contract includes `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md`. Lab 3 prerequisites are documented; this documentation task makes no new runtime implementation claim.

## 4. Functional Requirements

### Actions Taken

- **FR-01** Staff and Administrators shall list Actions Taken for an accessible Ticket in stable chronological order and open an Action's current details.
- **FR-02** Staff and Administrators shall create an Action on an accessible Ticket with Action Description, Result, Follow-Up Required, conditional Follow-up Note, Attachment Notes, optional assignee, and an initial Action status.
- **FR-03** The backend shall record the Action creation date/time and authenticated performer automatically; the client shall not choose either value.
- **FR-04** Staff and Administrators shall update an Action's editable details, assignee, and permitted status, while the system retains an audit record of every change.
- **FR-05** An Action may be assigned to an active IT Staff or Administrator account, including someone other than the Ticket Owner or performer.
- **FR-06** A Requester shall see all current Actions Taken items on Tickets they own, including performer and assignee display names, without Action write controls or private audit data.
- **FR-07** The system shall preserve a Ticket with zero, one, or many Actions Taken without changing its existing Ticket, Attachment, Comment, or Internal Note data.

### Ticket workflow

- **FR-08** Staff and Administrators shall perform only the Ticket status transitions in the matrix below.
- **FR-09** The backend shall reject a transition to Resolved while any Action on that Ticket is Pending. A Ticket with zero Actions may resolve if all other transition conditions hold.
- **FR-10** A Requester's “Problem Appears Resolved” indication shall remain advisory; it shall not change formal Ticket status.
- **FR-11** The Ticket Detail UI shall present only permitted transitions and refresh the Ticket summary after a successful change.

### Dashboards

- **FR-12** A Requester shall see backend-calculated counts for their open Tickets, Tickets Waiting for Requester, recently updated Tickets, and recently resolved Tickets, plus concise attention/recent items and applicable links to My Tickets or Ticket Detail.
- **FR-13** IT Staff shall see backend-calculated counts for unassigned Tickets, Tickets they own, Tickets by status and IT Priority, their Pending assigned Actions, Actions performed by them recently, and recently updated or urgent Tickets, with practical links to Queue or Ticket Detail.
- **FR-14** Administrators shall be allowed to use the staff dashboard. User-account metrics are optional and are not part of this contract.
- **FR-15** Every dashboard metric shall have a documented query, date boundary, empty behavior, and drill-down destination where practical; dashboard payloads shall contain counts and concise item summaries, not complete Ticket collections.

### Continuity and quality

- **FR-16** All Lab 2 and Lab 3 Requester, staff, Administrator, authentication, Ticket, Attachment, Public Comment, and Internal Note behavior shall remain available according to its approved contract.
- **FR-17** New screens and controls shall use Zen Green conventions and remain usable on desktop, tablet, and mobile, with keyboard access, visible focus, semantic labels, and non-color status cues.
- **FR-18** New operations shall show loading, success, validation, empty, forbidden, conflict, not-found, and safe API-failure states as applicable; recoverable failures shall retain entered form data.
- **FR-19** Repeated clicks and network retries shall not create duplicate Actions or silently overwrite a newer Action or Ticket workflow state.

## 5. Business Rules

### Action identity, fields, and lifecycle

- **BR-01** Every Action belongs to exactly one Ticket; one Ticket may have zero or many Actions.
- **BR-02** The Ticket Owner coordinates work, but any authorized IT Staff or Administrator may perform, create, and update Actions on an accessible Ticket. The Action performer, Action assignee, and primary Ticket Owner are separate identities.
- **BR-03** `performedByUserId` and `createdAt` come from the backend and are immutable. The current `assigneeUserId` may be null; a non-null assignee must be active and have role IT Staff or Administrator. Inactive and Requester assignees are rejected.
- **BR-04** An Action starts `PENDING`. Permitted Action status transitions are `PENDING → COMPLETED` and `PENDING → CANCELLED`. `COMPLETED` and `CANCELLED` are terminal in this draft; no deletion or reopen is allowed. A status change is an audited update, not a new Ticket status.
- **BR-05** Action Description is required. Result may be empty while Pending, but is required before Completed. If Follow-Up Required is true, a nonblank Follow-up Note is required. Attachment Notes are optional plain text identifying relevant existing files; they do not grant attachment access or create a new upload.
- **BR-06** Every Action edit records the actor, time, previous value, and new value in append-only audit history. Current Action fields may change; prior revisions cannot be edited or deleted. Requesters see every current Action item on owned Tickets, not private audit metadata.
- **BR-07** Action list order is `createdAt` ascending, then `id` ascending. This order is stable when creation timestamps match.

### Authorization and privacy

- **BR-08** Authentication and role checks are enforced on the backend for every new endpoint. Frontend visibility is supplementary.
- **BR-09** A Requester can read Actions and dashboard data only for their own Tickets. A cross-requester Ticket lookup returns the existing ownership-safe not-found response; no existence or Action content is leaked.
- **BR-10** IT Staff and Administrators can read and write Actions on Tickets available through the Lab 3 staff Ticket scope. Requesters cannot create, edit, assign, complete, or cancel Actions.
- **BR-11** Internal Notes remain staff/Administrator-only and are never included in Requester Actions or dashboard payloads. Requester Action rows may include only the current Action fields and performer/assignee display names; they exclude user IDs, versions, and audit history. Existing Attachment access rules remain in force.

### Ticket workflow and resolution

- **BR-12** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.
- **BR-13** Only IT Staff and Administrators may change formal Ticket status. A Ticket must have a primary owner before any status change, as in Lab 3.
- **BR-14** The backend checks the current Ticket status and Pending Actions within one safe workflow operation. `IN_PROGRESS → RESOLVED` fails with conflict if at least one Action is Pending. Completed and Cancelled Actions do not block resolution; zero Actions do not block it. A bypassed or stale UI cannot evade this rule.
- **BR-15** The Requester's `appearsResolved` flag is advisory and never performs a formal transition.
- **BR-16** Existing Lab 3 confirmation requirements remain: transitions to Resolved, Closed, and Cancelled require UI confirmation; the backend still enforces the transition and gate independently.

### Dashboard definitions

- **BR-17** “Open Tickets” means current status in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; `RESOLVED`, `CLOSED`, and `CANCELLED` are excluded.
- **BR-18** “Recently updated” uses `Ticket.updatedAt >= nowUTC - 7 × 24 hours`; “recently resolved” uses a dedicated `Ticket.resolvedAt >= nowUTC - 7 × 24 hours` and current status `RESOLVED`. The backend supplies the cutoff as UTC; the UI labels the seven-day window. A legacy Resolved Ticket with unknown resolution time is excluded from the recent-resolution count until a new resolution event records that time.
- **BR-19** Requester metrics are restricted by authenticated `requesterId`; staff “mine” metrics use authenticated `ticketOwnerId`, `assigneeUserId`, or `performedByUserId`, as named by each card. “Actions performed by me recently” means Actions with `performedByUserId` equal to the authenticated user and `createdAt` within the same rolling seven-day UTC window. Counts are computed from the database, never from loaded page rows or client-supplied user IDs.
- **BR-20** Dashboard count and drill-down use the same filter semantics. Zero shows `0` and a useful empty message; links do not imply nonexistent records. Lists have stable ordering and a bounded size.
- **BR-21** “Urgent” means nonterminal Ticket with `itPriority = HIGH`; a missing legacy IT Priority is treated according to the Lab 3 backfill/default contract, not silently as high.

### Data safety and failure behavior

- **BR-22** The migration is additive and preserves existing Users, Tickets, Attachments, Public Comments, and Internal Notes. A legacy Ticket starts with zero Actions and remains valid. Migration and recovery steps must be documented and tested.
- **BR-23** Seed data is idempotent and includes assigned/unassigned Tickets, varied status/priority, zero/one/many Actions, and both nonzero and zero dashboard examples.
- **BR-24** Concurrent Action updates must detect stale revisions and return a conflict without overwriting the newer state. Ticket status changes and the resolution gate must be serialized or otherwise safely handled so a concurrent Pending Action cannot race through resolution.
- **BR-25** Action creation uses a request idempotency key or an equivalent server-side duplicate guard; an identical retried request returns the same Action rather than creating another one. The exact request contract is frozen in `api-spec.md`.
- **BR-26** API errors use the Lab 3 canonical safe error structure. Validation, unauthenticated, forbidden, ownership-safe not-found, stale/conflicting state, and unexpected errors remain distinguishable without exposing private data.
- **BR-27** Only a Pending Action may be edited. A new Pending Action cannot be added to a Ticket currently Resolved, Closed, or Cancelled; staff must use an approved Ticket transition such as Reopened first. This preserves the resolution invariant after resolution.
- **BR-28** Every successful formal Ticket status change appends one immutable `TicketStatusChange` with actor, UTC time, previous/next status, and version before/after. The current Ticket status remains the source of truth; history is never edited or deleted.
- **BR-29** Ticket status PATCH accepts optional `expectedVersion` for compatibility with Lab 3 callers; a supplied stale version conflicts without mutation. The Lab 4 UI always sends the latest version. Each successful status transition increments Ticket version.

### Authorization matrix for Lab 4 operations

| Operation | Unauthenticated | Requester | IT Staff | Administrator |
| --- | --- | --- | --- | --- |
| View own Actions on an owned Ticket | — | Yes | N/A | N/A |
| View staff Ticket Actions | — | — | Yes | Yes |
| Create/update/assign/complete/cancel Action | — | — | Yes | Yes |
| Change formal Ticket status | — | — | Yes | Yes |
| View Requester dashboard | — | Own data | — | — |
| View staff dashboard | — | — | Yes | Yes |

### Ticket status transition matrix

All rows require an existing, owned Ticket and IT Staff or Administrator. Unlisted transitions, including `NEW → CLOSED` and any transition out of `CANCELLED`, are forbidden. The Requester advisory flag is not a transition.

| From | To | Extra backend rule | UI confirmation |
| --- | --- | --- | --- |
| New | Open | None | No |
| Open | In Progress | None | No |
| In Progress | Waiting for Requester | None | No |
| Waiting for Requester | In Progress | None | No |
| In Progress | Resolved | No Pending Actions | Yes |
| Resolved | Closed | None | Yes |
| Resolved | Reopened | None | No |
| Reopened | In Progress | None | No |
| Closed | Reopened | None | No |
| Any non-Cancelled status | Cancelled | None | Yes |

## 6. UI Specification Summary

`ui-spec.md` defines the role-specific dashboard as the first useful screen; staff Ticket Detail Actions list/create/view/edit modes and Action status/assignee controls; Requester Ticket Detail read-only Actions; permitted Ticket status controls; loading/empty/forbidden/conflict/failure feedback; desktop, tablet, and mobile layouts; keyboard/focus/label/error requirements. Action status, Ticket status, priority, and private Internal Notes must be visually distinct without relying on color alone. No obsolete Lab 3 controls or unfinished placeholders may remain at release.

## 7. Data Changes

Add `ActionTaken`: `id`, `ticketId` (required FK), `description`, `result` (nullable until completion), `performedByUserId` (required FK), `assigneeUserId` (nullable FK), `status` (`PENDING|COMPLETED|CANCELLED`), `followUpRequired` (boolean), `followUpNote` (nullable text), `attachmentNotes` (nullable text), `createdAt`, `updatedAt`, and `version` (integer for stale-edit detection). Add immutable `ActionTakenRevision`: `id`, `actionId` FK, `editedByUserId` FK, `editedAt`, version before/after, and complete before/after editable-field snapshots. Add immutable `TicketStatusChange`: `id`, `ticketId` FK, `changedByUserId` FK, `changedAt`, `fromStatus`, `toStatus`, and version before/after. Add integer `Ticket.version`, initially 1, and nullable UTC `Ticket.resolvedAt`. The Action FK is indexed by `(ticketId, createdAt, id)`; assignee/status and revision lookup indexes support dashboard and audit queries. Deletion of a Ticket with Actions or status history is restricted, consistent with Lab 3's no-hard-deletion policy.

`Ticket.resolvedAt` is nullable UTC timestamp. Set it when a Ticket enters `RESOLVED`; retain it on `RESOLVED → CLOSED` as a historical timestamp; clear it whenever the Ticket enters `REOPENED` or `CANCELLED`. The recent-resolved card filters current status `RESOLVED`, so Closed Tickets are not counted. Existing resolved Tickets receive `NULL` because the exact historic resolution time cannot be reconstructed from `updatedAt` without inventing data. Existing Ticket and related rows retain their IDs and values. Migration must be reversible or have a documented safe restore procedure, and tests must prove preservation and recovery.

**Design decisions:** Action assignee is separate from auto-recorded performer and Ticket Owner. Immutable Action revisions provide auditability while the current Action remains editable while Pending. Ticket status transitions append immutable `TicketStatusChange` history while retaining the existing mutable current-status field. `resolvedAt` measures resolution rather than unrelated Ticket updates. Optimistic Action versioning and serialized Ticket transitions protect concurrent writes. No migration or seed is executed in this drafting round.

## 8. API Contract Summary

`api-spec.md` freezes Action list/create/read/update under `/api/tickets/:ticketNumber/actions`, the existing Lab 3 status route with optional `expectedVersion`, and role dashboard reads under `/api/requester/dashboard` and `/api/staff/dashboard`. It specifies request and response shapes; pagination/list bounds; validation and length limits; idempotency; version checks; authentication, CSRF, role, and ownership; canonical errors; count formulas; UTC cutoff; drill-down filters; and compatibility behavior.

## 9. Acceptance Criteria

- **AC-01** Given a staff user and an accessible Ticket, creating an Action records the supplied valid fields, Ticket link, server-set performer/time, initial Pending status, and no duplicate on retry. *(FR-02, FR-03, FR-19; BR-01, BR-03, BR-25)*
- **AC-02** Given an Action with follow-up required, omitting or blanking Follow-up Note is rejected without saving; valid Attachment Notes remain text only. *(FR-02; BR-05)*
- **AC-03** Given an assignee, inactive, Requester, or nonexistent users are rejected; an active staff/Admin assignee different from the Ticket Owner is accepted. *(FR-05; BR-02, BR-03)*
- **AC-04** Given multiple Actions on one Ticket, the list is stably ordered, shows current values, and preserves their link to that Ticket. *(FR-01, FR-07; BR-01, BR-07)*
- **AC-05** Given a staff Action update, the current value changes and an immutable revision records the actor, time, before, and after values. *(FR-04; BR-06)*
- **AC-06** Given an Action, only Pending → Completed or Pending → Cancelled is allowed; completion requires Result; invalid or terminal-state transitions and terminal Action edits leave data unchanged. *(FR-04; BR-04, BR-05, BR-27)*
- **AC-07** Given a Requester with an owned Ticket, every current Action is visible read-only with performer/assignee display names; controls, user IDs, audit metadata, another Requester's Action data, and all Internal Notes remain inaccessible. *(FR-06; BR-09, BR-11)*
- **AC-08** Given an unauthenticated or wrong-role caller, Action writes and dashboards are rejected by the backend with safe errors. *(FR-02, FR-12, FR-13; BR-08, BR-10, BR-26)*
- **AC-09** Given two updates based on the same Action version, the first succeeds and the stale update receives conflict without overwriting it. *(FR-19; BR-24)*
- **AC-10** Given zero Actions on a Ticket, the Ticket and old related data remain valid after migration and the Ticket may resolve if the status matrix permits. *(FR-07, FR-09; BR-14, BR-22)*
- **AC-11** Given a Pending Action, an attempted In Progress → Resolved status change fails even by direct API request; completing or cancelling all Pending Actions permits the transition. *(FR-08, FR-09; BR-14)*
- **AC-12** Given any status pair, only listed matrix transitions succeed for staff/Admin on an owned Ticket; forbidden transitions and an unowned Ticket produce conflict without mutation. *(FR-08; BR-12, BR-13)*
- **AC-13** Given a Requester “appears resolved” indication, the flag changes but formal Ticket status does not. *(FR-10; BR-15)*
- **AC-14** Given a status change in the UI, only permitted options are offered, required confirmation appears, and a successful change refreshes Ticket summary. *(FR-11; BR-16)*
- **AC-15** Given a Requester dashboard request, every count/list includes only that Requester's Tickets and matches the documented status and seven-day UTC formulas. *(FR-12, FR-15; BR-17–BR-20)*
- **AC-16** Given a staff dashboard request, unassigned, own Ticket, status, priority, own Pending assigned Action, recently performed Action, recent Ticket, and urgent metrics match authoritative data and have working drill-downs. *(FR-13, FR-15; BR-19–BR-21)*
- **AC-17** Given zero matching records, dashboard cards show `0` and useful empty text without an error; the API returns bounded summaries rather than full Ticket collections. *(FR-15; BR-20)*
- **AC-18** Given an Administrator, the staff dashboard and approved Ticket operations work without exposing Requester-only data outside its authorized scope. *(FR-14; BR-08)*
- **AC-19** Given a populated Lab 3 database, migration and seed preserve all earlier data, are repeatable where specified, and include zero/one/many Action and dashboard fixtures; recovery is documented and tested. *(FR-07, FR-16; BR-22, BR-23)*
- **AC-20** Given new major screens at desktop, tablet, and mobile widths, content remains readable without clipping or unwanted horizontal overflow; controls work by keyboard with visible focus and semantic labels. *(FR-17)*
- **AC-21** Given validation, conflict, forbidden, missing data, or API failure, UI shows safe feedback, retains recoverable form data, and avoids duplicate submission. *(FR-18, FR-19; BR-25, BR-26)*
- **AC-22** Given the integrated Lab 4 branch, required Lab 2 and Lab 3 flows continue to pass automated regression and end-to-end verification. *(FR-16)*
- **AC-23** Given concurrent Action creation and Ticket resolution, the system cannot commit a Resolved Ticket with a Pending Action through a race. *(FR-09, FR-19; BR-14, BR-24)*
- **AC-24** Given recently resolved metrics, a legacy Resolved Ticket with unknown `resolvedAt` is excluded rather than assigned a fabricated resolution date. *(FR-12, FR-15; BR-18, BR-22)*
- **AC-25** Given a Resolved, Closed, or Cancelled Ticket, attempting to create a Pending Action fails without creating a row; a permitted Reopened Ticket can receive a Pending Action. *(FR-02, FR-09; BR-14, BR-27)*

Each AC maps to at least one planned executable test in `docs/lab-04/tests.md`.

## 10. Definition of Done

### Contract gate (Lab 4 #1)

- [ ] Handout requirements and explicit exclusions are represented and reconciled with Lab 3.
- [ ] FR, BR, AC, Action and Ticket status matrices, dashboard formulas, data decisions, and role/ownership rules are reviewed.
- [ ] `api-spec.md` and `ui-spec.md` are completed and agree with this document and `tests.md`.
- [ ] Every AC has a planned executable test; no Planned test is presented as Passed.
- [ ] Lab 3 baseline and dependencies are verified before Lab 4 coding starts.

### Product/release gate (later issues)

- [ ] Actions, workflow, dashboards, migration/seed, API, and UI satisfy the frozen contract.
- [ ] Prior-lab regression, security, concurrency, migration, UI, responsive, accessibility, performance smoke, and end-to-end evidence is recorded.
- [ ] README, reviewer record, AI-use record, and required lab submission evidence reflect actual work, with no fabricated results.
- [ ] Kanban issue states reflect verified completion, not merely drafted documentation.

## 11. Assumptions and Decisions

| Decision | Basis | Draft status |
| --- | --- | --- |
| Action assignee and `PENDING/COMPLETED/CANCELLED` lifecycle are separate from automatic performer | Issue #50 planning decision; handout terminology | Agreed for review |
| New Actions always start `PENDING`; clients cannot set initial status | Issue #50 planning decision | Agreed for review |
| Any Pending Action blocks resolution; zero Actions do not | Lab 3 deferred rule and handout | Agreed for review |
| Requester open status set is the five nonterminal statuses, including Reopened | Draft requirement and dashboard definition | Agreed for review |
| Recent window is rolling seven 24-hour days in UTC | Draft requirement | Agreed for review |
| Any authorized staff/Admin may edit Actions; immutable revisions retain before/after | Issue #50 planning decision | Agreed for review |
| Requester sees current Actions on owned Tickets, not audit metadata | Handout §8.3 and privacy rules | Agreed for review |
| Reopened may transition to In Progress | Issue #50 planning decision; extension to Lab 3 matrix | Agreed for review |
| Existing Lab 3 transitions remain, with resolution gate and append-only TicketStatusChange history | Lab 3 contract and handout continuity | Agreed for review |
| Action completion requires Result; terminal Actions do not reopen | Required to make completion lifecycle determinate | Agreed for review |
| `resolvedAt` is nullable for legacy Tickets | Historic resolution time cannot be reconstructed safely | Agreed for review |
| `expectedVersion` is optional for legacy status PATCH clients; Lab 4 UI always sends it | Compatibility requirement | Agreed for review |
| Action text limits are 2,000 characters for Description/Result and 1,000 for follow-up/attachment notes; idempotency keys remain valid for at least 24 hours | Exact API bounds were delegated to the contract; bounded input and retry recovery | Agreed for review |
| Exact API shapes, validation bounds, idempotency, dashboard filters, and UI states | Frozen in `api-spec.md` and `ui-spec.md` in this contract | Defined |

The handout's “append-only Ticket behavior” means Ticket status history is append-only in `TicketStatusChange`; the Ticket's current fields continue to follow the Lab 3 API contract. Action edits update current fields and append immutable `ActionTakenRevision` snapshots. These history records are not exposed to Requesters. This interpretation preserves audit events without changing existing Ticket response shapes. Human review remains pending.
