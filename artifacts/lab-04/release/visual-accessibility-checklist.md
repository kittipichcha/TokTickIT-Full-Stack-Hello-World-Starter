# Issue #55 — visual and accessibility checklist

Reviewed 2026-10-08. Detailed actual image observations and the reproduced overflow/fix are recorded in `visual-review.md`. Geometry assertions alone are not visual inspection.

| Check | Evidence / current boundary |
|---|---|
| Desktop, tablet and mobile bounded Action/history states | Affected canonical browser run passed 45/45 across all three projects. Terminal View, inactive-assignee conflict/review, long saved Action, confirmation and history empty/page/error states use real journeys with bounded presentation injections only where noted. |
| All three confirmation consequences | The component contract exercises Resolved, Closed and Cancelled target-specific copy, dismissal without mutation and exact Confirm payload. Canonical keyboard browser tests additionally check trap, Escape, Cancel and returned focus; the complete fresh browser run passed 294/294 with zero failures, skips or flakes. |
| Metrics, Action links and mobile navigation | Canonical keyboard/dashboard and role hardening journeys verify reachable controls and active navigation. The complete three-project browser report passed 294/294; this establishes the configured contract, not universal accessibility certification. |
| Actual image inspection | The ledger lists 17 opened images across all three viewports, including corrected long-success text, terminal View, conflict review and history. It records modal capture limitations and separates injected error presentation from real backend behavior. It does not claim every image was viewed. |
| Confirmed overflow repair | A real long saved description escaped the success snapshot although the Action card already wrapped. One scoped `overflow-wrap: anywhere` rule corrected that snapshot; corrected desktop/tablet/mobile images and the 45/45 rerun substantiate the repair. |
| Final release image provenance | Complete browser run passed 294/294. All 105 copied PNG hashes match canonical files and the inventory. Nine final viewport-only confirmation images (three targets × three widths) were opened and showed readable, unclipped dialogs; the earlier full-page capture limitation is resolved. |

No universal accessibility or flawless-layout claim is made. Completed browser results and copied-image provenance are recorded in `staging/playwright.json`, `staging/playwright.txt` and `staging/screenshot-inventory.json`. Final human/main release review remains separate.
