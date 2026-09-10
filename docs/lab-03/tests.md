# Lab 3 Test Plan and Results - TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Purpose
This document is the Lab 3 testing contract for:
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`

## 2. Current Tooling and Paths
Backend (configured now):
- Runner: Vitest
- Existing folder: `server/tests/`
- Planned Lab 3 folder: `server/tests/lab-03/`

Frontend (configured now):
- Runner: Vitest + React Testing Library
- Existing folder: `client/src/`
- Planned Lab 3 folder: `client/src/lab-03-tests/`

E2E/Responsive/Keyboard (planned):
- Runner: Playwright
- Planned folder: `e2e/lab-03/`

## 2a. Execution Evidence
No execution evidence yet. This issue (Issue #34) is the Sprint 3 engineering contract / Spec DD
and produces no implementation code. All test rows below are `Planned`; they will be implemented
and executed by downstream issues (Issues 2–10). Results will be recorded here, newest first,
as implementation proceeds.

## 3. Test Status Terminology
`Final` describes evidence status, not the expected behavior: `Planned` means the test row is
specified but its automated test is not implemented; `Implemented` means the test exists but has
not yet passed in the current evidence log; `Passed` means the test exists and passed; `Failed`
means the latest run failed; and `Blocked` means it cannot run because its documented
prerequisite is unavailable. A row must not be marked `Passed` based on this plan alone.

## 4. Coverage Completeness Gate
Every Acceptance Criterion (AC-01 through AC-20) maps to at least one planned test below. The
matrix covers unit, API/integration, UI component, UI style, responsive, accessibility,
security/authorization, migration/regression, and end-to-end coverage.

## 5. Test Traceability Matrix (Planned Contract)

| Test ID | Type | What It Tests | Expected Result | Automated Test File | FR | BR | Requirement / AC | Final |
|---|---|---|---|---|---|---|---|---|
| API-AUTH-01 | API | Valid login | Authenticated response; safe user data | `server/tests/lab-03/auth.api.test.ts` | FR-01, FR-02 | BR-01 | AC-01 | Planned |
| API-AUTH-02 | API | Invalid login | Safe generic error; no account-status leak | `server/tests/lab-03/auth.api.test.ts` | FR-01 | BR-07, BR-08 | AC-05 | Planned |
| API-AUTH-03 | API | Inactive account login | Authentication fails; safe error | `server/tests/lab-03/auth.api.test.ts` | FR-06 | BR-08 | AC-05 | Planned |
| API-AUTH-04 | API | Logout | Session invalidated; protected endpoints blocked | `server/tests/lab-03/auth.api.test.ts` | FR-03 | BR-09 | AC-06 | Planned |
| API-AUTH-05 | API | Current user | Returns authenticated identity and role | `server/tests/lab-03/auth.api.test.ts` | FR-04 | — | AC-01 | Planned |
| API-AUTH-06 | API | Mandatory password change | Normal app blocked until valid new password saved | `server/tests/lab-03/auth.api.test.ts` | FR-05 | BR-02 | AC-02 | Planned |
| API-AUTH-07 | API | Password boundaries | Invalid new password rejected | `server/tests/lab-03/auth.api.test.ts` | FR-05 | BR-10 | AC-02 | Planned |
| SEC-AUTHZ-01 | API | Requester supplies another requesterId | Authenticated identity applied; no other user's data | `server/tests/lab-03/authorization.api.test.ts` | FR-10 | BR-03, BR-12 | AC-03 | Planned |
| SEC-AUTHZ-02 | API | Requester requests Internal Notes | Forbidden; no note data returned | `server/tests/lab-03/notes.api.test.ts` | FR-20 | BR-04, BR-32 | AC-04 | Planned |
| SEC-AUTHZ-03 | API | Non-Admin requests user management | Forbidden | `server/tests/lab-03/users-admin.api.test.ts` | FR-07, FR-09 | — | AC-20 | Planned |
| SEC-AUTHZ-04 | API | Unauthenticated protected endpoint | 401 UNAUTHENTICATED | `server/tests/lab-03/authorization.api.test.ts` | FR-07 | BR-31 | AC-06 | Planned |
| SEC-AUTHZ-05 | API | Cross-user Ticket/Attachment access | 404 NOT_FOUND; no existence leak | `server/tests/lab-03/authorization.api.test.ts` | FR-10 | BR-12, BR-32 | AC-03 | Planned |
| API-REQ-01 | API | Requester creates Ticket | Ticket owned by authenticated identity | `server/tests/lab-03/requester.api.test.ts` | FR-10 | BR-11 | AC-07 | Planned |
| API-REQ-02 | API | Requester My Tickets | Only owned Tickets returned | `server/tests/lab-03/requester.api.test.ts` | FR-10 | BR-12 | AC-07 | Planned |
| API-REQ-03 | API | Requester posts Public Comment | Comment saved with author/timestamp | `server/tests/lab-03/comments-notes.api.test.ts` | FR-12 | BR-22, BR-23 | AC-08 | Planned |
| API-REQ-04 | API | Requester indicates appears resolved | Flag saved; status unchanged | `server/tests/lab-03/requester.api.test.ts` | FR-13 | BR-05, BR-19 | AC-09 | Planned |
| API-QUE-01 | API | IT Staff queue retrieval | Search/filter/sort/pagination works | `server/tests/lab-03/staff-queue.api.test.ts` | FR-14 | BR-17 | AC-10 | Planned |
| API-QUE-02 | API | Queue invalid query params | Safe defaults applied | `server/tests/lab-03/staff-queue.api.test.ts` | FR-14 | BR-31 | AC-10 | Planned |
| API-STAFF-01 | API | Claim/reassign ownership | Owner updated to active IT Staff/Admin | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-16 | BR-14 | AC-11 | Planned |
| API-STAFF-02 | API | Set IT Priority | IT Priority updated; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-17 | BR-15, BR-16 | AC-12 | Planned |
| API-STAFF-03 | API | Permitted status change | Status changes per matrix | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-18 | AC-13 | Planned |
| API-STAFF-04 | API | Forbidden status transition | 409 CONFLICT; no change | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | FR-18 | BR-18, BR-20 | AC-13 | Planned |
| API-STAFF-05 | API | Create Internal Note | Note saved; visible only to IT Staff/Admin | `server/tests/lab-03/comments-notes.api.test.ts` | FR-20 | BR-04, BR-21, BR-24 | AC-14 | Planned |
| API-ADM-01 | API | User list | Name/Email/Role/Status returned | `server/tests/lab-03/users-admin.api.test.ts` | FR-21 | — | AC-15 | Planned |
| API-ADM-02 | API | User search/filter | Name/email search; optional role filter | `server/tests/lab-03/users-admin.api.test.ts` | FR-22, FR-23 | — | AC-15 | Planned |
| API-ADM-03 | API | Create user | User created; must change password next login | `server/tests/lab-03/users-admin.api.test.ts` | FR-24 | BR-25, BR-30 | AC-16 | Planned |
| API-ADM-04 | API | Duplicate email | 409 CONFLICT | `server/tests/lab-03/users-admin.api.test.ts` | FR-25 | BR-13 | AC-17 | Planned |
| API-ADM-05 | API | Edit user | Name/email/role/activation updated | `server/tests/lab-03/users-admin.api.test.ts` | FR-25 | BR-26 | AC-17 | Planned |
| API-ADM-06 | API | Self-deactivation | Rejected | `server/tests/lab-03/users-admin.api.test.ts` | — | BR-27 | AC-18 | Planned |
| API-ADM-07 | API | Last active Administrator | Rejected | `server/tests/lab-03/users-admin.api.test.ts` | — | BR-28, BR-29 | AC-19 | Planned |
| API-ADM-08 | API | Set new initial password | User must change password next login | `server/tests/lab-03/users-admin.api.test.ts` | FR-26 | BR-30 | AC-16 | Planned |
| UNIT-AUTH-01 | Unit | Password hashing | bcrypt hash; no plaintext | `server/tests/lab-03/auth.unit.test.ts` | FR-01 | BR-06 | AC-01 | Planned |
| UNIT-COMMENT-01 | Unit | Comment/Note validation | Trim; whitespace rejected; length limits | `server/tests/lab-03/comments-notes.unit.test.ts` | FR-12 | BR-21, BR-23, BR-24 | AC-08 | Planned |
| DB-MIG-01 | DB | DevRequester → User migration | Existing ownership preserved | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | BR-11 | AC-07 | Planned |
| DB-MIG-02 | DB | Existing data preserved | Categories/RelatedSystems/Tickets/Attachments valid | `server/tests/lab-03/migration.integration.test.ts` | FR-10 | — | AC-07 | Planned |
| SEED-01 | DB | Seed idempotency | Safe to run repeatedly | `server/tests/lab-03/seed.integration.test.ts` | — | — | AC-16 | Planned |
| UI-LOGIN-01 | UI | Login screen | Valid/invalid login; busy/safe failure; form data preserved | `client/src/lab-03-tests/Login.test.tsx` | FR-01 | BR-07, BR-33 | AC-01 | Planned |
| UI-CHPWD-01 | UI | Change Password screen | Mandatory change; validation; continuation | `client/src/lab-03-tests/ChangePassword.test.tsx` | FR-05 | BR-02 | AC-02 | Planned |
| UI-QUE-01 | UI | Staff Ticket Queue | Search/filter/sort/pagination; empty/no-results | `client/src/lab-03-tests/StaffTicketQueue.test.tsx` | FR-14 | BR-17 | AC-10 | Planned |
| UI-STAFF-01 | UI | Staff Ticket Detail | Ownership/priority/status/comments/notes | `client/src/lab-03-tests/StaffTicketDetail.test.tsx` | FR-16–20 | BR-14–18 | AC-11–14 | Planned |
| UI-ADM-01 | UI | User Management | List/search/filter/create/edit/activate | `client/src/lab-03-tests/UserManagement.test.tsx` | FR-21–26 | BR-25–30 | AC-15–19 | Planned |
| UI-STYLE-01 | UI Style | Zen Green tokens | No ad-hoc colors | `client/src/lab-03-tests/UiStyles.test.tsx` | FR-08 | — | AC-20 | Planned |
| VISUAL-01 | Responsive | All major screens | Desktop/tablet/mobile screenshots | `e2e/lab-03/responsive-visual.spec.ts` | FR-08 | — | AC-20 | Planned |
| A11Y-01 | Accessibility | Keyboard/focus/aria | Keyboard-operable; focus visible | `e2e/lab-03/keyboard-access.spec.ts` | FR-08 | — | AC-20 | Planned |
| E2E-01 | E2E | Authentication flow | Login → change password → app → logout | `e2e/lab-03/authentication.spec.ts` | FR-01–06 | BR-01–10 | AC-01, AC-02, AC-05, AC-06 | Planned |
| E2E-02 | E2E | Staff ticket flow | Queue → detail → claim → priority → status → comments/notes | `e2e/lab-03/staff-ticket-flow.spec.ts` | FR-14–20 | BR-14–18 | AC-10–14 | Planned |
| E2E-03 | E2E | User administration | List → search → create → edit → initial password | `e2e/lab-03/user-administration.spec.ts` | FR-21–26 | BR-25–30 | AC-15–19 | Planned |
| E2E-04 | E2E | Requester regression | Create → My Tickets → detail → comments → appears resolved (removes Dev Requester selector) | `e2e/lab-03/requester-regression.spec.ts` | FR-10–13 | BR-05, BR-11, BR-19 | AC-07–09 | Planned |

## 6. Requirement → Test Mapping Summary
Every Acceptance Criterion maps to at least one planned test:
- AC-01 → API-AUTH-01, API-AUTH-05, UNIT-AUTH-01, UI-LOGIN-01, E2E-01
- AC-02 → API-AUTH-06, API-AUTH-07, UI-CHPWD-01, E2E-01
- AC-03 → SEC-AUTHZ-01, SEC-AUTHZ-05
- AC-04 → SEC-AUTHZ-02
- AC-05 → API-AUTH-02, API-AUTH-03, E2E-01
- AC-06 → API-AUTH-04, SEC-AUTHZ-04, E2E-01
- AC-07 → API-REQ-01, API-REQ-02, DB-MIG-01, DB-MIG-02, E2E-04
- AC-08 → API-REQ-03, UNIT-COMMENT-01, E2E-04
- AC-09 → API-REQ-04, E2E-04
- AC-10 → API-QUE-01, API-QUE-02, UI-QUE-01
- AC-11 → API-STAFF-01, UI-STAFF-01, E2E-02
- AC-12 → API-STAFF-02, UI-STAFF-01, E2E-02
- AC-13 → API-STAFF-03, API-STAFF-04, UI-STAFF-01, E2E-02
- AC-14 → API-STAFF-05, UI-STAFF-01, E2E-02
- AC-15 → API-ADM-01, API-ADM-02, UI-ADM-01, E2E-03
- AC-16 → API-ADM-03, API-ADM-08, SEED-01, UI-ADM-01, E2E-03
- AC-17 → API-ADM-04, API-ADM-05, UI-ADM-01, E2E-03
- AC-18 → API-ADM-06, UI-ADM-01
- AC-19 → API-ADM-07, UI-ADM-01
- AC-20 → SEC-AUTHZ-03, UI-STYLE-01, VISUAL-01, A11Y-01