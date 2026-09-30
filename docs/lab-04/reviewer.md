# Lab 4 — Human Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha
**Peer reviewer:** SUTHANG SUKRUEANGKUN — 67070503477 — GitHub: @oangsa

## Issue #50 contract review

**Human review status:** Changes Requested. Re-review remains pending; no approval is recorded.

| Review | Reviewer | Verdict | Evidence |
|---|---|---|---|
| Issue #50 Lab 4 contract | @oangsa | Changes Requested | [PR #58 review #5341087376](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5341087376) |
| Issue #50 Lab 4 contract re-review | @oangsa | Changes Requested | [PR #58 review #5352441580](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5352441580) |
| Issue #50 Lab 4 contract re-review | @oangsa | Changes Requested | [PR #58 review #5361703082](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5361703082) |

### Response to PR #58 review

| Review request | Contract response |
|---|---|
| Define formal status-history read contract | Added Staff/Admin-only paginated history with requester 403, unauthenticated 401, missing-Ticket 404, page-size bounds, and stable `(changedAt, id)` ascending order; each successful status change creates one immutable entry. |
| Clarify Ticket owner and status authority | Require a non-null Ticket owner before status change, while allowing any authorized Staff/Admin actor; actor need not be the owner. |
| Cover shared Ticket mutation concurrency | Added optional `expectedVersion` to owner, priority, and status mutations; atomic shared version compare/increment, malformed/stale handling, increment exactly once per successful write, and UI refresh before retry. |
| Make Action idempotency deterministic and durable | Specified normalization order and defaults, SHA-256 over normalized ordered JSON, actor/concrete-route/key uniqueness, atomic original-response persistence for 24 hours, replay/conflict behavior, failure handling, concurrency, and expiration. |
| Cover Action detail and canonical identifier | Added an explicit planned Action detail API test and standardized the example Ticket number as `TKT-2026-000001`. |
| Make performance validation reproducible | Replaced open-ended threshold with 1,000 Tickets/3,000 Actions, five warmups, twenty serial samples, nearest-rank p95 under 1,000 ms per role, 65,536-byte response cap, and environment recording. |

### Response to PR #58 review #5352441580

| Review request | Contract response |
|---|---|
| Freeze role navigation, dashboard mappings, and Action destinations | Added role-specific navigation/active states, exact status and priority filters, and separate metric filters from per-Action destinations. |
| Cover Action cancellation and inactive-assignee rejection | Expanded planned UI and E2E assertions for multiple Actions, completion, cancellation, rejection, blocked resolution, and successful resolution. |
| Complete status-history access and hardening coverage | Added history authorization, ordering, UI evidence, and planned `HARDEN-01` for README procedures, console errors, navigation, dead controls, and placeholders. |
| Freeze model indexes and ownership | Specified required indexes/constraints and Lab 4 issue ownership; kept all planned tests `Planned`. |
| Correct PR verification wording | Prepared local replacement wording that says human re-review remains pending; it has not been published to the PR body. |

### Response to PR #58 review #5361703082

| Review request | Contract response |
|---|---|
| Resolve same-value status contradiction | BR-30, API §7, AC-27, and `API-WF-04` now allow accepted same-value owner/priority writes but reject same-status requests with `409` and no mutation/version increment. |
| Define Actions Taken pagination | UI contract and `UI-ACT-01` now specify page size, maximum, controls, all-page access, and post-mutation refresh behavior. |
| Make expired-key behavior deterministic | `API-ACT-02` now requires an atomic fresh Action and fresh `201` after expiry, even before cleanup. |
| Record human reviews and correct PR wording | This record lists all three reviews with reviewer, verdict, and links. The local PR-body replacement below remains unpublished. |
| Update test ownership | Lab 4 #4 owns workflow API/concurrency/unit/UI rows; #6 owns hardening and final evidence/status work. |

The first review requested status-history contract/evidence, actor-versus-owner clarification,
shared concurrency protection, durable canonical idempotency, Action detail coverage, reproducible
performance criteria, and Lab 4-only evidence routing. The later review responses above record the
contract changes. All three human reviews remain Changes Requested; no human approval is recorded.
The supplied Lab 4 handout remains the governing source; this record does not claim independent
handout verification.

Proposed local PR-body replacement (not published):

> Documentation-only contract revision responding to the three recorded human reviews. Local automated review does not constitute human approval. Human re-review remains pending, and all Lab 4 executable tests remain Planned; none were run for this documentation change.

The specification, API contract, UI contract, and planned test matrix require human re-review
before dependent Lab 4 implementation work begins. Automated agent review, if later performed,
does not substitute for human approval.
