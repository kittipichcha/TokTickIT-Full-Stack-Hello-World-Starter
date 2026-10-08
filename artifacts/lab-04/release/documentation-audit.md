# Issue #55 — documentation and contract audit

Reviewed 2026-10-08 against remote `lab4-staging` baseline `ed91b191ed44c3cb71de1ae61484f91e32b98e28` and the working diff on `feature/lab4-integration-release`. This is agent review, not human approval or final-main certification.

The approved Lab 4 contract contains 27 acceptance criteria and 41 Test DD IDs. The older issue-body count does not remove AC-26/27. A direct baseline comparison confirmed all 41 canonical IDs and all 41 canonical test paths preserved, plus 27 AC mapping rows. The existing UI-WF confirmation test now exercises Resolved, Closed and Cancelled consequences independently, retaining no-write dismissal and exact target/version assertions. Extra table-driven instances increase the client suite count without replacing the contract.

| Contract boundary traced | Canonical source and verification |
|---|---|
| Requester Action privacy and replay | `server/src/action-service.ts` explicitly projects requester fields without internal IDs. Unexpired same-hash idempotency replay precedes terminal-state rejection; expiry equality is expired. Existing Action API and component contracts remain authoritative. |
| Shared Ticket concurrency and history | `server/src/ticket-workflow-service.ts` validates positive optional `expectedVersion`, locks the Ticket and rejects stale versions before mutation. Owner, priority and status share its version. Status history is written with the same mutation; the policy retains owner and pending-Action gates. |
| Dashboard scope and bounded lists | `server/src/dashboard-service.ts` uses session actor ownership/assignment, inclusive rolling-seven-day cutoff, current Resolved status with non-null timestamp, zero-filled status groups and bounded stable ordering. Presentation injections are not substituted for database assertions. |
| Migration and recovery | Eight retained migrations and the unchanged historical fixture are checked; see `migration-recovery.md`. README separates empty, verified populated Lab 3, and pinned Lab 2 conversion contexts. |
| Navigation, keyboard and visual behavior | Real role journeys, explicit disabled-control reasons, all three confirmation targets and bounded Action/history captures remain in canonical browser files. Automated focus/geometry and actual image inspection are separate evidence in `visual-accessibility-checklist.md`. |
| Reproducible setup and demo | README commands, server-only secret, separate databases, seed repeat, normal Prisma generation and built application startup are rehearsed in `clean-checkout-results.md`. All five procedures are reconciled with full completed suites in the rehearsal report. |

Documentation corrections include shared-version/stale-409 semantics in the owner, priority and status endpoint descriptions; automatic conflict refresh with explicit Refresh required only after refresh failure; current browser all-eight-migration prerequisites; and removal of the historical claim that failed Prisma deployment itself proved full rollback. Historical counts and failures remain historical rather than current certification.

Independent source review covered implement-authored hardening, keyboard and responsive changes and verify-authored `TicketWorkflow.test.tsx`. No further blocking source defect was substantiated. The only product correction is scoped success-text wrapping after a real saved-long-Action overflow was reproduced and independently reviewed. Canonical browser regression subsequently passed 45/45 across the three configured viewports; the current client suite passed 366 tests. The subsequent complete configured browser run passed 294/294 with zero failed, skipped or flaky cases; `staging/playwright.json` and `.txt` retain that result. All 105 release-copy hashes match the inventory and canonical files; nine final confirmation images were opened across all targets and widths without a visible blocker. The final pristine seeded backend report passed 681/681, with zero failures, skips or todo cases, and its manifest confirms exit 0.

README, reviewer and AI-use drafts were independently re-reviewed by the verification agent after corrections. The four new release audit/review/migration/accessibility documents were also independently reviewed; a DB-MIG-04 attribution and gate-filename error were corrected, and re-review reported no remaining introduced blocking finding. Human review provenance uses actual review events and exact heads, not later commits by implication. Final-main verification, human release approval, board updates and submission PDF are separate gates; see the final gate report. No private credentials, dumps or attachment snapshots belong in this bundle.




## Independent verification-report review

The requirements reviewer separately parsed verification-authored final reports and
manifests: backend 681/681 and client 366/366 with no failed/pending/todo cases;
browser 294 expected with no skipped/unexpected/flaky cases; final backend and both
build manifests exit 0. All 182 executable fingerprints were independently recomputed
with zero mismatches. The retained dirty-database diagnostic correctly records 679
passes and two failures, including ID preservation and literal-underscore fixture
expectations; it is not substituted for the pristine final run.

Both performance JSON files contain 20 serial measurements. Independently sorting them
and taking index 18 reproduces requester p95 26.7344 ms and staff p95 43.4827 ms;
maximum body sizes are 5,529 and 18,607 UTF-8 bytes. Canonical source retains five
warmups, the exact 1,000-Ticket/3,000-Action fixture, p95 below 1,000 ms and bodies at
most 65,536 bytes. A verification-report threshold typo of 500 ms was corrected to 1,000 ms; the actual samples pass the authoritative contract. Documentation-review.md
accurately separates agent source/doc review, completed runtime facts and pending human
or final-main approval. No additional source/runtime blocker was found.
