# Lab 3 Sprint Engineering Specification — TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Sprint Goal
Deliver a secure, role-based TokTickIT increment that replaces the temporary Development
Requester selector with real email/password authentication, adds a first operational IT Staff
workflow (Ticket Queue and Ticket Detail), and provides a minimalist Administrator User
Management screen — while preserving every Lab 2 Requester ticket and attachment function and
all existing data.

## 2. Stakeholder Request Interpretation
The temporary Requester selector was a development convenience, not a real identity. The
system now needs real users who authenticate with an email and password. A user signing in
with an initial password must choose a new password before entering the application. Requesters
keep the Lab 2 ticket functions, but the current Requester now comes from the authenticated
account. IT Staff need a professional Ticket Queue to find work, open Ticket Detail, claim or
reassign ownership, set IT Priority, communicate via Public Comments, record private Internal
Notes, and move Tickets through a permitted workflow. Requesters may indicate that a problem
appears resolved, but only IT Staff formally resolve or close a Ticket. Administrators need a
simple User Management screen to view, create, edit, activate/deactivate, and set initial
passwords for users. Every API and screen is protected by role and ownership server-side;
hiding a button is not authorization. The Zen Green design language and reusable components
from Lab 2 remain in force.

## 3. Scope

### Included
- Email/password authentication: login, logout, current-user retrieval, mandatory first-login
  password change
- Role-based navigation and server-side authorization for Requester, IT Staff, and Administrator
- Migration from Development Requester identity to the authenticated User model
- Continued Requester ownership protection for all Lab 2 Ticket and Attachment functions
- IT Staff Ticket Queue (search, filters, sorting, pagination)
- IT Staff Ticket Detail: ownership claim/reassign, IT Priority, permitted status changes,
  Public Comments, Internal Notes
- Requester Public Comments and "Problem Appears Resolved" indication
- Minimalist Administrator User Management: user list, name/email search, optional role filter,
  create, edit, one-role assignment, activation/deactivation, set new initial password
- Data model and REST API changes
- Zen Green UI extensions and reusable component rules
- Acceptance criteria, planned tests, migration/regression evidence, and Product Definition of Done

### Excluded
- Email invitations, password-reset email, multi-factor authentication, social login, single sign-on
- Self-registration and Requester-created accounts
- Actions Taken by IT Staff (deferred to Lab 4)
- Formal SLA calculation, escalation rules, and notification services
- Dashboards and KPI analytics beyond simple queue counts
- Multi-tenant organizations, departments, and customer administration
- Production-grade deployment or cloud infrastructure changes
- Multiple roles assigned to one user
- User deletion, bulk user operations, user import/export, account-history screens
- Department, organization, profile-photo, and other extended user-profile management
- Email delivery of initial passwords or reset links
- Account unlocking, administrator approval workflows, advanced identity-management functions
- Advanced user-list features: mandatory pagination, multi-column sorting, multiple simultaneous filters

### Decision-free implementation rule
This Lab 3 contract is a closed specification: an implementation may only include behaviors
explicitly required by this document and the Lab 3 handout. The agent must not add extra roles,
status transitions, admin flows, UI widgets, or validation rules that are not called out in the
requirement set.

If a requirement is missing, contradictory, or ambiguous, the correct action is to stop and
request clarification rather than choose a design. The only allowed defaults are the ones
explicitly stated in the requirement text or in the Assumptions and Decisions section.

### Requirement precedence
When Lab 3 documents conflict, the agent must resolve them in this order:
1. `Lab_03_labsheet.pdf` requirement text and scope statements
2. `docs/lab-03/specification.md`
3. `docs/lab-03/api-spec.md`
4. `docs/lab-03/ui-spec.md`
5. `docs/lab-03/tests.md`
6. Existing implementation code only as a compatibility aid, not as a source of new behavior

Implementations must follow the written contract; they do not define the contract.

### Closed-contract edge-case policy
The Lab 3 contract is intentionally closed. The implementation may not invent additional
behavior for missing or ambiguous cases. The following decisions are normative and binding for
all implementation and tests:

- The authenticated user identity, never a client-supplied `requesterId`, determines ownership
  of Requester operations (BR-03).
- Passwords are never stored in plaintext; they are hashed with bcrypt (BR-06).
- A user who must change their password cannot reach normal application screens until a valid
  new password is saved (BR-02).
- Public Comments are visible to Requester, IT Staff, and Administrator; Internal Notes are
  visible only to IT Staff and Administrator (BR-04).
