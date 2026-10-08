# Issue #55 — image inspection ledger

Initial inspection 2026-10-07; continued 2026-10-08, Asia/Bangkok.
This ledger identifies actual images opened by the
documentation/review agent; automated geometry is separate evidence. It is not a claim
that every screenshot or final viewport has already been inspected.

| Image opened (under `artifacts/lab-04/screenshots/`) | Visible state | Observation |
|---|---|---|
| `ticket-workflow/desktop-confirm-resolved.png` | Real Resolved confirmation | Target and consequence are readable; Cancel/Confirm are distinct, and Cancel's focus ring is visible. The original full-page capture includes a fixed-backdrop viewport slice; the capture is being changed to viewport-only for faithful modal presentation. No product defect is inferred from that screenshot artifact. |
| `actions-taken/desktop-edit-long.png` | Real long Action draft with conditional follow-up | Description wraps inside the textarea; labels, note, assignee and status choices remain distinct; Save/Cancel do not overlap. Editing scrolls inside the textarea, which is legitimate input behavior. |
| `admin-dashboard/desktop-forbidden.png` | Injected 403 presentation | Heading, active Dashboard navigation and access-denied message are readable and unclipped; User Management navigation remains present. This image proves presentation only, not backend authorization. |
| `ticket-workflow/tablet-confirm-closed.png` | Real Closed confirmation | Target/consequence remain legible; Cancel/Confirm and the visible focus ring are distinct. Its original full-page fixed-backdrop artifact has the same capture limitation as the desktop dialog. |
| `actions-taken/tablet-edit-long.png` | Real long Action draft | Textarea wraps and the form, conditional note, radios and action buttons remain within the content column without visible overlap. |
| `admin-dashboard/mobile-forbidden.png` | Injected 403 presentation | Role identity, Logout, collapsed mobile navigation, heading and error copy fit the narrow screen; the message wraps within its border. |
| `requester-dashboard/mobile-long.png` | Injected long-text presentation | Zero metric guidance is readable and long unbroken Ticket summary text wraps inside its list card; status/time do not overlap the link. Its injected data is not a count-query assertion. |
| `actions-taken/desktop-completed-view.png` | Real terminal Action View | Read-only status and descriptive fields are distinct; Close is reachable and no edit field is rendered. |
| `actions-taken/mobile-assignee-conflict-draft.png` | Real inactive-assignee 409 | Reopened at original resolution: error and preserved-draft guidance wrap inside the form; the edited Description, Review latest control and vertically arranged status choices remain readable. |
| `workflow/tablet-history-page-1.png` | Real ten-row first history page | Times, transition, actor and version are organized without visible overlap; Previous/Next and Page 1 of 2 remain distinct. |
| `workflow/desktop-history-read-error.png` | Injected read failure over real prior history | Error and Retry are visible while prior rows remain available; the notice does not obscure the retained history. This injection proves read-failure presentation, not rollback. |
| `actions-taken/mobile-staff-actions.png` | Corrected real long saved Action | Viewed at original resolution: the committed success paragraph and Action card both wrap within their borders; status, performer/date and edit control remain visible without horizontal overflow. |
| `workflow/mobile-history-page-2.png` | Real second history page | Transition/actor/version stack readably; focus is visible on Page 2 of 2 and both pagination controls fit the panel. |
| `actions-taken/tablet-assignee-ineligible-review.png` | Real explicit conflict review | Latest saved values, retained draft and ineligible-name guidance remain separate; Save/Cancel do not overlap the conditional guidance. |
| `actions-taken/desktop-staff-actions.png` | Corrected real long saved Action | Long success snapshot and card wrap independently inside their containers, correcting the reproduced failure. |
| `actions-taken/tablet-staff-actions.png` | Corrected real long saved Action | The same success/card text wraps on tablet without running past the content edge. |
| `ticket-workflow/mobile-confirm-cancelled.png` | Real Cancelled confirmation | Consequence wraps without clipping; Cancel's focus ring and Confirm are distinct. This is the earlier full-page capture; final viewport-only capture remains to be reconciled. |

## Reproduced blocker and bounded correction

The failed desktop diagnostic
`test-results/lab-04-responsive-visual-V-7f20a-d-cards-inside-the-viewport-desktop/test-failed-1.png`
was opened separately. It shows an accepted long Action description extending beyond the
right edge of the committed success snapshot while the actual Action card wraps correctly.
The source trace reaches `ActionsTaken.tsx`'s committed-result `.success-box`; its CSS lacked
the wrapping already applied to Action cards and conflict values. The independently reviewed
fix packet adds only `.actions-taken .success-box { overflow-wrap: anywhere; }`.
The existing real edit/save scenario and page/control geometry are the regression proof.
This failed diagnostic is not a passing release image. The subsequent affected browser
run passed 45/45 across all three viewports, exit 0 (`staging/browser-affected.txt` and
`.json`), and the corrected desktop/tablet/mobile `staff-actions` images above were
opened. They show the success snapshot wrapping within its container. The reproduced
blocker is resolved by those assertions and images; the complete configured regression
and final release-copy provenance remain separate gates.

Earlier inspection verdict: no visible blocker in these 17 inspected desktop/tablet/mobile images.
The images cover modal, long draft/saved values, terminal View, conflict/recovery, history,
forbidden and dashboard long-text states. Remaining final-run copies and viewport-only
modal captures require provenance/inspection reconciliation; the completed browser report
must establish the entire configured geometry/focus and regression contract.

## Completed full-run confirmation inspection (2026-10-08)

The complete configured browser run passed 294/294, with zero failed, skipped or flaky
cases, exit 0, in 31.9 minutes. `staging/playwright.json` records start
`2026-10-08T02:00:20.519Z`; `staging/playwright.txt` retains the final output.
All 105 copied release PNGs were independently hash-checked against both their canonical
images and `staging/screenshot-inventory.json`: zero mismatches. The inventory records
run start, canonical/copy paths, viewport and SHA-256. Hash verification is provenance,
not a claim that all 105 images were visually inspected.

Nine final copied images were opened at original resolution under
`staging/screenshots/ticket-workflow/`: desktop, tablet and mobile each with
`confirm-resolved.png`, `confirm-closed.png` and `confirm-cancelled.png`.
All nine show the complete dialog within the configured viewport. The exact target and
its distinct consequence are readable; long mobile copy wraps within the panel; Cancel
and Confirm remain separate and unclipped, with Cancel's focus ring visible. These
viewport-only captures resolve the earlier full-page modal presentation limitation.
The white background beyond a scrolled document's bounded backdrop does not obscure the
dialog or its controls and is not evidence of a new product failure.

The final-run inspection supplements the 17-image historical/diagnostic ledger above;
repeat logical paths refer to newly generated final bytes, not additional unique paths.
No visible blocking defect was found in the nine final confirmation captures. Combined
with the completed full-run geometry/focus assertions, the visual and keyboard browser
requirements are now supported. Backend/full release and human/main/board/PDF gates
remain separate.
