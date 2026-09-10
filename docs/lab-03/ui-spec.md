# Lab 3 UI Specification — Zen Green Theme

## 1. Color Tokens
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tab, focus accents, links, hover |
| `--color-pale-green` | `#EAF6EF` | Selected state, success surfaces, subtle emphasis |
| `--color-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels (subtle border, restrained shadow) |
| `--color-text` | `#1C2B24` (dark charcoal-green) | Body text |
| `--color-field-editable-bg` | `#FFFFFF` | Editable field background, neutral border |
| `--color-field-readonly-bg` | `#F1F4F1` (soft gray-green) | Read-only field background |
| `--color-error` | `#B3261E` | Error text/border |
| `--color-warning` | `#B7791F` | Warning callouts/badges only, never decorative |
| `--color-success` | `#0B7A46` | Success confirmation, paired with text/icon (not color alone) |

## 2. Typography & Spacing
- Font: system UI stack (`-apple-system, "Segoe UI", Roboto, sans-serif`).
- Base size 16px; labels 14px/medium weight; page titles 24px/semibold; section headers 18px/semibold.
- Spacing scale: 4/8/12/16/24/32px. Form field vertical rhythm: 16px between fields, 8px between label and control.
- Line length for Description/Summary textareas capped at ~80ch on desktop for readability.

## 3. Field & Component States
| State | Visual treatment |
|---|---|
| Editable | White bg, 1px neutral border, standard height (40px) |
| Read-only | `--color-field-readonly-bg`, no border-hover, cursor default, subtle "lock"-style visual distinction |
| Invalid | `--color-error` border + text message directly below field (never top-of-form only) |
| Disabled | Reduced opacity (0.5), `not-allowed` cursor, no hover/focus styles |
| Focused | 2px `--color-secondary` outline, visible for keyboard users, never removed via `outline: none` without replacement |
| Busy (Submit button) | Spinner + disabled + label changes to "Submitting…" |

Required fields show a red asterisk **next to the label**; the asterisk is a visual cue only and
never substitutes for the inline validation message.

## 4. Button Hierarchy
| Type | Style |
|---|---|
| Primary | Solid `--color-primary`, white text (e.g., Login, Save, Claim) |
| Secondary | Outlined `--color-secondary`, `--color-secondary` text (e.g., Cancel, Logout) |
| Tertiary | Text-only link style (e.g., Clear Filters) |
| Destructive | Outlined `--color-error`, red text (e.g., Deactivate) |
| Disabled | Any type at 0.5 opacity, no pointer events |
| Busy | Primary style + inline spinner, disabled |

All buttons show visible text; icons may accompany but never replace text. Icon-only controls
require `aria-label` and a tooltip.

## 5. Screens

### 5.1 Login
- Email and password fields with labels.
- Login button (primary), busy state while in flight.
- Validation: inline errors below fields.
- Safe failure feedback: generic message for invalid credentials or inactive account (does not
  reveal account status).
- Full keyboard operability; visible focus ring.

### 5.2 Change Password
- Current password, new password, confirm new password fields.
- Password rules shown.
- Validation: inline errors below fields.
- On success: continue into the application.
- Busy state while saving.

### 5.3 Application Shell
- Header: TokTickIT wordmark/icon (left), role-specific nav (center/left-aligned), current user
  name + role + Logout (right).
- Role-specific navigation without presenting unauthorized destinations.
- Active nav item shown with `--color-secondary` underline/background, not color alone (also
  bold weight).
- Mobile (<768px): nav collapses to a hamburger menu; user identity remains visible in a compact
  header bar.

### 5.4 Requester Shell (My Tickets / Create Ticket)
- Same as Lab 2 Requester screens, but the current Requester comes from the authenticated
  account. The Development Requester selector and Change Requester action are removed.
- My Tickets: search, filters, sorting, pagination, empty/no-results states.
- Create Ticket: category, related system, summary, description, requested priority, attachments.

### 5.5 Requester Ticket Detail
- Ticket information clearly grouped; read-only ticket fields.
- Attachment management (upload, list, preview, download, soft removal) with ownership protection.
- Public Comments section: list of comments with author and timestamp; input to post a comment.
- "Problem Appears Resolved" action (Requester) — a boolean indication, not a status change.
- Screen-level states: Loading, Not found / not owned (404), Unexpected failure (500/network).

### 5.6 IT Staff Ticket Queue
- Toolbar: search input, status filter, priority filter, owner filter, Clear Filters.
- Desktop: table with columns — Ticket No., Created Date, Summary, Category, Requested Priority
  (badge), IT Priority (badge), Current Status (badge), Ticket Owner, Last Updated, Open Detail
  action.
- Smaller screens: card representation.
- Loading, empty, no-results, forbidden, and failure feedback.
- Pagination.

### 5.7 IT Staff Ticket Detail
- Ticket information clearly grouped; only permitted operational fields editable.
- Ownership: claim/assign/reassign control.
- IT Priority: editable by IT Staff/Administrator.
- Status: permitted status changes per the Status Transition Matrix.
- Public Comments and Internal Notes sections, visually distinct so private information is not
  accidentally posted publicly.
- Existing Attachments.
- Role-specific actions.
- Screen-level states: Loading, Not found (404), Forbidden (403), Unexpected failure.

### 5.8 Administrator User Management
- User list showing Name, Email, Role, Status, and an Edit action.
- Search by name or email; optional role filter.
- Create user: name, email, one permitted role, activation state, initial password.
- Edit user: name, email, role, activation state.
- Set new initial password action.
- Validation: duplicate email, invalid role, self-deactivation, last-active-Administrator.
- Clear validation, success, forbidden, and safe API-failure feedback.
- No pagination, multi-column sorting, or multiple simultaneous filters (excluded).

## 6. Badges
| Badge type | Values → style |
|---|---|
| Ticket status | New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled |
| Requested Priority | LOW, MEDIUM, HIGH |
| IT Priority | LOW, MEDIUM, HIGH |
| Role | Requester, IT Staff, Administrator |

## 7. Responsive Rules
| Breakpoint | Rule |
|---|---|
| Desktop ≥992px | Full table layouts; multi-column forms |
| Tablet 768–991px | Condensed tables; stacked forms |
| Mobile <768px | Card layouts; hamburger nav; ≥44px touch targets |

## 8. Accessibility
- All form controls have associated `<label>` elements (not placeholder-only labeling).
- Error messages are associated to their field via `aria-describedby`.
- Modal dialogs trap focus and are closable via `Esc`.
- Role-specific navigation is keyboard-operable.
- Visible focus ring on all interactive controls.

## 9. Visual Verification Checklist
- [ ] Zen Green tokens used consistently; no ad-hoc colors.
- [ ] Role navigation shows only permitted destinations.
- [ ] Badges used for status, priorities, and role.
- [ ] Editable vs read-only fields clearly distinguished.
- [ ] Validation placement is inline below fields.
- [ ] Focus visible for keyboard users.
- [ ] No clipping, overlap, or horizontal overflow at any breakpoint.

## 10. Screenshot Paths
```text
artifacts/lab-03/screenshots/
├── authentication/
├── staff-queue/
├── staff-ticket-detail/
└── user-management/
```