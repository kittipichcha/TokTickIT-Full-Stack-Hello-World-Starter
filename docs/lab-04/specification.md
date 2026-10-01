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

The supplied `SE+Lab+4.pdf` is the Lab 4 handout. The integrated Lab 3 contracts govern existing roles, Ticket statuses, ownership, security, and API behavior until Lab 4 explicitly extends them. This Issue #50 contract includes `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, and the intentional Lab 4 workflow extension in `agent.md`. That `agent.md` inclusion is an exception to the normal governance-isolation rule and was accepted by the peer reviewer in direct off-platform discussion with the author on 2026-10-01; this scope acceptance is separate from formal GitHub PR approval. It adds no runtime implementation. The Lab 4 workflow records include `lab4-staging`, owning-Lab feature branches/worktrees, Lab 4 test/AI/reviewer records, and PR targeting. Lab 3 prerequisites are documented; this documentation task makes no new runtime implementation claim.

## 4. Functional Requirements

### Actions Taken

- **FR-01** Staff and Administrators shall list Actions Taken for an accessible Ticket in stable chronological order and open an Action's current details.
- **FR-02** Staff and Administrators shall create an Action on an accessible Ticket with Action Description, Result, Follow-Up Required, conditional Follow-up Note, Attachment Notes, optional assignee, and a server-set initial `PENDING` status.
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
- **FR-20** Staff and Administrators shall read paginated, immutable formal Ticket status history in stable chronological order.

## 5. Business Rules

### Action identity, fields, and lifecycle

- **BR-01** Every Action belongs to exactly one Ticket; one Ticket may have zero or many Actions.
- **BR-02** The Ticket Owner coordinates work, but any authorized IT Staff or Administrator may perform, create, and update Actions on an accessible Ticket. The Action performer, Action assignee, and primary Ticket Owner are separate identities.
- **BR-03** `performedByUserId` and `createdAt` come from the backend and are immutable. The current `assigneeUserId` may be null. Creating or changing an assignment requires the target to be active and have role IT Staff or Administrator at the time of that assignment; inactive and Requester targets are rejected. A later deactivation or role change does not silently rewrite an existing Action assignment. The UI retains and warns on that now-ineligible current assignee. A later Action PATCH must explicitly set an eligible active Staff/Administrator assignee or `null` before any edited state can be persisted; otherwise it returns `409 CONFLICT` without changing the Action, version, or revision history.
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
- **BR-32** Lab 4 migration cannot start until the integrated Lab 3 baseline is verified, including Lab 3 Phase A, the identity/attachment/priority backfill, and Phase C completion. Stop application writers before taking a full custom PostgreSQL snapshot and a paired attachment-storage snapshot. Verify the database snapshot by restoring it into a separate empty rehearsal database and comparing required counts/identity invariants; verify attachment snapshot hashes. Apply only additive Lab 4 schema changes after both snapshots pass. Validate preserved records and attachment references before enabling Lab 4 writes. If migration or validation fails before Lab 4 writes, keep writers stopped and restore both snapshots as a matched pair. Once any Lab 4 write is accepted, never restore the old snapshot: preserve current database and attachment state, stop affected writes, and forward-recover through an approved fix and migration. Record each gate and result.
- **BR-23** Seed data is idempotent and includes assigned/unassigned Tickets, varied status/priority, zero/one/many Actions, and both nonzero and zero dashboard examples.
- **BR-24** Concurrent Action updates must detect stale revisions and return a conflict without overwriting the newer state. Ticket status changes and the resolution gate must be serialized or otherwise safely handled so a concurrent Pending Action cannot race through resolution.
- **BR-25** Action creation requires the `Idempotency-Key` header; an identical retried request returns the same Action rather than creating another one. The exact request contract is frozen in `api-spec.md`.
- **BR-26** API errors use the Lab 3 canonical safe error structure. Validation, unauthenticated, forbidden, ownership-safe not-found, stale/conflicting state, and unexpected errors remain distinguishable without exposing private data.
- **BR-27** Only a Pending Action may be edited. A new Pending Action cannot be added to a Ticket currently Resolved, Closed, or Cancelled; staff must use an approved Ticket transition such as Reopened first. This preserves the resolution invariant after resolution.
- **BR-28** Every successful formal Ticket status change appends one immutable `TicketStatusChange` with actor, UTC time, previous/next status, and version before/after. The current Ticket status remains the source of truth; history is never edited or deleted.
- **BR-29** Ticket status PATCH accepts optional `expectedVersion` for compatibility with Lab 3 callers; a supplied stale version conflicts without mutation. The Lab 4 UI always sends the latest version. Each successful status transition increments Ticket version.
- **BR-30** Owner, priority, and status mutations share one Ticket version. Each accepts an optional positive integer `expectedVersion`; malformed values fail validation and stale values conflict without mutation. Owner and priority writes may succeed when the requested value matches the current value; each accepted write increments the version exactly once. Formal status writes must follow the transition matrix: a same-status request is forbidden and returns `409 CONFLICT` without mutation or version increment. It preserves every Ticket field, including `currentStatus`, `updatedAt`, and `resolvedAt`, and appends no status-history row. Comparison, transition validation, write, and increment are atomic. A Ticket must have a non-null owner for status changes, but the authorized acting staff member need not be that owner.
- **BR-31** Staff status history is append-only and returned in ascending `(changedAt, id)` order. Requesters cannot read it. A successful status transition appends exactly one history row; failed requests append none.