- A Requester may indicate that a problem appears resolved but cannot formally set a Ticket to
  Resolved or Closed (BR-05).
- All API errors use the canonical error object and status/condition table in `api-spec.md`.
- Every protected operation is enforced server-side; a hidden or disabled frontend control is
  feedback only, never a security control.

If a legal execution path is not explicitly listed here or in the functional/business rules,
the correct action is to stop and request clarification rather than choose a design.

## 4. Functional Requirements

**Authentication & session**
- **FR-01** The system shall authenticate a user with an email address and password.
- **FR-02** The system shall establish an authenticated session on successful login and return
  the permitted user identity and role.
- **FR-03** The system shall provide logout that removes authenticated access.
- **FR-04** The system shall provide a current-user endpoint that returns the authenticated
  user's identity and role.
- **FR-05** The system shall require a user with an initial password to change it before
  entering the normal application.
- **FR-06** The system shall reject login for an inactive account without exposing unnecessary
  account information.

**Authorization & navigation**
- **FR-07** The system shall enforce role-based authorization server-side for Requester, IT
  Staff, and Administrator.
- **FR-08** The system shall show role-specific navigation without presenting unauthorized
  destinations.
- **FR-09** The system shall protect every API and screen according to role and ownership;
  hiding a button is not authorization.

**Requester regression**
- **FR-10** The system shall continue all Lab 2 Requester ticket and attachment functions using
  the authenticated Requester identity.
- **FR-11** The system shall remove the Development Requester selector and Change Requester
  action.
- **FR-12** The system shall allow a Requester to post Public Comments on an owned Ticket.
- **FR-13** The system shall allow a Requester to indicate that a problem appears resolved.

**IT Staff operations**
- **FR-14** The system shall provide an IT Staff Ticket Queue with search, filters, sorting,
  and pagination.
- **FR-15** The system shall allow IT Staff to open a Ticket Detail from the Queue.
- **FR-16** The system shall allow IT Staff to claim, assign, or reassign Ticket ownership.
- **FR-17** The system shall allow IT Staff to set IT Priority.
- **FR-18** The system shall allow IT Staff to perform permitted status changes.
- **FR-19** The system shall allow IT Staff to post Public Comments.
- **FR-20** The system shall allow IT Staff to create Internal Notes.

**Administrator user management**
- **FR-21** The system shall allow an Administrator to view the user list with Name, Email,
  Role, and Status.
- **FR-22** The system shall allow an Administrator to search users by name or email.
- **FR-23** The system shall allow an Administrator to optionally filter users by role.
- **FR-24** The system shall allow an Administrator to create a user with one permitted role
  and an initial password.
- **FR-25** The system shall allow an Administrator to edit a user's name, email address, role,
  and activation state.
- **FR-26** The system shall allow an Administrator to set a new initial password that must be
  changed at the user's next login.

## 5. Business Rules

**Authentication & passwords**
- **BR-01** Only an active user with valid credentials may authenticate.
- **BR-02** A user marked as requiring a password change cannot enter the normal application
  until a new valid password is saved.
- **BR-05** A Requester may indicate that a problem appears resolved, but cannot formally set
  the Ticket to Resolved or Closed.
- **BR-06** Passwords are hashed with bcrypt and are never stored or transmitted in plaintext.
- **BR-07** Login failure returns a safe, generic error that does not reveal whether the email
  exists or the password was wrong.
- **BR-08** An inactive user cannot authenticate; the login response does not reveal account
  status details.
- **BR-09** Logout invalidates the authenticated session server-side.
- **BR-10** A new initial password must satisfy the documented password rules (length and
  composition) and must be changed at the next login.

**Identity & ownership**
- **BR-03** The authenticated user identity, not a requesterId supplied by the client,
  determines ownership of Requester operations.
- **BR-11** Ticket ownership is fixed at creation to the authenticated Requester and cannot be
  changed by the Requester afterward.
- **BR-12** All Requester ticket and attachment endpoints enforce ownership server-side by
  comparing the ticket's owner to the authenticated user. A mismatch returns `404 Not Found`
  (not `403`), so a non-owner cannot confirm the resource exists.
- **BR-13** The authenticated user's email address is unique; duplicate email addresses are
  rejected.

**IT Staff assignment & priority**
- **BR-14** A Ticket may have zero or one primary Ticket Owner who is an active IT Staff or
  Administrator user. A Ticket may initially be unassigned.
