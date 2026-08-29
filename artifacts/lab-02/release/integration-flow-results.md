# Lab 2 Release Verification — Integration Flow Results

**Issue:** #18 — Lab 2 Final Integration and Release Verification
**Date:** 2026-08-29
**Command:** `npx playwright test e2e/lab-02` (desktop/tablet/mobile)
**Result:** 114 passed, 0 failed

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
- **Flow**: requester selection focus → Continue → Create Ticket navigation → form focus rings → Change Requester → removal-dialog focus trap (focus enters, Tab stays inside, Escape closes, focus restores).
- **Result**: **PASS**

## E2E-06 / VISUAL-01 — Responsive layout and visual evidence

- **File**: `e2e/lab-02/responsive-visual.spec.ts`
- **Flow**: no horizontal scroll at desktop/tablet/mobile for My Tickets, Create Ticket, Requester Selection; 84 curated screenshots across Requester Selection, Create Ticket, My Tickets, Ticket Detail at all three viewports.
- **Result**: **PASS**