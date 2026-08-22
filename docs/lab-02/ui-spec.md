# Lab 2 UI Specification — Zen Green Theme

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

Required fields show a red asterisk **next to the label**; the asterisk is a visual cue
only and never substitutes for the inline validation message.

## 4. Button Hierarchy
| Type | Style |
|---|---|
| Primary | Solid `--color-primary`, white text (e.g., Submit, Continue) |
| Secondary | Outlined `--color-secondary`, `--color-secondary` text (e.g., Cancel, Change Requester) |
| Tertiary | Text-only link style (e.g., Clear Filters) |
| Destructive | Outlined `--color-error`, red text (e.g., Remove Attachment) |
| Disabled | Any type at 0.5 opacity, no pointer events |
| Busy | Primary style + inline spinner, disabled |

All buttons show visible text; icons may accompany but never replace text. Icon-only
controls (e.g., a table-row "…" menu) require `aria-label` and a tooltip.

## 5. Screens

### 5.1 Application Shell
- Header: TokTickIT wordmark/icon (left), primary nav — **My Tickets**, **Create Ticket**
  (center/left-aligned), current Development Requester name + Change Requester + Profile
  menu (right).
- Active nav item shown with `--color-secondary` underline/background, not color alone
  (also bold weight) for non-color-reliant indication.
- Mobile (<768px): nav collapses to a hamburger menu; requester identity remains visible
  in a compact header bar.

### 5.2 Development Requester Selection Screen
Required elements (per handout §8.1):
- TokTickIT title + one-sentence explanation: "for Lab 2 testing only, not a login screen"
- Requester dropdown (loaded from `GET /api/dev-requesters`)
- Continue button (primary), disabled until a selection is made
- Loading state: skeleton dropdown + disabled Continue
- Empty state (no active requesters): message + disabled Continue, no dropdown shown
- Failure state: inline error banner + Retry button (this screen's own "try again" is a
  manual user action, consistent with BR-16's no-auto-retry principle)
- Full keyboard operability; visible focus ring on the dropdown and button

### 5.3 Create Ticket
Layout (desktop, top→bottom): system-generated/read-only fields (Ticket Number placeholder
"assigned after submit", Ticket Date placeholder "now" before creation, Requester name —
read-only, sourced from selection) → classification row (Category, Related System, Requested Priority selects) →
Summary (single-line, full width) → Description (textarea, resizable vertically only,
min-height 120px) → Attachments panel → action row (Cancel secondary, Submit primary,
right-aligned).

- Attachments panel: drag-and-drop + "Browse files" button, shows selected files with
  name/size/type-icon and a per-file remove (×) before submit; running count "`n`/5"; a
  file that fails type/size validation shows an inline red message next to that file
  without blocking the others.
- Submit button: primary, shows busy state while in flight (BR-15), disabled if any field
  is currently invalid.
- On success: replace form with a success panel showing the generated Ticket Number
  (from the API response, not client-guessed) and a "View Ticket" / "Create Another" action.
- After success, Ticket Date is rendered from the backend `createdAt` returned in the
  persisted Ticket response; the client never submits or generates this value.
- On failure — **Case A: ticket creation fails** (BR-16): inline error banner above the
  form; **all field values remain populated**; Submit re-enables for manual retry. No
  ticket exists yet, so retrying the full create flow is correct.
- On failure — **Case B: ticket created but attachment upload fails** (BR-17, partial
  success): the ticket already exists, so the UI must **not** re-enable or resubmit the
  full create flow (that would create a duplicate ticket). Instead:
  - show the generated Ticket Number (ticket is saved, not rolled back);
  - report the attachment failure separately with an explanatory message;
  - provide "View Ticket" (to retry the attachment from Ticket Detail) and "Create
    Another" actions; the Submit button stays disabled/hidden in this state.

### 5.4 My Tickets
- Toolbar: search input (ticket number/summary), Category filter, Requested Priority
  filter, Current Status filter, Clear Filters (tertiary), Create Ticket (primary, top right).
- Desktop: table with sortable columns — Ticket No., Created Date, Summary, Category,
  Requested Priority (badge), Current Status (badge), Last Updated. Column headers show a
  sort indicator (▲/▼) and are keyboard-activatable.
- Mobile (<768px): each ticket renders as a stacked card (Ticket No. + Status badge on top
  row, Summary below, secondary details collapsed) — no horizontal table scrolling.
- Pagination footer: "Showing X–Y of Z tickets" + Previous/Next + page numbers.
- Loading: skeleton rows/cards.
- **Empty state** (zero tickets ever): centered illustration/icon + "You haven't created
  any tickets yet" + Create Ticket primary button. No filter controls implied as the fix.
- **No-results state** (filters/search active, zero matches): "No tickets match your
  filters" + Clear Filters primary action. Visually distinct from Empty (different icon/
  copy) so a Requester never confuses "I have nothing" with "my filter is too narrow."
