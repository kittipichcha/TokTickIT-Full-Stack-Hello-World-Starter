# Lab 4 release gates

Issue #55 prepares a reviewed staging package. Staging evidence does not certify main, peer approval, board completion, or course submission.

| Gate | State | Required evidence |
| --- | --- | --- |
| T1 source/environment and 41-row/27-AC inventory | Passed | environment, source fingerprints, acceptance matrix |
| T2 canonical hardening and all primary role journeys | Passed | complete browser output plus five README procedures |
| T3 complete server/client/build/Prisma/real-DB/performance gates | Passed | final runner JSON and logs; zero required skips |
| T4 three-viewport browser/keyboard/visual verification | Passed | all configured projects, actual inspected screenshots |
| T5 setup/seed/migration/tests/demo rehearsals | Passed | five separate procedure results; paired DB/files recovery tests |
| T6 contract/Test DD/docs/human-history/AI reconciliation | Passed | alignment review and factual provenance |
| Independent agent review and fix loop | Passed | Source, canonical assertions, image provenance and final 681/366/294 aggregate independently reviewed; no blocking finding. See documentation-review.md and documentation-audit.md |
| Feature PR to lab4-staging | Pending | authorized PR with raw evidence links |
| Human peer review of #55/final release | Pending | actual submitted review on exact head |
| Staging → main merge and fresh main verification | Pending | separately authorized merge; actual main SHA and complete new runs |
| Project board completion | Pending | actual authorized board state |
| Exactly one final nine-part PDF and portal submission | Pending | verified main, authentic reflection, actual review/board and readable final PDF |

Handout coverage: §4.1–4.6 → Actions/workflow/dashboard AC-01–18/23–27; §5.1–5.3 → design decisions, eight retained migrations, DB-MIG-01–04/DB-SEED-01 and AC-19/24; §6–8.6 → full API/security/concurrency/UI/hardening/three-viewport regression; §9–10 → four frozen contracts and 41-row Test DD; §11–13 → staged workflow, screenshot/evidence package and product DoD; §14.1–9 → pending final main/board/human-review and exactly nine Answer parts. No final submission certification is inferred from staging.

## Handout clause inventory

| Clause ID | Source | Acceptance obligation | Canonical task / evidence | Staging state |
| --- | --- | --- | --- | --- |
| H4-4.1a–g | Handout §4.1 | Action fields; transition matrix; dashboard rules; DB/API; Zen Green/accessibility; security/concurrency/regression; AC/Test DD/DoD | All 27 rows in acceptance-matrix.md; T1–T6 | Passed for staging product scope |
| H4-4.2 | §4.2 | Preserve explicit exclusions | Scope audit T1/T6 | Passed for staging product scope |
| H4-4.3 | §4.3 | Staff/Admin write; Requester owned read; backend authorization | AC-07/08/18, T3 | Passed for staging product scope |
| H4-4.4 | §4.4 | Parent Ticket and independent owner/performer | AC-01/03/04/07, T3 | Passed for staging product scope |
| H4-4.5a–d | §4.5 | Eight statuses; approved transitions; direct API resolution gate; advisory requester flag | AC-10–14/23/25–27, T3 | Passed for staging product scope |
| H4-4.6a–d | §4.6 | Requester/Staff metrics, optional Admin reuse, authoritative calculations and practical destinations | AC-15–18/24, T3/T4 | Passed for staging product scope |
| H4-5.1a–c | §5.1 | Parent/child and prior data continuity; schema/index/concurrency decisions; at least two documented design justifications | AC-19/23/27 and spec §7; T1/T3/T6 | Passed for staging product scope |
| H4-5.2a–c | §5.2 | Preserve legacy data; define zero-Action and old dashboard behavior; document/test migration and recovery | AC-10/19/24; T3/T5 | Passed for staging product scope |
| H4-5.3a–d | §5.3 | Repeatable seed; varied Ticket/priority/ownership; zero/one/many Actions; zero/nonzero metrics | DB-SEED-01; T3/T5 | Passed for staging product scope |
| H4-6/6.1/6.2 | §6 | Exact API, old API continuity, stale handling, bounded metrics and cutoff/empty/drill-down semantics | All API/SEC/CONC/PERF rows; T3 | Passed for staging product scope |
| H4-7a–g | §7 | Role navigation/active state; reused tokens/components; status/privacy cues; accessible metrics; keyboard/focus/labels; no clipping/overlap/overflow; obsolete UI removal | AC-20/21/22; T2/T4 | Passed for staging product scope |
| H4-8.1/8.2/8.3/8.4 | §8 | Staff dashboard, owned Requester dashboard, complete Actions UI, permitted workflow/refresh | AC-01–18/25–27; T3/T4 | Passed for staging product scope |
| H4-8.5a–g | §8.5 | Prior screens; old roles/ownership/comments/notes/attachments/admin/auth; complete state feedback; safe duplicate retries; retained forms; no console/broken/unfinished UI; current README | AC-20–22; HARDEN-01 plus existing rows; T2–T6 | Passed for staging product scope |
| H4-8.6 | §8.6 | Desktop/tablet/mobile and prior-lab accessibility continuity | VISUAL-01/A11Y-01/REG-01; T4 | Passed for staging product scope |
| H4-9.1–11 | §9 | Eleven specification sections and meaningful locked decisions | T1/T6 document audit; no new product decisions | Passed for staging product scope |
| H4-10a–c | §10 | Test DD created before/with code; all required test layers; meaningful expected result/path/status traceability | T1/T3/T6 | Passed for staging product scope |
| H4-11/12/13 | §§11–13 | Staged workflow, minimum paths, screenshots, product DoD | T1/T4/T7 | Staging product evidence Passed; T7 main/release Pending |
| H4-14.1–9 | §14 | Exactly one PDF; exact Answer Part 1–9 order; working links/readable screenshots; final main source and passing output | T7/T8; final nine-part PDF obligation | Pending actual main/release/submission events |

Current staging proof: 681 backend tests/47 files, 366 component tests/23 files, 294 browser cases/18 files/three projects; all exits 0 and zero failed or required skipped cases. All five README procedures and the 27 product AC/41 Test DD rows pass. All 182 executable hashes match; 105 screenshot hashes and actual image inspections are recorded separately. Human/main/board/PDF gates above remain Pending.
