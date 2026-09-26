# Lab 3 Visual and Accessibility Evidence Audit

- Date: 2026-09-26
- Implementation SHA: `ce2e40ddf049cf7cf62b43280a563b750622a0a4`
- Viewports: desktop 1280x800, tablet 820x1180, mobile 390x844

## Visual evidence

The committed screenshots were reviewed at each configured viewport. No visible clipping,
overlap, unreadable controls, or unwanted page-level horizontal overflow was observed in these
captured states. `responsive-visual.spec.ts` additionally checks viewport bounds and document
horizontal overflow for the primary controls listed below; the full browser run is the automated
source for those assertions.

| Major screen | Desktop | Tablet | Mobile |
|---|---|---|---|
| Login | [`desktop-login-default.png`](../screenshots/authentication/desktop-login-default.png) | [`tablet-login-default.png`](../screenshots/authentication/tablet-login-default.png) | [`mobile-login-default.png`](../screenshots/authentication/mobile-login-default.png) |
| Change Password | [`desktop-change-password-default.png`](../screenshots/authentication/desktop-change-password-default.png) | [`tablet-change-password-default.png`](../screenshots/authentication/tablet-change-password-default.png) | [`mobile-change-password-default.png`](../screenshots/authentication/mobile-change-password-default.png) |
| Requester My Tickets | [`desktop-requester-my-tickets.png`](../screenshots/authentication/desktop-requester-my-tickets.png) | [`tablet-requester-my-tickets.png`](../screenshots/authentication/tablet-requester-my-tickets.png) | [`mobile-requester-my-tickets.png`](../screenshots/authentication/mobile-requester-my-tickets.png) |
| Requester Ticket Detail | [`desktop-requester-ticket-detail.png`](../screenshots/authentication/desktop-requester-ticket-detail.png) | [`tablet-requester-ticket-detail.png`](../screenshots/authentication/tablet-requester-ticket-detail.png) | [`mobile-requester-ticket-detail.png`](../screenshots/authentication/mobile-requester-ticket-detail.png) |
| Staff Ticket Queue | [`desktop-queue-filtered.png`](../screenshots/staff-queue/desktop-queue-filtered.png) | [`tablet-queue-filtered.png`](../screenshots/staff-queue/tablet-queue-filtered.png) | [`mobile-queue-filtered.png`](../screenshots/staff-queue/mobile-queue-filtered.png) |
| Staff Ticket Detail | [`desktop-detail-unassigned.png`](../screenshots/staff-ticket-detail/desktop-detail-unassigned.png) | [`tablet-detail-unassigned.png`](../screenshots/staff-ticket-detail/tablet-detail-unassigned.png) | [`mobile-detail-unassigned.png`](../screenshots/staff-ticket-detail/mobile-detail-unassigned.png) |
| Administrator User Management | [`desktop-users-list.png`](../screenshots/user-management/desktop-users-list.png) | [`tablet-users-list.png`](../screenshots/user-management/tablet-users-list.png) | [`mobile-users-list.png`](../screenshots/user-management/mobile-users-list.png) |

## Automated checks

- `responsive-visual.spec.ts`: Login, Change Password, Create Ticket, Ticket Created, My Tickets,
  Requester Ticket Detail, Staff Queue, Staff Ticket Detail, and User Management primary controls;
  queue/table and mobile-card presentation; viewport bounds and page horizontal overflow.
- `keyboard-access.spec.ts`: labeled login controls and visible focus, forced password change,
  status-confirmation dialog focus trap/Escape restoration, and keyboard navigation to primary
  Requester, Staff, and Administrator controls.
- Focused responsive and keyboard runs each passed 12/12 across desktop, tablet, and mobile.
  Current integrated full-run counts are in `playwright-full-regression-summary.txt` and
  `playwright-full-final-head.txt`.

The screenshot audit covers the captured default/list/detail states, not every transient
validation or error state. Automated assertions and the named UI tests provide the additional
interaction coverage; this is not a claim of a formal accessibility conformance audit.