### Authorization matrix for Lab 4 operations

| Operation | Unauthenticated | Requester | IT Staff | Administrator |
| --- | --- | --- | --- | --- |
| View own Actions on an owned Ticket | — | Yes | N/A | N/A |
| View staff Ticket Actions | — | — | Yes | Yes |
| Create/update/assign/complete/cancel Action | — | — | Yes | Yes |
| Change formal Ticket status | — | — | Yes | Yes |
| Read formal Ticket status history | — | No | Yes | Yes |
| View Requester dashboard | — | Own data | — | — |
| View staff dashboard | — | — | Yes | Yes |

### Ticket status transition matrix

All rows require an existing Ticket with a non-null primary Ticket Owner and an authorized IT Staff/Administrator actor; the actor need not be that owner. Unlisted transitions, including `NEW → CLOSED` and any transition out of `CANCELLED`, are forbidden. The Requester advisory flag is not a transition.

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

Add `ActionTaken`: `id`, `ticketId` (required FK), `description`, `result` (nullable until completion), `performedByUserId` (required FK), `assigneeUserId` (nullable FK), `status` (`PENDING|COMPLETED|CANCELLED`), `followUpRequired` (boolean), `followUpNote` (nullable text), `attachmentNotes` (nullable text), `createdAt`, `updatedAt`, and `version` (integer for stale-edit detection). Add immutable `ActionTakenRevision`: `id`, `actionId` FK, `editedByUserId` FK, `editedAt`, version before/after, and complete before/after editable-field snapshots. Add immutable `TicketStatusChange`: `id`, `ticketId` FK, `changedByUserId` FK, `changedAt`, `fromStatus`, `toStatus`, and version before/after. Add `ActionCreateIdempotency`: `id`, `actorUserId`, concrete Action-create `route` including Ticket number, `key`, normalized request SHA-256, Action ID, original 201 response, `createdAt`, and `expiresAt` exactly 24 hours after creation; enforce unique `(actorUserId, route, key)`. Add integer `Ticket.version`, initially 1, and nullable UTC `Ticket.resolvedAt`. Exact indexes: `ActionTaken(ticketId, createdAt, id)`, `ActionTaken(assigneeUserId, status, createdAt, id)`, `ActionTaken(performedByUserId, createdAt, id)`, `ActionTakenRevision(actionId, editedAt, id)`, `TicketStatusChange(ticketId, changedAt, id)`, and `ActionCreateIdempotency(expiresAt, id)`, plus the idempotency unique constraint. Do not add indexes to `Ticket` in the Lab 4 migration. Run idempotency expiry cleanup hourly, at most 500 rows per transaction ordered by `(expiresAt, id)`, deleting only `expiresAt <= now UTC` rows and emitting deleted-row count plus success/failure; later hourly batches continue remaining rows. Expired keys are invalid during lookup regardless of cleanup state. Deletion of a Ticket with Actions or status history is restricted, consistent with Lab 3's no-hard-deletion policy.