- **BR-15** Requested Priority remains the value submitted by the Requester.
- **BR-16** IT Priority initially copies Requested Priority and may later be changed only by IT
  Staff or Administrator.

**Status workflow**
- **BR-17** The required Ticket statuses are New, Open, In Progress, Waiting for Requester,
  Resolved, Closed, Reopened, and Cancelled.
- **BR-18** Status transitions follow the Status Transition Matrix in Section 7; only permitted
  roles may perform each transition.
- **BR-19** The Requester "Problem Appears Resolved" indication (BR-05) is a boolean flag on the
  Ticket, not a status change; it never moves the Ticket to Resolved or Closed.
- **BR-20** Actions Taken is out of scope for Lab 3; the rule that blocks resolution while
  Actions Taken remain incomplete is deferred to Lab 4.

**Public Comments & Internal Notes**
- **BR-04** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal
  Notes are visible only to IT Staff and Administrator.
- **BR-21** Public Comments and Internal Notes are append-only in Lab 3; editing and deletion
  are excluded.
- **BR-22** Each Comment and Note records its author and creation time from the backend.
- **BR-23** Empty or whitespace-only Comment/Note content is rejected. Content is trimmed before
  validation and persisted trimmed. Length limit: 1–2,000 characters after trim.
- **BR-24** Comment and Note content is rendered safely (no raw HTML execution).

**Administrator safety rules**
- **BR-25** An Administrator may create a user with exactly one permitted role.
- **BR-26** An Administrator may update a user's name, email address, role, and activation state.
- **BR-27** An Administrator cannot deactivate their own account.
- **BR-28** The system must never remove or deactivate the last active Administrator. This
  includes rejecting both (a) deactivation of the last active Administrator and (b) changing the
  last active Administrator's role to a non-Administrator role.
- **BR-29** Users are deactivated rather than deleted; there is no user deletion.
- **BR-30** Setting a new initial password marks the user as requiring a password change at the
  next login.

**Validation & failure behavior**
- **BR-31** All protected endpoints distinguish unauthenticated access, authenticated but
  forbidden access, invalid input, missing resources, conflicts, and unexpected server errors.
- **BR-32** The system must not leak whether another user's protected Ticket, Attachment, or
  Internal Note exists.
- **BR-33** The system shall preserve entered form data and show a safe inline error when an
  API call fails, without automatic retry.

## 6. Authorization Matrix

The following matrix is normative. Every protected operation is enforced server-side. A hidden
or disabled frontend control is feedback only, never a security control.

| Action | Unauthenticated | Requester | IT Staff | Administrator |
|---|---|---|---|---|
| Login | ✅ | — | — | — |
| Logout | — | ✅ | ✅ | ✅ |
| Current user | — | ✅ | ✅ | ✅ |
| Change own password | — | ✅ | ✅ | ✅ |
| Create Ticket | — | ✅ | — | — |
| View own Tickets (My Tickets) | — | ✅ | — | — |
| View own Ticket Detail | — | ✅ | — | — |
| Manage own Ticket Attachments | — | ✅ | — | — |
| Post Public Comment on owned Ticket | — | ✅ | ✅ | ✅ |
| Indicate problem appears resolved | — | ✅ | — | — |
| View IT Staff Ticket Queue | — | — | ✅ | ✅ |
| Open any Ticket Detail (staff) | — | — | ✅ | ✅ |
| Claim / assign / reassign ownership | — | — | ✅ | ✅ |
| Set IT Priority | — | — | ✅ | ✅ |
| Perform permitted status changes | — | — | ✅ | ✅ |
| Create Internal Notes | — | — | ✅ | ✅ |
| View Internal Notes | — | — | ✅ | ✅ |
| View user list | — | — | — | ✅ |
| Search / filter users | — | — | — | ✅ |
| Create user | — | — | — | ✅ |
| Edit user (name, email, role, activation) | — | — | — | ✅ |
| Set new initial password | — | — | — | ✅ |

**Administrator vs IT Staff separation:** Administrator and IT Staff responsibilities remain
conceptually separate. IT Staff manage Tickets; Administrators manage user accounts. An
Administrator does not automatically perform IT Staff Ticket operations unless the approved
authorization matrix explicitly permits it. In this contract, the matrix grants Administrators
the same Ticket operations as IT Staff (Queue, Detail, ownership, IT Priority, status, Public
Comments, Internal Notes) because an Administrator is an active IT Staff-equivalent for Ticket
operations; however, only Administrators may perform user-management actions.

## 7. Status Transition Matrix

