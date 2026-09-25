# SEC-AUTHZ-07 integrated CSRF route inventory

Verification source: `server/tests/lab-03/authorization.api.test.ts`, run with the integrated `lab3-staging` worktree at baseline commit `77d810b`. The dedicated JSON run is in `sec-authz-07-vitest.json` (52 tests passed, 0 failed). Each route below is probed with both a missing and an invalid CSRF token; each response must be `403 FORBIDDEN`, the persisted User/Ticket/Attachment/Comment/InternalNote/TicketSequence snapshot must remain unchanged, and the session must remain usable through `/api/auth/me`. Valid-token controls reach every handler.

| Protected mutation | Missing token | Invalid token | Valid-token control |
|---|---|---|---|
| `POST /api/auth/logout` | 403; unchanged | 403; unchanged | Separate logout rejection control preserves the session |
| `POST /api/auth/change-password` | 403; unchanged | 403; unchanged | Valid change-password coverage remains in auth API tests |
| `POST /api/tickets` | 403; unchanged | 403; unchanged | Ticket created, then removed |
| `POST /api/tickets/:ticketNumber/attachments` | 403; unchanged | 403; unchanged | Upload succeeds |
| `DELETE /api/attachments/:attachmentId` | 403; unchanged | 403; unchanged | Delete succeeds |
| `POST /api/staff/tickets/:ticketNumber/owner` | 403; unchanged | 403; unchanged | Owner assignment succeeds |
| `PATCH /api/staff/tickets/:ticketNumber/priority` | 403; unchanged | 403; unchanged | Priority update succeeds |
| `PATCH /api/staff/tickets/:ticketNumber/status` | 403; unchanged | 403; unchanged | Status transition succeeds |
| `POST /api/tickets/:ticketNumber/comments` | 403; unchanged | 403; unchanged | Public comment succeeds |
| `POST /api/staff/tickets/:ticketNumber/notes` | 403; unchanged | 403; unchanged | Private note succeeds |
| `POST /api/tickets/:ticketNumber/appears-resolved` | 403; unchanged | 403; unchanged | Handler has valid-session coverage in requester API tests |
| `POST /api/admin/users` | 403; unchanged | 403; unchanged | Create-user handler has valid-session coverage in admin API tests |
| `PATCH /api/admin/users/:userId` | 403; unchanged | 403; unchanged | User update handler has valid-session coverage in admin API tests |
| `POST /api/admin/users/:userId/initial-password` | 403; unchanged | 403; unchanged | Initial-password handler has valid-session coverage in admin API tests |

The route set is the integrated registration in `server/src/module.ts`; no route was excluded from the 14-route frozen row. The full integrated server run also passed (598 tests across 39 files). This inventory is supplementary evidence for the frozen SEC-AUTHZ-07 row; it does not change row ownership from Issue #37.