`Ticket.resolvedAt` is nullable UTC timestamp. Set it when a Ticket enters `RESOLVED`; retain it on `RESOLVED → CLOSED` as a historical timestamp; clear it whenever the Ticket enters `REOPENED` or `CANCELLED`. The recent-resolved card filters current status `RESOLVED`, so Closed Tickets are not counted. Existing resolved Tickets receive `NULL` because the exact historic resolution time cannot be reconstructed from `updatedAt` without inventing data. Existing Ticket and related rows retain their IDs and values. Recovery uses the single snapshot and forward-recovery procedure in BR-32; rollback after accepted Lab 4 writes is forbidden. Tests must prove preservation and recovery.

### Lab 3 migration and continuity gate

Before Lab 4 migration, verify the integrated Lab 3 release baseline and clean migration state. Confirm Phase A is applied, the backfill completed with verified identity mapping, attachment ownership, IT Priority defaults, and User ID sequence, and Phase C is applied. Do not run the Lab 3 orchestrator again as part of Lab 4 migration. Stop all application writers. Take a full custom-format PostgreSQL database snapshot and a paired snapshot of attachment storage. Record snapshot identifiers, database/schema migration versions, object counts, and attachment hashes. Restore the database snapshot into a separate empty rehearsal database; verify restore success, key table counts/IDs, foreign keys, migration history, and representative attachment references. Verify every paired attachment object against its recorded hash. Any failed check blocks cutover.

Treat production-derived database and attachment snapshots as sensitive data. Restrict access to the migration operators, encrypt snapshots in storage and transfer, never commit or upload them to general-purpose artifacts, and never print credentials, personal data, or attachment contents in logs. Keep only redacted validation results and hashes in the evidence record. Delete temporary rehearsal copies and credentials after verification according to the approved retention policy; use synthetic fixtures for automated tests.

The automated Lab 3 migration fixture must remain isolated from the repository schema and migrations. In the existing `server/tests/lab-03/migration.integration.test.ts`, `createHistoricalMigrationContext()` creates a per-run temporary root with `mkdtemp`, copies the exact `server/prisma/schema.prisma`, `server/prisma/migrations/migration_lock.toml`, and these seven migration directories and their `migration.sql` files: `20260808100141_add_cateogory`, `20260823090000_add_dev_requester`, `20260823091000_add_is_active_to_category`, `20260825000000_add_ticket_related_system_attachment`, `20260826000000_add_ticket_indexes_attachment_relations`, `20260917000000_lab3_phase_a_expand`, and `20260917000001_lab3_phase_c_contract`. The helper sets `MIGRATION_TEST_SCHEMA_PATH` to the absolute path of its copied `schema.prisma`; child Prisma commands inherit that value. Before execution, compare SHA-256 hashes of each copied file against its source; any missing file or hash mismatch fails setup before a migration command can run. Use only a disposable test database URL for the fixture. Set `NODE_ENV=test`, require `MIGRATION_TEST_SCHEMA_PATH` to resolve inside the current fixture root, and pass `--schema "$MIGRATION_TEST_SCHEMA_PATH"` to every Prisma CLI invocation, including migrate, status, and schema-management commands. Reject fixture startup unless `NODE_ENV` is exactly `test`, the database URL is explicitly configured as disposable, and the override points to the verified copied schema; reject production-like database URLs, missing paths, paths outside the fixture root, and any invocation without that explicit schema argument before Prisma starts. Keep existing real Lab 3 migration assertions unchanged and enabled. Do not mock the migration CLI, skip, delete, weaken, or rewrite those assertions to make Lab 4 migration setup pass. Clean up the per-run temporary root and test database in `finally` after Prisma disconnects.

The fixture must test both schema-selection paths. With `NODE_ENV=test`, the verified override must select the copied historical schema; negative cases for another environment, missing or outside-root override, unsafe/missing database URL, or missing explicit `--schema` must reject before any Prisma command. Then explicitly unset `MIGRATION_TEST_SCHEMA_PATH` and run the full normal migration history using the installed server-local Prisma CLI. Before deploy, run `server/node_modules/.bin/prisma migrate status --schema server/prisma/schema.prisma`; require the expected Lab 4 migration pending and no failed migration. Then run `server/node_modules/.bin/prisma migrate deploy --schema server/prisma/schema.prisma`, followed by `server/node_modules/.bin/prisma migrate status --schema server/prisma/schema.prisma`; require the database to be up to date. Both status and deploy commands use the disposable test database and pass explicit `--schema`. This normal-path check must not inherit the historical fixture override.

