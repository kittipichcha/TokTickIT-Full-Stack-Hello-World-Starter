# Lab 4 — Human Review Record

**Author:** Kittipich Charoenthanachot — 67070503405 — GitHub: @kittipichcha
**Peer reviewer:** SUTHANG SUKRUEANGKUN — 67070503477 — GitHub: @oangsa

## Submitted review provenance (refreshed 2026-10-08, Asia/Bangkok)

The submitted GitHub reviews for PR #58–63 were verified during issue #55.
Approval applies to each review's `commit_id`, not automatically to later fixes or merges.
Earlier Changes Requested events and responses below remain historical records.

| PR | Human review by @oangsa | Submitted (UTC) | Exact reviewed SHA |
|---|---|---|---|
| #58 | [Approved #5377076542](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5377076542) | 2026-10-01 08:53:59 | `f6a3538d9a5c5838259302a7c6619616e8e69d14` |
| #59 | [Approved #5392719697](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59#pullrequestreview-5392719697) | 2026-10-02 14:02:37 | `debea489a9e8936ac9fc9de5ab8de5311ac5ff16` |
| #60 | [Approved #5407162076](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5407162076) | 2026-10-04 16:29:29 | `210cd6835de428e4c6ea6900ef69ae457f65ab43` |
| #61 | [Approved with follow-up #5427279665](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/61#pullrequestreview-5427279665) | 2026-10-06 10:53:09 | `04223e069f956c746c14fad769d5ebe7e55b93a0` |
| #62 | [Approved with follow-up #5443358420](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62#pullrequestreview-5443358420) | 2026-10-07 13:53:31 | `f83f51f45904daec56a871b41bd690b2536a3b9e` |
| #63 | [APPROVED #5458574074](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63#pullrequestreview-5458574074) | 2026-10-08T14:56:58Z | `ad09882afe57439c2d2b94e49a42912e088d7e01` |

Issue #55 received submitted human approval at the exact PR #63 SHA above; later documentation commits are not covered by that approval. The final staging-to-main human review and release authorization, fresh main verification, board completion, independently authored reflection, and final nine-part PDF/portal submission remain pending. Agent review is recorded only in `ai-use.md`.

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

## Issue #55 / PR #63 review record

