# Lab 4 — AI Use and Reflection

## Issue #50 migration fixture contract revision 3 (2026-09-29)

- Prompt summary: close ambiguity in the Lab 3 Prisma fixture override validation and specify tests for both isolated historical and full normal migration paths.
- Agent used: OpenAI Codex.
- Work performed: required exactly `NODE_ENV=test`, a verified fixture-root historical schema override, and a safe disposable URL; specified rejection before Prisma execution for invalid environments, paths, URLs, or missing `--schema`. Added explicit unset of the override before normal migration history, server-local Prisma status/deploy commands, and pending/up-to-date expectations. Extended planned `DB-MIG-04`. No application, database, migration, or executable test was changed.
- Verification: `git diff --check` passed. PowerShell fixture contract audit passed; 40 unique Lab 4 test rows remain `Planned`; AC-19 maps DB-MIG-01/02/03/04 and DB-SEED-01. No executable test, Prisma command, database restore, or attachment operation was run.
- Reflection: testing rejection and normal deployment paths makes schema isolation and standard migration behavior independently verifiable.

## Issue #50 migration continuity contract (2026-09-29)

- Prompt summary: freeze migration recovery and define database, function, and test continuity from Lab 3 to Lab 4.
- Agent used: OpenAI Codex.
- Work performed: documented the verified Lab 3 Phase A/backfill/Phase C prerequisite; paired full PostgreSQL and attachment snapshots; separate-database restore rehearsal; pre-write paired restore; post-write forward recovery; preserved Lab 3 routes/functions; dashboard navigation continuity; and prior-lab test execution/adaptation rules. Added planned `DB-MIG-03` and mapped AC-19 to migration, recovery, and seed coverage. No application/database/test implementation was changed.
- Verification: `git diff --check` passed. PowerShell contract audit passed with 39 unique Planned test rows, complete AC-19 mapping, one recovery strategy, and no runtime-path changes. No executable tests, migration, database restore, or attachment operation was run.
- Reflection: defining the accepted-write boundary removes the unsafe choice between restoring stale snapshots and preserving newly accepted Lab 4 data.

## Issue #50 PR #58 human-review revision (2026-09-29)

- Prompt summary: revise the Lab 4 documentation contract and log routing in response to human
  review #5341087376 on PR #58.
- Agent used: OpenAI Codex.
- Work performed: specified Staff/Admin status history, shared Ticket version concurrency,
  durable normalized Action-create idempotency, Action detail coverage, canonical Ticket example,
  and a deterministic dashboard performance threshold. Added AC-26/27 and Planned test rows,
  documented the six review responses with re-review still pending, and routed Lab 4 logs to
  Lab 4 documents while preserving historic Lab 3 evidence. No product code or executable tests
  were changed.
- Verification: documentation-only diff, allowlist, endpoint/identifier/status, and Planned-row
  checks are recorded in `docs/lab-04/tests.md`. No executable tests were run.
- Reflection: explicit version and idempotency rules make retry and concurrent-write behavior
  testable without claiming implementation evidence.

## Issue #50 contract drafting (2026-09-27)

- Prompt summary: coordinate Issue #50 documentation work from `SE+Lab+4.pdf` and the existing
  Lab 4 drafts; complete four Lab 4 contract files; preserve Lab 3 behavior and log only this
  documentation audit in Lab 3 records.
- Agent used: OpenAI Codex.
- Work performed: copied the user-provided Lab 4 specification and planned test draft into the
  issue worktree, reconciled them with the integrated Lab 3 contracts and the Issue #50 scope,
  and drafted API/UI contracts. Recorded server-set Pending Action status, immutable Action
  revisions and Ticket status history, Reopened-to-In Progress, compatible optional
  `expectedVersion` on the status API with mandatory use by the Lab 4 UI, and dashboard filter
  and drill-down behavior. Added planned tests for status-version compatibility and dashboard
  filter predicates. No product code or executable test files were changed.
- Verification: documentation-only checks recorded in `docs/lab-04/tests.md`; no executable
  tests were run. Human contract review remains pending in `docs/lab-04/reviewer.md`.
- Reflection: explicit request/response shapes and history rules reduce implementation choices
  that could otherwise diverge between API, UI, and tests.
