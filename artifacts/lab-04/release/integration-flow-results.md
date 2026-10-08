# Issue #55 — integrated flow evidence

These staging flows use the existing real UI, authenticated sessions and disposable PostgreSQL
fixtures. Injected visual responses are labelled separately and do not replace persistence proof.
The full configured browser and fresh backend reports pass. This is staging product evidence; final release gates remain separate.

| Flow / AC | Canonical proof | Current evidence |
| --- | --- | --- |
| Requester creates an owned Ticket and reads Actions; independent owner/performer/assignee; AC-01–08 | `actions-taken-flow.spec.ts`, `release-hardening.spec.ts`; Actions API/security suites | Full browser and fresh backend pass; canonical API/security assertions verified |
| Two Pending Actions on the same Ticket; inactive-assignee 409 retains draft; A completes with Result, B cancels without Result; Pending blocks resolution until both clear; AC-03/06/11/23/25 | `ticket-resolution.spec.ts`; Action/workflow API and barrier-controlled race suites | Real browser journey passes all three projects; fresh backend barrier-controlled race contracts pass |
| Owned Requester sees performer/assignee names, terminal read-only records and no write/history/Internal Note controls; AC-07/18 | Existing Actions/workflow journeys and ownership/role API tests | Full browser and fresh backend privacy/ownership contracts pass |
| Shared owner/priority/status version, formal transition matrix, immutable history and current paging/focus; AC-12–14/26/27 | Workflow API/unit/component suites; keyboard confirmations and history journey | 366-case final component, 294-case full browser and 681-case fresh backend runs pass |
| Requester/Staff/Admin authoritative seven-day metrics, exact filtered Ticket and selected-Action destinations; AC-15–18/24 | `dashboards.spec.ts`, canonical requester/staff dashboard API tests and PERF-01 | Complete browser and fresh backend/performance contracts pass; responsive injected states prove presentation only |
| Prior comments/notes/attachments/auth/admin and all primary role navigation; AC-20–22 | Complete Lab 2/3 browser suites plus new HARDEN-01; old server/client discovery | Complete 294-case browser regression passes; HARDEN-01 final gate also requires all five README procedure rows |
| Legacy migration continuity, snapshots/recovery and repeat seed; AC-10/19/24 | DB-MIG-01–04, DB-SEED-01 | Fresh backend migration/recovery and repeat-seed contracts pass; five procedure evidence linked separately |

Raw affected evidence: `staging/browser-affected.json` and `.txt` — 45 passed, zero
failed/skipped/flaky, exit 0 at 1280×800, 820×1180 and 390×844. Component evidence:
`client-results.json`, `client-test.log` and `backend-component-verification.md`.
Final reports are `staging/playwright.json`/`.txt` and `server-final-results.json`/`server-final-test.log`.
The final browser run started 2026-10-08T02:00:20.519Z and completed with 294 passed,
zero failed/skipped/flaky, exit 0 in 1,916,091.506 ms. Its manifest and 105 copied,
hashed Lab 4 images are under `staging/`; actual image inspection remains separate.

Terminal Action View, current assignee conflict/repair, history zero/page/error/retry and all
three consequence dialogs have current screenshots. The actual image inspection ledger and
visual/accessibility checklist distinguish visual evidence from API/DB guarantees.

No flow claims main verification, human approval, board completion or submission.

Final fresh backend: 681 passed, zero failed/skipped, 47 files, exit 0, 1,444.72 s; runner manifest records 2026-10-08T02:21:49.3409638Z–02:45:57.1996280Z.