The following matrix is normative. Each row defines a permitted transition. Any transition not
listed is forbidden and returns `409 CONFLICT` (or the documented safe error).

| From | To | Permitted roles | Validation | Confirmation | Notes |
|---|---|---|---|---|
| New | Open | IT Staff, Administrator | Ticket exists | None | Initial triage |
| Open | In Progress | IT Staff, Administrator | Ticket owned or being claimed | None | Work started |
| In Progress | Waiting for Requester | IT Staff, Administrator | Ticket owned | None | Awaiting requester input |
| Waiting for Requester | In Progress | IT Staff, Administrator | Ticket owned | None | Requester responded |
| In Progress | Resolved | IT Staff, Administrator | Ticket owned | Confirmation | Formal resolution |
| Resolved | Closed | IT Staff, Administrator | Ticket owned | Confirmation | Final close |
| Resolved | Reopened | IT Staff, Administrator | Ticket owned | None | Reopen after resolution |
| Closed | Reopened | IT Staff, Administrator | Ticket owned | None | Reopen after close |
| Any | Cancelled | IT Staff, Administrator | Ticket owned | Confirmation | Cancelled |

**Requester "appears resolved" indication:** A Requester may set a boolean "Problem Appears
Resolved" flag on an owned Ticket (FR-13, BR-19). This is not a status change; it does not move
the Ticket to Resolved or Closed. Only IT Staff or Administrator may set the formal status to
Resolved or Closed.

**Forbidden transitions:** All transitions not listed above are forbidden (e.g., Requester
setting Resolved/Closed, New → Closed directly, Cancelled → any other status). Forbidden
transitions return `409 CONFLICT` with a safe message and do not change the Ticket.

## 8. UI Specification Summary
The Lab 3 UI extends the Lab 2 Zen Green design language. Screens: Login, Change Password,
Requester Shell, Requester Ticket Detail (with Public Comments and "Problem Appears Resolved"),
IT Staff Ticket Queue, IT Staff Ticket Detail, and Administrator User Management. Full screen
structure, modes, controls, feedback, role behavior, responsive rules, and accessibility are
defined in `docs/lab-03/ui-spec.md`.

## 9. Data Changes
The Lab 2 PostgreSQL/Prisma model is evolved into the Lab 3 User/authentication model while
preserving existing data. See `docs/lab-03/api-spec.md` for the API contract and the migration
inventory below.

### 9.1 Migration and seed decisions
- The Lab 2 `DevRequester` records are migrated/evolved into the real `User` model. Existing
  Ticket ownership must remain correct.
- Existing `Category`, `RelatedSystem`, `Ticket`, and `Attachment` rows remain valid after
  migration.
- Existing Requesters receive initial passwords via the approved local-lab behavior; the
  temporary selector and its client-side state are removed.
- The `X-Dev-Requester-Id` header is removed from protected behavior; the authenticated user
  identity replaces it.
- Seed logic is idempotent and safe to run repeatedly.
- Seed data: at least four active Requester accounts and one inactive Requester account; at
  least three active IT Staff accounts and one inactive IT Staff account; at least one active
  Administrator account; realistic Tickets distributed across Requesters, statuses, priorities,
  and assigned/unassigned ownership; example Public Comments and Internal Notes that do not
  expose sensitive information.
- Seeded credentials are for local development only and are clearly documented; no real
  personal passwords or secrets are placed in the repository.

**Design decisions**
- One User has one permitted role in Lab 3: Requester, IT Staff, or Administrator.
- A User has activation state and password-change state.
- A Ticket has zero or one primary Ticket Owner (active IT Staff or Administrator).
- A Ticket may contain many Public Comments and many Internal Notes; each has one author.
- Passwords are stored as bcrypt hashes, never plaintext.

## 10. API Contract Summary
The REST API supports login, logout, current user, password change, all Lab 2 Requester ticket
and attachment APIs (authenticated), IT Staff Ticket Queue, IT Staff Ticket Detail operations,
Public Comments, Internal Notes, and Administrator user management. Exact paths, methods,
request/response shapes, authentication/session behavior, validation, status codes,
authorization, and safe errors are defined in `docs/lab-03/api-spec.md`.

## 11. Acceptance Criteria
- **AC-01** Given an active user with valid credentials, when the user logs in, then the
  backend establishes authenticated access and returns the permitted user identity and role.
  *(FR-01, FR-02, BR-01)*
- **AC-02** Given a user who must change the initial password, when login succeeds, then normal
  application screens remain unavailable until a valid new password is saved. *(FR-05, BR-02)*
