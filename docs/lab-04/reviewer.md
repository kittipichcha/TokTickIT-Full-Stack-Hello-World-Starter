# Lab 4 — Human Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha
**Peer reviewer:** SUTHANG SUKRUEANGKUN — 67070503477 — GitHub: @oangsa

## Submitted review provenance (refreshed 2026-10-07, Asia/Bangkok)

The submitted GitHub reviews for PR #58–62 were read again during issue #55.
Approval applies to each review's `commit_id`, not automatically to later fixes or merges.
Earlier Changes Requested events and responses below remain historical records.

| PR | Human review by @oangsa | Submitted (UTC) | Exact reviewed SHA |
|---|---|---|---|
| #58 | [Approved #5377076542](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5377076542) | 2026-10-01 08:53:59 | `f6a3538d9a5c5838259302a7c6619616e8e69d14` |
| #59 | [Approved #5392719697](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59#pullrequestreview-5392719697) | 2026-10-02 14:02:37 | `debea489a9e8936ac9fc9de5ab8de5311ac5ff16` |
| #60 | [Approved #5407162076](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5407162076) | 2026-10-04 16:29:29 | `210cd6835de428e4c6ea6900ef69ae457f65ab43` |
| #61 | [Approved with follow-up #5427279665](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/61#pullrequestreview-5427279665) | 2026-10-06 10:53:09 | `04223e069f956c746c14fad769d5ebe7e55b93a0` |
| #62 | [Approved with follow-up #5443358420](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62#pullrequestreview-5443358420) | 2026-10-07 13:53:31 | `f83f51f45904daec56a871b41bd690b2536a3b9e` |

Issue #55 and the final staging-to-main release require their own submitted human review.
Those gates remain pending; agent review is recorded only in `ai-use.md`.

## Issue #50 contract review

**GitHub review status:** PR #58 received final human approval and was merged into `lab4-staging`. The historical review table below preserves the five earlier Changes Requested events.

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
contract changes. Those five earlier GitHub reviews remain recorded as Changes Requested; the later final approval and merge are recorded above.
The supplied Lab 4 handout remains the governing source; this record does not claim independent
handout verification.

The `agent.md` workflow inclusion is a scope exception to the normal governance-isolation rule; the
peer reviewer accepted that exception in direct off-platform discussion with the author on
2026-10-01. This scope acceptance is separate from the later formal GitHub PR approval and merge.

The separate cross-layer consistency sweep is agent/process work recorded in `ai-use.md`, not
human-review feedback.

The specification, API contract, UI contract, and planned test matrix require human re-review
before dependent Lab 4 implementation work begins. That gate was satisfied when PR #58 received
final human approval and merged; automated agent review does not substitute for human approval.

## Issue #52 / PR #60 review record

**GitHub review status:** PR #60 initially received Changes Requested from @oangsa,
then received the submitted `LGTM!` approval #5407162076 on 2026-10-04 at
`210cd6835de428e4c6ea6900ef69ae457f65ab43`. The following table describes the initial
review and its response, rather than the current approval state.

