# Lab 3 — Peer Review Record

**Author:** <Kittipich Charoenthanachot> — <67070503405> — GitHub: @kittipichcha
**Peer reviewer:** <SUTHANG SUKRUEANGKUN> — <67070503477> — GitHub: @oangsa

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#44 — Add Sprint 3 engineering contract (Issue #34)](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/44) | `feature/issue-34-sprint-3-contract` | Changes Requested (2026-09-10) |

**Issue #34**
Reviewer comment I received: **Request Changes** — 5 blocking issues before the contract could be considered frozen:
1. Existing Requester initial-password migration behavior was not explicit (no test proving a migrated Requester receives an initial password, can authenticate, and is forced to change it).
2. Concrete database design was not fully frozen (fields, types, FKs, indexes, enums, timestamps, migration strategy).
3. IT Staff Queue query behavior still contained placeholders (`search`/`sort` fields undefined) and conflicted with `tests.md` ("Safe defaults applied").
4. Session expiration was intentionally left undecided (deferred to repository/environment config).
5. Some AC-to-test mappings were not meaningful (e.g. `UI-STYLE-01`/`VISUAL-01`/`A11Y-01` mapped to `AC-20` authorization; `SEED-01` mapped to `AC-16`).

How I responded: Addressed all five blockers in successive commits on `feature/issue-34-sprint-3-contract`:
1. **Initial-password migration frozen** — added §9.2 "Initial-password migration mechanism (frozen)": each migrated Requester receives a deterministic per-user initial password derived from their own email and name, stored only as a bcrypt hash, with `mustChangePassword=true` forcing a change at first login. Added `DB-MIG-03`/`DB-MIG-04` and `AC-26` covering authenticate-with-initial-password and forced change.
2. **Concrete data model contract** — added §9.3 "Data model contract (frozen)" defining the normative `User`, `Comment`, `InternalNote`, Ticket ownership, IT Priority, FK behavior, uniqueness constraints, indexes, timestamps, and migration behavior for Issue #35 to translate into the Prisma schema.
3. **Staff Queue query semantics frozen** — defined the exact `search` fields, allowed filters, allowed sort fields, default ordering, valid page sizes, pagination metadata, and invalid-query behavior (safe defaults applied) in `api-spec.md`, and aligned `tests.md` with that decision.
4. **Session expiration frozen** — documented a **30-minute session idle timeout** as the Lab 3 contract value (specification.md §10 item 9), including what happens on expiration and activity refresh, with corresponding planned tests.
5. **AC-to-test traceability corrected** — added dedicated Acceptance Criteria `AC-21` (Zen Green), `AC-22` (responsive), `AC-23` (accessibility), `AC-24` (seed idempotency), `AC-25` (migration preservation), and `AC-26` (initial-password migration), and remapped each planned test to the AC it actually verifies (`UI-STYLE-01→AC-21`, `VISUAL-01/02→AC-22`, `A11Y-01→AC-23`, `SEED-01→AC-24`, `DB-MIG-01/02→AC-25`, `DB-MIG-03/04→AC-26`).

---

## Pull Requests I reviewed (authored by my partner)
| PR | Branch | My verdict |
|----|--------|------------|
| [#66 — docs: establish Lab 3 engineering contract](https://github.com/oangsa/TokTickIT/pull/66) | `feature/59-lab3-engineering-contract` → `lab3-staging` | Changes Requested, then Approved (2026-09-11) |

**Issue #59**
Reviewer comment I gave: **Request Changes** — I reviewed PR #66 against the actual Lab 3 handout (treated as the upper authority), the PR's four engineering-contract documents, and the updated Issues #59–#65. I found 3 handout-to-contract alignment issues that should be fixed before treating the PR as the final Lab 3 contract:

1. **`ai_use.md` vs required `ai-use.md`** — the handout's required Lab 3 structure and Part 4 both specify `docs/lab-03/ai-use.md` (hyphen), but PR #66 created `docs/lab-03/ai_use.md` (underscore). Required fix: rename the file and update every reference in `specification.md`, `tests.md`, `reviewer.md`, and the issue bodies.
2. **Screenshot evidence root differs from the handout** — the handout prescribes `artifacts/lab-03/screenshots/` (with `authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/` subfolders), but PR #66 made `docs/lab-03/evidence/screenshots/` the normative evidence root. Required fix: use the handout path as canonical, or explicitly retain the handout-required structure rather than silently redefining it.
3. **User Management adds mandatory pagination/sorting** — the handout explicitly excludes "advanced user-list features such as mandatory pagination, multi-column sorting, and multiple simultaneous filters," yet the PR made User-list pagination (default page size 10) and sorting normative. Required fix: keep User Management minimal (search by name/email, optional role filter, simple list) and leave pagination/sorting to the IT Staff Ticket Queue only.

How my partner responded: No code or documentation changes were made in response to my review. My partner communicated directly (outside the PR) that the naming convention is not that strict and that he intends to keep the template as-is. The three issues I raised therefore remain open in the PR as filed.

Final verdict: **Approved** (2026-09-11) — I approved the PR despite the three alignment issues, since my partner indicated the naming convention is not being treated as strict and no changes were required on his side. The three findings above remain recorded for reference but were not blocking for approval.