- **AC-03** Given an authenticated Requester, when the client supplies another requesterId,
  then the backend still applies the authenticated identity and does not return another
  Requester's data. *(FR-10, BR-03, BR-12)*
- **AC-04** Given a Requester account, when an Internal Note endpoint is requested, then the
  operation is rejected without exposing note content. *(FR-20, BR-04, BR-32)*
- **AC-05** Given an inactive account, when login is attempted, then authentication fails with
  a safe error that does not reveal account status. *(FR-06, BR-08)*
- **AC-06** Given an authenticated user, when logout is performed, then authenticated access is
  removed and protected endpoints are no longer accessible. *(FR-03, BR-09)*
- **AC-07** Given an authenticated Requester, when they create a Ticket, then the Ticket is
  owned by the authenticated identity and appears in My Tickets. *(FR-10, BR-11)*
- **AC-08** Given an authenticated Requester, when they post a Public Comment on an owned
  Ticket, then the Comment is saved with author and timestamp from the backend. *(FR-12, BR-22)*
- **AC-09** Given an authenticated Requester, when they indicate a problem appears resolved,
  then the flag is saved but the Ticket status is not changed to Resolved or Closed. *(FR-13,
  BR-19)*
- **AC-10** Given an IT Staff user, when they open the Ticket Queue, then they see Tickets with
  search, filters, sorting, and pagination. *(FR-14, BR-17)*
- **AC-11** Given an IT Staff user, when they claim or reassign a Ticket, then the Ticket Owner
  is updated to an active IT Staff or Administrator user. *(FR-16, BR-14)*
- **AC-12** Given an IT Staff user, when they set IT Priority, then IT Priority is updated and
  Requested Priority is unchanged. *(FR-17, BR-15, BR-16)*
- **AC-13** Given an IT Staff user, when they perform a permitted status change, then the
  Ticket status changes according to the Status Transition Matrix. *(FR-18, BR-18)*
- **AC-14** Given an IT Staff user, when they create an Internal Note, then the Note is saved
  and is visible only to IT Staff and Administrator. *(FR-20, BR-04)*
- **AC-15** Given an Administrator, when they view the user list, then they see Name, Email,
  Role, and Status with name/email search and optional role filter. *(FR-21, FR-22, FR-23)*
- **AC-16** Given an Administrator, when they create a user with one role and an initial
  password, then the user is created and must change the password at next login. *(FR-24,
  BR-25, BR-30)*
- **AC-17** Given an Administrator, when they edit a user's name, email, role, or activation
  state, then the change is saved and duplicate email addresses are rejected. *(FR-25, BR-13,
  BR-26)*
- **AC-18** Given an Administrator, when they attempt to deactivate their own account, then the
  operation is rejected. *(BR-27)*
- **AC-19** Given the system, when an Administrator attempts to deactivate the last active
  Administrator, then the operation is rejected. *(BR-28)*
- **AC-20** Given a non-Administrator, when they request a user-management endpoint, then the
  operation is forbidden. *(FR-07, FR-09)*

## 12. Definition of Done

**Product**
- [ ] All handout requirements represented.
- [ ] All handout exclusions represented.
- [ ] Lab 2 preservation requirements represented.
- [ ] Migration strategy documented.
- [ ] Authorization matrix frozen.
- [ ] Status matrix frozen.
- [ ] API contract frozen.
- [ ] UI contract frozen.
- [ ] Acceptance Criteria defined.
- [ ] Test DD created.
- [ ] No implementation code changed.

**Process**
- [ ] `docs/lab-03/specification.md`, `ui-spec.md`, `api-spec.md`, and `tests.md` exist.
- [ ] Every Acceptance Criterion maps to at least one planned test.
- [ ] `tests.md` exists before or alongside implementation.
- [ ] Contract is reviewed/approved before dependent implementation begins.

## 13. Assumptions and Decisions
1. **Authentication mechanism:** Session cookie (httpOnly cookie + server-side session store),
   chosen for logout invalidation and CSRF control.
2. **Password hashing:** bcrypt.
3. **Status matrix:** As defined in Section 7; the Requester "appears resolved" flag is not a
   status.
4. **Queue defaults:** Default sort = Created Date descending; page size 10.
5. **Comment/Note length limit:** 1–2,000 characters after trim.
6. **Administrator Ticket operations:** Administrators may perform the same Ticket operations as
   IT Staff (per the authorization matrix), but only Administrators perform user management.