# Lab 2 Release Verification — Acceptance Matrix

**Issue:** #18 — Lab 2 Final Integration and Release Verification
**Date:** 2026-08-30
**Verification baseline (PR #30 head):** `8cdebe824272cf101570bb78772379a9090b497f`

Requirement-by-requirement mapping: Requirement → Implementation → Test → Execution → Evidence → Result.

| Requirement | Implementation | Test | Execution | Evidence | Result |
|---|---|---|---|---|---|
| R-01 Dependency gate #13/#14/#15 | Already merged | Server + client suites | `cd server && npm test`, `cd client && npm test` | 335 server + 100 client tests pass | **PASS** |
| R-02 Requester selection | `RequesterSelection` + `requester-context` | `UI-REQ-01..07`, `API-REQ-01..03`, E2E-01/02/05 | server + client + E2E | tests.md rows Passed | **PASS** |
| R-03 Create → My Tickets round trip | `CreateTicket` + `MyTickets` | E2E-01 | `npx playwright test e2e/lab-02` | `e2e-01-ticket-created.png` | **PASS** |
| R-04 Ownership isolation | `requireDevRequesterContext` + ownership checks | E2E-02, `API-TKT-03`, `API-MY-01`, `API-ATT-OWN-*` | E2E + server | `e2e-02-ownership-isolation.png` | **PASS** |
| R-05 Attachment lifecycle | `AttachmentSection` + attachment endpoints | E2E-03, `API-ATT-*`, `UI-ATT-*` | E2E + server + client | `e2e-03-attachment-lifecycle.png` | **PASS** |
| R-06 Partial success / BR-17 | Case B orchestration | E2E-04, `UI-TKT-06`, `UI-ATT-05/06` | E2E + client | `e2e-04-partial-success.png` | **PASS** |
| R-07 Keyboard accessibility | Focus management + focus rings + keyboard-operable requester dropdown | E2E-05, `UI-ATT-07` | E2E + client | keyboard-access.spec.ts (mandatory flow uses Tab/Shift+Tab/Enter/Space/ArrowDown/ArrowUp; Continue disabled until selection) | **PASS** |
| R-08 Responsive UI | Zen Green responsive CSS + mobile hamburger navigation | E2E-06, VISUAL-01 | E2E | 82 screenshots + table→card + 44px touch targets + Ticket Detail + no horizontal scroll + no clipped labels/overlap + mobile hamburger | **PASS** |
| R-09 #13 regression | Create Ticket | server + client suites | `npm test` both | 335 + 100 pass | **PASS** |
| R-10 #14 regression | My Tickets | server + client suites | `npm test` both | 335 + 100 pass | **PASS** |
| R-11 #15 regression | Attachments / Detail | server + client suites | `npm test` both | 335 + 100 pass | **PASS** |
| R-12 API/security verification | api-spec contract | `API-CONTRACT-01`, `API-ATT-*`, `API-TKT-*` | server suite | 335 pass | **PASS** |
| R-13 `tests.md` truthful results | — | — | — | E2E-01..06 + VISUAL-01 → Passed | **PASS** |
| R-14 Release evidence package | — | — | — | `artifacts/lab-02/release/` | **PASS** |
| R-15 `reviewer.md` | — | — | — | `docs/lab-02/reviewer.md` (PR #30 human review **pending**) | **PENDING** |
| R-16 Kanban verification | — | — | — | `kanban-verification.md` | **PASS** |
| R-17 Clean checkout | — | — | — | `clean-checkout-results.md` | **PASS** |
| R-18 Final gate | — | — | — | `final-gate.md` | **PASS** |

## Definition of Done Check

- E2E-01 proves Create → Find: **Yes**
- E2E-02 proves both-direction ownership isolation: **Yes**
- E2E-02 includes direct API ownership verification: **Yes**
- E2E-03 proves complete attachment lifecycle: **Yes**
- E2E-04 actually forces attachment failure: **Yes**
- E2E-04 proves retry without duplicate ticket: **Yes**
- E2E-05 passes: **Yes** (mandatory flow uses Tab/Shift+Tab/Enter/Space/ArrowDown/ArrowUp on the native dropdown; Continue disabled until selection)
- E2E-06 passes: **Yes** (full Issue #18 §19: Ticket Detail, table→card, 44px touch targets, required controls, no horizontal scroll, no clipped labels/overlap, mobile hamburger navigation)
- Server suite passes: **Yes (335)**
- Client suite passes: **Yes (100)**
- Build/type checks pass: **Yes**
- #13/#14/#15 regression passes: **Yes**
- No required test skipped / no `.only()` / no `.skip()` to manufacture green: **Yes**
- Screenshot evidence complete (26 states × 3 viewports + 4 E2E workflow shots): **Yes (82)**
- `attachment-unavailable` screenshot depicts the real unavailable state: **Yes** (Preview forced to 500, Unavailable badge asserted, Preview/Download disabled, no Retry for serving failure)
- Release evidence package exists: **Yes**
- `tests.md` matches actual execution: **Yes**
- `reviewer.md` exists and is truthful: **Yes** (PR #30 human review pending — no approval invented)
- README accurate: **Yes**
- Clean checkout succeeds: **Yes**
- `git diff --check` passes: **Yes**
- No merge-conflict markers: **Yes**
- No temporary Playwright artifacts committed: **Yes**

## Production Change in This PR

PR #30 makes deliberate production changes, driven by Issue #18 verification requirements:

- **Requester selector → native dropdown with Arrow-key keyboard flow** (`client/src/App.tsx`). The requester control is the specification-required native `<select>` (id `requester-select`), loaded from `GET /api/dev-requesters`, showing only active requesters, with a disabled placeholder so Continue is disabled until a selection is made (ui-spec §5.2). Issue #18 §24 was amended to permit `ArrowDown`/`ArrowUp` — the only keyboard mechanism that can operate a native dropdown to a non-default option. The mandatory E2E-05 flow uses `Tab`/`Shift+Tab`/`Enter`/`Space`/`ArrowDown`/`ArrowUp` (no mouse, no `selectOption()`).
- **Mobile hamburger navigation** (`client/src/App.tsx` + `App.css`). Desktop/tablet show the normal primary navigation with the hamburger hidden; mobile (<768px) shows a ≥44px hamburger with the primary nav hidden by default, the requester identity remains visible, and the menu closes after navigation.
- **Authoritative Zen Green CSS tokens** (`client/src/App.css`). The alias-only tokens were replaced with the authoritative `--color-*` tokens from ui-spec §1, and every usage was migrated. UI-STYLE-01 now asserts the actual token values.

These are verification-driven fixes scoped to the requester-selection control, the mobile shell, and the CSS token layer; no API, data, or other UI behavior changed. Covered by the updated `RequesterSelection` component tests, E2E-05, E2E-06, and UI-STYLE-01.

These are the only production changes in the PR; everything else is verification-layer repair and release evidence.