Only after rehearsal verification passes, apply the additive Lab 4 migration. Preserve User, Ticket, Attachment, Comment, and InternalNote IDs, values, relationships, and existing routes/semantics; create Lab 4 Action/history/idempotency structures and Ticket version/resolvedAt fields. Initialize every existing Ticket version to 1, keep existing resolved Tickets' `resolvedAt` null, and do not synthesize Actions or historical status events. Validate schema/migration history, counts and identity comparisons, foreign keys, attachment hashes/references, and zero-Action Ticket behavior before enabling writers. Migration or validation failure before Lab 4 writes uses the paired snapshots for restore. After the first accepted Lab 4 write, never restore those snapshots: isolate affected writes, preserve current state, and forward-recover with an approved corrective migration/fix, then rerun validation.

Lab 4 extends the integrated Lab 3 application. Retain existing authentication/session, CSRF, role checks, Ticket create/read/update, ownership, priority, status compatibility, attachment upload/download, Public Comment, Internal Note, and administrator flows. Add only the approved Action, formal status history, optimistic concurrency, dashboards, and additive response fields/routes. Keep the dashboard as a landing view while preserving navigation to the existing Ticket Queue, Ticket Detail, comments, notes, attachments, and admin functions. Keep existing Lab 1/Lab 2/Lab 3 test files and assertions; adapt only tests whose expected contract changes under an explicitly additive Lab 4 behavior, with the reason and replacement assertion recorded. Run all prior-lab suites and E2E flows against the integrated Lab 4 branch, then run Lab 4 migration, API, UI, accessibility, responsive, and E2E tests. No test is Passed without full executable evidence.

**Design decisions:** Action assignee is separate from auto-recorded performer and Ticket Owner. Immutable Action revisions provide auditability while the current Action remains editable while Pending. Ticket status transitions append immutable `TicketStatusChange` history while retaining the existing mutable current-status field. `resolvedAt` measures resolution rather than unrelated Ticket updates. Optimistic Action versioning and serialized Ticket transitions protect concurrent writes. No migration or seed is executed in this drafting round.

## 8. API Contract Summary

`api-spec.md` freezes Action list/create/read/update under `/api/tickets/:ticketNumber/actions`, the existing Lab 3 status route with optional `expectedVersion`, and role dashboard reads under `/api/requester/dashboard` and `/api/staff/dashboard`. It specifies request and response shapes; pagination/list bounds; validation and length limits; idempotency; version checks; authentication, CSRF, role, and ownership; canonical errors; count formulas; UTC cutoff; drill-down filters; and compatibility behavior.

## 9. Acceptance Criteria

- **AC-01** Given a staff user and an accessible Ticket, creating an Action records the supplied valid fields, Ticket link, server-set performer/time, initial Pending status, and no duplicate on retry. *(FR-02, FR-03, FR-19; BR-01, BR-03, BR-25)*
- **AC-02** Given an Action with follow-up required, omitting or blanking Follow-up Note is rejected without saving; valid Attachment Notes remain text only. *(FR-02; BR-05)*
- **AC-03** Given an assignee, inactive, Requester, or nonexistent users are rejected at assignment time; an active staff/Admin assignee different from the Ticket Owner is accepted. If an existing assignee later becomes inactive or changes away from Staff/Admin, the current assignment remains visible and is not silently cleared, but a later Action PATCH must explicitly assign an eligible active Staff/Admin user or `null`; otherwise it returns `409 CONFLICT` without mutation, version increment, or revision row. *(FR-04, FR-05; BR-02, BR-03)*
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
- **AC-26** Given an authorized IT Staff or Administrator, status history is paginated and ordered by `(changedAt, id)` ascending; Requesters are forbidden, unauthenticated callers are rejected, and missing Tickets return not-found. Each successful status change has one immutable history row; failures have none. *(FR-20; BR-08, BR-31)*
- **AC-27** Given owner, priority, or status mutation, omitted `expectedVersion` remains compatible and malformed versions fail validation; stale versions conflict. Accepted owner/priority same-value writes increment shared Ticket version once. A same-status request is not a permitted transition and returns `409 CONFLICT`; a complete Ticket snapshot, including `currentStatus`, `updatedAt`, `resolvedAt`, and version, remains unchanged and no history row is appended. Permitted status transitions increment once and append one history row. The owner must be non-null for status changes, but need not be the acting staff member. *(FR-11, FR-19; BR-13, BR-30)*

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