- Failure state: inline error banner + Retry (manual).

### 5.5 Requester Ticket Detail (View Mode)
- Header row: Ticket Number + Current Status badge, "← Back to My Tickets" link.
- Read-only info grid (2–3 columns desktop, stacked mobile): Ticket Date, Category,
  Related System, Requester (name), Requested Priority
  badge, IT Priority badge (shows "Not yet triaged" placeholder styling when null), Ticket
  Owner (shows "Unassigned" when null), Summary, Description (full width, read-only
  textarea styling).
- Clearly separated **Attachments** section below the info grid (visually distinct panel,
  not blended into ticket fields):
  - List of attachments: filename, size, type icon, uploaded date, status.
  - Active attachment row actions: Preview (opens modal/subpage — image inline or PDF
    first page), Download, Remove (destructive style).
  - Removed attachment row: de-emphasized (reduced opacity), "Removed" badge, Preview/
    Download controls disabled (not hidden — visible-but-disabled, per BR-20), removal
    reason shown as a small caption if present.
  - Add Attachment control (same validation/limits as Create Ticket's panel).
  - Remove action opens a confirmation dialog with an optional reason textarea before
    calling the soft-delete endpoint (BR-19).
- Explicitly **not present**: comments, internal notes, actions-taken log, status-change
  controls (out of scope per specification.md §3).

## 6. Badges
| Badge type | Values → style |
|---|---|
| Requested/IT Priority | `LOW` = pale green pill; `MEDIUM` = amber/warning pill; `HIGH` = red-bordered pill. Never color-only — text label always present. |
| Current Status | `New` = secondary-green pill. (Only value reachable in Lab 2; other status styles reserved for later labs.) |
| Attachment Removed | Gray pill, "Removed" label, placed next to filename |

## 7. Responsive Rules
| Breakpoint | Rule |
|---|---|
| Desktop ≥992px | Multi-column layouts as described per screen; content max-width ~1200px, centered |
| Tablet 768–991px | Two-column where practical; Summary/Description get full available width |
| Mobile <768px | All fields stack vertically; buttons full-width or clearly touch-sized (≥44px height); table → card layout; zero horizontal scroll |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, no truncated/unreadable attachment filenames (wrap or ellipsis-with-tooltip) |

## 8. Accessibility
- All form controls have associated `<label>` elements (not placeholder-only labeling).
- Icon-only controls have `aria-label` + visible tooltip on hover/focus.
- Focus order follows visual/reading order; focus ring never suppressed without replacement.
- Error messages are associated to their field via `aria-describedby`.
- Status/priority information is never conveyed by color alone — always paired with text.
- Modal dialogs (attachment preview, removal confirmation) trap focus and are closable via `Esc`.

## 9. Visual Verification Checklist (per screen, per viewport)
- [ ] Zen Green color tokens applied correctly (no ad hoc colors)
- [ ] Editable vs. read-only fields are visually distinguishable at a glance
- [ ] Required-field asterisk present; validation message appears directly under the field
- [ ] Button hierarchy correct (primary/secondary/tertiary/destructive/disabled/busy)
- [ ] No clipped labels, overlapping messages, or hidden buttons
- [ ] No unintended horizontal scrolling at any breakpoint
- [ ] Badges legible and non-color-reliant
- [ ] Loading/empty/no-results/error states all present and visually distinct

## 10. Screenshot Paths (for tests.md / Definition of Done evidence)
```
artifacts/lab-02/screenshots/
├── requester-selection/   (loading, empty, failure, populated)
├── create-ticket/         (initial, validation-error, submitting, success, api-failure, partial-success-attachment-failure)
├── my-tickets/            (desktop, tablet, mobile, empty, no-results, filtered)
└── ticket-detail/         (desktop, mobile, attachment-active, attachment-removed, preview-modal)
```