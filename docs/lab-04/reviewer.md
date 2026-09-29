# Lab 4 — Human Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha

## Issue #50 contract review

**Human review status:** Changes Requested. Re-review remains pending; no approval is recorded.

| Review | Reviewer | Verdict | Evidence |
|---|---|---|---|
| Issue #50 Lab 4 contract | @oangsa | Changes Requested | [PR #58 review #5341087376](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5341087376) |

### Response to PR #58 review

| Review request | Contract response |
|---|---|
| Define formal status-history read contract | Added Staff/Admin-only paginated history with requester 403, unauthenticated 401, missing-Ticket 404, page-size bounds, and stable `(changedAt, id)` ascending order; each successful status change creates one immutable entry. |
| Clarify Ticket owner and status authority | Require a non-null Ticket owner before status change, while allowing any authorized Staff/Admin actor; actor need not be the owner. |
| Cover shared Ticket mutation concurrency | Added optional `expectedVersion` to owner, priority, and status mutations; atomic shared version compare/increment, malformed/stale handling, increment exactly once per successful write, and UI refresh before retry. |
| Make Action idempotency deterministic and durable | Specified normalization order and defaults, SHA-256 over normalized ordered JSON, actor/concrete-route/key uniqueness, atomic original-response persistence for 24 hours, replay/conflict behavior, failure handling, concurrency, and expiration. |
| Cover Action detail and canonical identifier | Added an explicit planned Action detail API test and standardized the example Ticket number as `TKT-2026-000001`. |
| Make performance validation reproducible | Replaced open-ended threshold with 1,000 Tickets/3,000 Actions, five warmups, twenty serial samples, nearest-rank p95 under 1,000 ms per role, 65,536-byte response cap, and environment recording. |

The six response summaries record contract edits only. The reviewer's requested re-review is still
pending. The supplied Lab 4 handout is treated as the governing source; this record does not claim
independent handout verification or human approval.

The specification, API contract, UI contract, and planned test matrix require human re-review
before dependent Lab 4 implementation work begins. Automated agent review, if later performed,
does not substitute for human approval.
