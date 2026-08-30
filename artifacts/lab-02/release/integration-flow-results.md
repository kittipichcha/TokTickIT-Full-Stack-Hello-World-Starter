# Lab 2 Release Verification — Integration Flow Results

**Issue:** #18 — Lab 2 Final Integration and Release Verification
**Date:** 2026-08-29
**Command:** `npx playwright test e2e/lab-02` (desktop/tablet/mobile)
**Result:** 159 passed, 0 failed

## E2E-01 — Requester creates ticket and finds it in My Tickets

- **File**: `e2e/lab-02/requester-ticket-flow.spec.ts`
- **Flow**: Requester → Create Ticket → API persistence → My Tickets → Search → Ticket appears → Detail
- **Assertions**: unique summary visible; actual generated Ticket Number visible; search by unique summary returns the exact ticket; detail opens with the same Ticket Number.
- **Result**: **PASS**

## E2E-02 — Ownership isolation across two requester contexts

- **File**: `e2e/lab-02/ownership.spec.ts`
- **Flow**: A creates ticket A → B creates ticket B → B cannot see A → A cannot see B → direct API: B fetch A → 404 NOT_FOUND, A fetch B → 404 NOT_FOUND, owner fetch → 200.
- **Assertions**: unique identifiers used to avoid false positives; canonical `NOT_FOUND` ownership response (BR-24).
- **Result**: **PASS**

## E2E-03 — Full attachment lifecycle

- **File**: `e2e/lab-02/attachment-lifecycle.spec.ts`
- **Flow**: Create ticket → open detail → upload → appears → preview → download → remove → Removed badge → Preview/Download disabled.
- **Assertions**: attachment name visible; active status; removed badge; disabled controls.
- **Result**: **PASS**

## E2E-04 — BR-17 partial success (ticket created, attachment fails)

- **File**: `e2e/lab-02/partial-success-attachment.spec.ts`
- **Flow**: Create ticket with attachment → attachment upload FORCED to fail (route interception) → ticket persists → failure reported separately → open Ticket Detail → retry → retry succeeds → same Ticket Number → exactly one ticket.
- **Assertions**: success panel + Ticket Number; `.case-b-note` visible; `.upload-failed` visible; retry succeeds; `.attachment-failed` gone; Ticket Number unchanged; exactly one visible ticket link.
- **Result**: **PASS**

## E2E-05 — Keyboard accessibility

- **File**: `e2e/lab-02/keyboard-access.spec.ts`
- **Flow**: The mandatory flow completes Requester Selection → Continue → Create Ticket using `Tab`/`Shift+Tab`/`Enter`/`Space`/`ArrowDown`/`ArrowUp` (Issue #18 §24, amended to permit Arrow keys). The requester control is the specification-required native `<select>` (id `requester-select`), loaded from `GET /api/dev-requesters`, showing only active requesters, with a disabled placeholder so Continue is disabled until a selection is made (ui-spec §5.2). **This is one of the production changes in the PR** (`client/src/App.tsx`): a verification-driven fix scoped to the requester-selection control only. Supporting tests also verify focus indicators, Change Requester reachability/operability, and the removal-dialog focus trap (focus enters, Tab stays inside, Escape closes, focus restores).
- **Assertions**: focus order sensible; visible focus indicators; controls operable without a mouse; validation states remain keyboard-usable; Change Requester reachable and keyboard-operable; Continue disabled before selection and enabled after.
- **Result**: **PASS**

## E2E-06 / VISUAL-01 — Responsive layout and visual evidence

- **File**: `e2e/lab-02/responsive-visual.spec.ts`
- **Flow**: no horizontal scroll at desktop/tablet/mobile for My Tickets, Create Ticket, Requester Selection, and Ticket Detail; My Tickets table→card conversion per breakpoint; ≥44px mobile touch targets for required controls (Change Requester, ticket-card toggle, pagination, Submit, Cancel, category/related-system/priority selects, requester dropdown, Continue, Preview, Download, Remove, Add Attachment); required controls visible and usable; no clipped labels and no overlapping controls for all four screens at every viewport; mobile hamburger navigation (desktop/tablet normal nav + hamburger hidden; mobile hamburger ≥44px + nav hidden by default + requester identity visible; keyboard activation; menu exposes My Tickets/Create Ticket; menu closes after navigation); 82 curated screenshots (26 state directories × 3 viewports + 4 E2E workflow shots) across Requester Selection, Create Ticket, My Tickets, Ticket Detail. The `attachment-unavailable` screenshot now genuinely depicts the unavailable state (Preview request forced to `500`, Unavailable badge asserted, Preview/Download disabled, no Retry for serving failure).
- **Result**: **PASS**