| Field | Value |
|---|---|
| PR | [#60](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60) |
| Reviewer | `@oangsa` |
| Verdict | `Changes Requested` |
| Review | [#5400567676](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5400567676) |
| Reviewed head | `31c77b076843d102f61d5925b0cc73591041eef1` |
| Fixes applied at | `1bdaf8b` (implementation) + `66414ee` (evidence/docs) |
| State | Fixes applied; later approval is recorded in the provenance table above |

### Response to PR #60 review #5400567676

| Requested change | Implemented fix at `1bdaf8b` |
|---|---|
| Successful Action edits have no success state or accessible success announcement (Major) | **Section-owned edit success**: `ActionForm.onSaved(saved, "create" \| "edit")` reports the committed server response; the form-local success notice was removed; `StaffActionsTaken` renders one section-level `role="status"` `.success-box` that survives the edit form closing. |
| Create + refresh failure does not keep the committed Action value visible (Major) | **Committed snapshot surviving refresh failure**: `handleSaved()` records the committed snapshot from the POST/PATCH response *before* the follow-up refresh, so a newly created Action stays represented when the GET fails; Retry re-reads only and never replays POST/PATCH. |
| Performer / assignee / Ticket-owner three-way distinction not verified (Major evidence gap) | **Three-way owner/performer/assignee E2E**: the primary Actions E2E assigns the Ticket to `USERS.admin` (owner), creates the Action as `USERS.staff` (performer), assigns it to `USERS.adminPeer` (assignee), and asserts all three fixtures pairwise distinct plus the persisted owner ID. |
| Ad-hoc warning colors violate the styling token contract (styling-contract violation) | **Approved-token replacement**: all three Issue #52 `#fff8e6` literals (`.action-reopen-guidance`, `.conflict-box`, `.action-status-pending`) replaced with `var(--color-field-readonly-bg)`; zero newly added raw hex colors remain in the Issue #52 CSS block. |

All four requested changes are implemented and verified on tested implementation SHA `1bdaf8b`
(client `UI-ACT-01` 52 passed / full client 19 files 304 passed; server 633 passed; Actions E2E
9 passed; responsive+keyboard 15 passed; affected Lab 3 regression 2 passed). Those are
historical implementation results. The later human approval applies to its exact reviewed
head in the provenance table, without replacing the initial Changes Requested event.

## Issue #51 / PR #59 review record

@oangsa submitted [Changes Requested #5387674883](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59#pullrequestreview-5387674883)
on 2026-10-02 at `edd9e22c61c7375ca6cc460d6ee8a88bb3e9b35d`.
The review requested unexpired idempotency replay before terminal-Ticket validation,
zero/one/many Action seed distribution, exact expiry/concurrent/failure/cleanup assertions,
PATCH CSRF no-mutation checks, and truthful complete-row Test DD statuses.

How I responded: the submitted approval #5392719697 confirms the replay ordering and
terminal retry regression, per-Ticket seed distribution, expiry/concurrency/cleanup and
authorization coverage. It cites tested implementation `3997f4e036a9265ed4c01d6264fee97d4d43a414`
and a subsequent documentation-only reviewed head. Non-blocking notes reserve explicit
seven-day boundary fixtures for dashboards and keep shared downstream test clauses
separate from the Actions foundation. Final integrated proof belongs to issue #55;
approval of the foundation alone does not certify later workflow/dashboard clauses.

## Issue #53 / PR #61 review record

@oangsa approved the exact head in the provenance table with one non-blocking note:
Resolved, Closed and Cancelled confirmation dialogs should state the target's consequence.
How I responded: subsequent source includes all three target-specific paragraphs in
`client/src/StaffTicketDetail.tsx`. Issue #55 verifies those existing paragraphs with
canonical workflow/keyboard checks. The approval predates the later `2511310` change;
this record does not claim human approval of that later source.

## Issue #54 / PR #62 review record

**GitHub review status:** `@oangsa` approved PR #62 at
`f83f51f45904daec56a871b41bd690b2536a3b9e` with a non-blocking follow-up note.
This records the submitted human review of that head; it does not imply review of later commits.

| PR | Branch | Reviewer verdict | Evidence |
|---|---|---|---|
| [#62](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62) | `feature/lab4-role-dashboards` | Approved with follow-up note | [Review #5443358420 by @oangsa](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62#pullrequestreview-5443358420) |

**Issue #54**

Reviewer comment I received: zero-value dashboard metric cards correctly show `0`, but the
frozen UI contract also requires concise empty copy. Ticket cards should show
`No matching Tickets`; count-only Action metrics should show `No matching Actions`.
The reviewer explicitly classified this as non-blocking UI-contract completeness feedback.

How I responded: added zero-only guidance to the shared metric component and supplied the
Action-specific wording for both count-only Action cards. Requester, status, priority and
other Ticket cards retain their count and drill-down; Action cards remain noninteractive.
Extended canonical dashboard component and responsive browser assertions for the zero copy,
unchanged nonzero presentation, accessible names and layout. Scope: FR-17/18, BR-20,
AC-17/20/21; UI contract sections 2 and 6. Validation is recorded in the newest
`tests.md` result and the Issue #54 evidence manifest.
