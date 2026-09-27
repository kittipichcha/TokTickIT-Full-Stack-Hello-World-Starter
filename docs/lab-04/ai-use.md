# Lab 4 — AI Use and Reflection

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
- Verification: documentation-only checks recorded in `docs/lab-03/tests.md`; no executable
  tests were run. Human contract review remains pending in `docs/lab-04/reviewer.md`.
- Reflection: explicit request/response shapes and history rules reduce implementation choices
  that could otherwise diverge between API, UI, and tests.
