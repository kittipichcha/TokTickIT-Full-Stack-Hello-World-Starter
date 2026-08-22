# TokTickIT Lab 2 Agent Working Agreement

This file defines how the coding agent must operate for Lab 2 work in this repository.

## 1. Mandatory Clarification and Approval Gate
Before taking implementation actions, the agent must:
1. Restate the task in scoped terms.
2. Present a short plan.
3. Ask for explicit approval.

No code edits, branch/worktree creation, PR actions, or issue state moves before user approval.

If prompt details are unclear, the agent must ask questions and wait.
No assumptions are allowed for ambiguous requirements.

## 2. Requirement Traceability Discipline
For every task, the agent must map work to requirement IDs:
- FR (Functional Requirement)
- BR (Business Rule)
- AC (Acceptance Criterion)

Every proposed change summary must include those mappings.

## 3. Test-First and Test-Evidence Rules
For any functionally changed behavior:
1. Add/update related tests first (or in same change set if minimal).
2. Run relevant tests.
3. Report results clearly.

If tests fail:
- Explain fail cause.
- Propose fix plan.
- Ask for approval before larger corrective changes.

## 4. Test Logging Requirement
After each completed task, append newest result entry to:
- `docs/lab-02/tests.md` (Section: Results Log, newest first)

Each entry must include:
- date
- scope/issue
- tests changed
- commands run
- pass/fail/skipped counts
- follow-up notes

## 5. AI Usage Log Requirement
After each completed task, update:
- `docs/lab-02/ai_use.md`

Format must match Lab 1 style in:
- `docs/lab-01/ai_use.md`

Minimum content to update each time:
- prompt summary
- what was done with output
- reflection note if relevant

## 6. Commit Policy (Traceability)
Commits must be grouped by function/behavior, not by file.

Examples:
- Good: "feat(ticket-create): add summary/description validation and tests"
- Not allowed: "chore: update 5 files"

Agent may commit only after explicit user approval.

## 7. Branch and Worktree Policy
Branching strategy must follow main requirement functions:
- Staging branch: `lab2-staging` is created from the current head of `main` as the integration target.
- Feature branches branch off and target `lab2-staging`:
  - `feature/lab2-requirement-ai` (or `doc/requirement_and_agent`)
  - `feature/lab2-requester-selection`
  - `feature/lab2-ticket-creation`
  - `feature/lab2-my-tickets`
  - `feature/lab2-attachments`

If a bugfix outside current branch scope is needed:
1. Explain why it is out of scope.
2. Ask user permission.
3. Create a dedicated bugfix branch/worktree only after approval.

## 8. PR and Kanban Policy
When branch scope meets issue acceptance criteria:
1. Summarize completion evidence (including tests).
2. Ask user approval to open PR targeting `lab2-staging` (all feature PRs go to `lab2-staging`; the final release PR moves `lab2-staging` into `main`).
3. After PR approval/workflow confirmation, ask user approval to move issue card in Kanban.

No autonomous PR creation or Kanban state changes without user approval.

## 9. Standard Task Flow
1. Clarify + map FR/BR/AC.
2. Propose plan and ask approval.
3. Implement in small functional slices.
4. Run tests for changed behavior.
5. Report results.
6. Update `docs/lab-02/tests.md` (newest log entry).
7. Update `docs/lab-02/ai_use.md` in Lab 1 style.
8. Ask approval for commit.
9. Commit function-by-function.
10. Ask approval for PR targeting `lab2-staging` and board updates.

## 10. Stop Conditions
The agent must stop and ask the user when:
- requirement conflict is detected
- behavior is underspecified
- migration/data impact is risky
- tests contradict API/spec contract
- branch/worktree/PR action is requested implicitly but not approved explicitly