| PR | Branch | Reviewer verdict | Evidence |
|---|---|---|---|
| [#63](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63) | `feature/lab4-integration-release` | APPROVED at `ad09882afe57439c2d2b94e49a42912e088d7e01` | [Review #5458574074 by @oangsa](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63#pullrequestreview-5458574074), 2026-10-08T14:56:58Z |

**Issue #55**

Reviewer comment I received: @oangsa approved the staging integration and evidence for PR #63, which is OPEN with base `lab4-staging`. The reviewer reported 681 backend, 366 component and 294 browser passes, 41 Test DD rows and 27 AC mappings, with no merge-blocking mismatch. These are reviewer-reported existing results, not new execution or final release certification. The review body mentions current-head human review as pending; that wording is superseded for its exact reviewed SHA by the submitted APPROVED event. The account is GitHub type `User`, association `COLLABORATOR`; account provenance does not prove manual composition or non-AI text.

How I responded: no authored response was found in the supplied evidence. This task records the feedback only; it claims no new fix, test run or response. Approval applies only to `ad09882afe57439c2d2b94e49a42912e088d7e01`, not later documentation commits. Final staging-to-main review/authorization, fresh main verification, board completion, authentic author reflection, and the nine-part PDF/portal submission remain pending.

## Pull Requests I reviewed for my partner

The following submitted events are by @kittipichcha (GitHub account type `User`) on `oangsa/TokTickIT`. All listed PRs target `lab4-staging`. The recorded verdict is preserved even when the body expresses a hold or a later event reverses it. Empty-body approvals are verdict-only evidence; they do not establish a response or resolution of earlier findings. Human-account provenance does not prove manual composition or non-AI text. Partner PG/AC/DATA/RESP identifiers below refer only to the partner's contracts and are not imported into this repository's requirements. No bot/agent review or partner response is inferred.

| PR | Branch | Reviewer | Submitted verdict | Submitted (UTC) | Exact reviewed SHA | Review evidence |
|---|---|---|---|---|---|---|
| #84 | `feature/77-lab4-engineering-contract` | @kittipichcha | CHANGES_REQUESTED | 2026-09-30T03:52:08Z | `e268423ba56131cc770b225ca51be05cf769c755` | [#5361269858](https://github.com/oangsa/TokTickIT/pull/84#pullrequestreview-5361269858) |
| #84 | `feature/77-lab4-engineering-contract` | @kittipichcha | APPROVED | 2026-10-08T14:08:10Z | `bd9e1cfd71ecb1169aed4ba57a9a4c12a8fdc8ec` | [#5457872834](https://github.com/oangsa/TokTickIT/pull/84#pullrequestreview-5457872834) |
| #85 | `feature/78-lab4-data-foundation-migration` | @kittipichcha | CHANGES_REQUESTED | 2026-10-01T05:13:31Z | `2b560e49817a32048c0ca760b9b5bca8aa849e7e` | [#5375226460](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5375226460) |
| #85 | `feature/78-lab4-data-foundation-migration` | @kittipichcha | CHANGES_REQUESTED | 2026-10-01T07:20:08Z | `eb65745edb8c9cbccc5effccd25adca544f4573e` | [#5376116219](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5376116219) |
| #85 | `feature/78-lab4-data-foundation-migration` | @kittipichcha | APPROVED | 2026-10-01T08:16:27Z | `db289c8fea834b1fbe153649ece95936a5cda17c` | [#5376698442](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5376698442) |
| #86 | `feature/79-actions-taken-backend-api` | @kittipichcha | APPROVED | 2026-10-01T14:27:28Z | `cc5473bd2e3962a4caafd828ea323b7ec1776298` | [#5380711161](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5380711161) |
| #86 | `feature/79-actions-taken-backend-api` | @kittipichcha | CHANGES_REQUESTED | 2026-10-01T14:28:21Z | `cc5473bd2e3962a4caafd828ea323b7ec1776298` | [#5380722307](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5380722307) |
| #86 | `feature/79-actions-taken-backend-api` | @kittipichcha | APPROVED | 2026-10-01T14:57:02Z | `8a2f286e78ed4d1c3af99a7e2b2ccdc9d9b21d1f` | [#5381113563](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5381113563) |
| #87 | `feature/80-actions-taken-ui-global-lookup` | @kittipichcha | APPROVED | 2026-10-02T08:30:46Z | `1ccd27d9145850b0ed3f058f482640494d4b206d` | [#5389733591](https://github.com/oangsa/TokTickIT/pull/87#pullrequestreview-5389733591) |
| #88 | `feature/81-ticket-workflow-resolution` | @kittipichcha | APPROVED | 2026-10-02T14:05:24Z | `18567066c09567c360df685239e68b688c7e7207` | [#5392749066](https://github.com/oangsa/TokTickIT/pull/88#pullrequestreview-5392749066) |
| #89 | `feature/82-role-dashboards` | @kittipichcha | APPROVED | 2026-10-03T08:10:51Z | `3113f3b562916bffc9be70c1e899b1c2b520f908` | [#5399665042](https://github.com/oangsa/TokTickIT/pull/89#pullrequestreview-5399665042) |
| #90 | `feature/83-lab4-final-verification-release` | @kittipichcha | COMMENTED | 2026-10-08T09:44:00Z | `74161965341cf2c182f1384c3a9cd6672a1087a9` | [#5454660524](https://github.com/oangsa/TokTickIT/pull/90#pullrequestreview-5454660524) |
| #90 | `feature/83-lab4-final-verification-release` | @kittipichcha | APPROVED | 2026-10-08T15:35:42Z | `b4fac10953455db4584f8cc8ba3fba0bebd40fb8` | [#5459152489](https://github.com/oangsa/TokTickIT/pull/90#pullrequestreview-5459152489) |

### Submitted comment summaries and response limits

- **PR #84, review #5361269858:** requested failed/interrupted migration rollback or forward recovery, legacy preservation and exactly-once proof, plus the missing `isMigrated: boolean` list DTO field. Tests were Not Run. Later review #5457872834 has an empty body and records only APPROVED.
- **PR #85, review #5375226460:** identified removal of the migrated-Action resolution exclusion from frozen PG-02/PG-13/DATA-02 while AC-34 was claimed Passed. Requested restoration or an explicit ownership amendment; reported 72 files/1,065 tests without SHA-inspectable logs. Review #5376116219 noted restored Blocked rows still had circular #77/#78 versus #81 ownership and requested an approved decision synchronized across issue, test and PR records with sanitized proof. Later #5376698442 is an empty-body APPROVED event; no partner response or resolution is inferred.
- **PR #86:** empty-body approval #5380711161 was followed at the same SHA by CHANGES_REQUESTED #5380722307. That body requested resolving circular PG-10 #79/#81 ownership in #77; non-blocking notes concerned #80 assignable-user first-page coverage, stale CI run `36861468831` attribution/test title, final AI-prompt curation and npm audit triage in #83. Later #5381113563 is an empty-body APPROVED event.
- **PR #87, review #5389733591:** submitted state is APPROVED despite a B01 hold in the body. The body requested inspectable RESP-03 roles/viewports, screenshots, smoke and keyboard-focus evidence before merge; CI run `36976953622` covered Lab 3 only. The supplied current PR head `a2a7df7d32b46b640cf6d07f24815ea83d28f8fa` differs from reviewed `1ccd27d9145850b0ed3f058f482640494d4b206d`; this record does not claim current-head approval or that the evidence gap was resolved.
- **PR #88, review #5392749066:** approved staging with no material blocker. It mentioned a nonspecific, low-impact UI race while the backend remained authoritative; no implementation path or fix is invented.
- **PR #89, review #5399665042:** corrected attribution from old `6e855d0` to `3113f3b` and CI run `37096940836`, without requesting an application fix. Historical reviewer-reported results were 1,448 server, 450 client and 101 browser passes, one #83 skip, builds and PG-12; these are not new proof from this task.
- **PR #90, review #5454660524:** COMMENTED with a hold and no confirmed code blocker. Requested independent inspection of 69 screenshots; non-blocking notes concerned splitting the large API security test and retaining historical #84/staging release gates. Historical reviewer-reported results were 1,449 server, 455 client and 110 browser passes plus builds. Later #5459152489 is empty-body APPROVED at its own SHA; it supplies no response narrative or proof that earlier notes were resolved.
