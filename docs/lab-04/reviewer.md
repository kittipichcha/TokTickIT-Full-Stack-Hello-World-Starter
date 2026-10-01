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
| Issue #50 Lab 4 contract re-review | @oangsa | Changes Requested | [PR #58 review #5374244874](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5374244874) |
| Issue #50 Lab 4 contract re-review | @oangsa | Changes Requested | [PR #58 review #5374801503](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5374801503) |

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
| Correct PR verification wording | The live PR body now states that human review remains pending and no runtime implementation is included. |

### Response to PR #58 review #5361703082

| Review request | Contract response |
|---|---|
| Resolve same-value status contradiction | BR-30, API §7, AC-27, and `API-WF-04` now allow accepted same-value owner/priority writes but reject same-status requests with `409` and no mutation/version increment. |
| Define Actions Taken pagination | UI contract and `UI-ACT-01` now specify page size, maximum, controls, all-page access, and post-mutation refresh behavior. |
| Make expired-key behavior deterministic | `API-ACT-02` now requires an atomic fresh Action and fresh `201` after expiry, even before cleanup. |
| Record human reviews and correct PR wording | The live PR body states that human review remains pending and no runtime implementation is included; this record now tracks each submitted review and verdict. |
| Update test ownership | Lab 4 #4 owns workflow API/concurrency/unit/UI rows; #6 owns hardening and final evidence/status work. |

### Response to PR #58 review #5374244874

| Review request | Contract response |
|---|---|
| Freeze exact owner/priority/status version API shapes | `api-spec.md` §§7–8 define `expectedVersion` in the JSON request body and freeze the exact success response fields; `API-WF-04` asserts each request/response shape and Lab 3 omission compatibility. |
| Add security and validation coverage to Test DD | Planned tests cover CSRF rejection, idempotency-key validation, Action text limits and pagination, dashboard/Queue filter validation, and exact workflow response shapes. |
| Specify status-history UI pagination | `ui-spec.md` §4 and `UI-WF-HISTORY-01` define fixed page size 10, Previous/Next boundary behavior, `Page X of Y`, zero/one-page behavior, and reachability across all pages. |
| Align Action wording | FR-02 identifies initial status as server-set `PENDING`; BR-25 requires the `Idempotency-Key` header. |
### Response to PR #58 review #5374801503

| Review request | Contract response |
|---|---|
| Reconcile Action-read authorization wording | The global API rule and Action list/detail routes now agree: authenticated IT Staff/Administrators read accessible Tickets, Requesters read only owned Tickets, and unauthenticated callers are rejected. The authorization matrix and planned security rows state the same backend behavior. |
| Clarify global integer syntax | The global rule requires decimal integer syntax and delegates positive/range constraints to each endpoint; Action IDs, assignee IDs, versions, paging, and limits retain their endpoint-specific validation. |
| Reconcile live PR evidence | The repository record does not claim unpublished PR-body changes or human approval; the live PR body now states the intentional `agent.md` workflow scope, `Refs #50`, documentation-only scope, and pending human review. |

The first review requested status-history contract/evidence, actor-versus-owner clarification,
shared concurrency protection, durable canonical idempotency, Action detail coverage, reproducible
performance criteria, and Lab 4-only evidence routing. The later review responses above record the
contract changes. All five submitted human reviews remain Changes Requested; no human approval is recorded.
The supplied Lab 4 handout remains the governing source; this record does not claim independent
handout verification.

The live PR body now states that human review remains pending and that no runtime implementation
is included. The `agent.md` workflow inclusion remains a scope exception awaiting explicit peer-review
acceptance. The separate cross-layer consistency sweep is agent/process work recorded in `ai-use.md`,
not human-review feedback. No approval is recorded.

The specification, API contract, UI contract, and planned test matrix require human re-review
before dependent Lab 4 implementation work begins. Automated agent review, if later performed,
does not substitute for human approval.
