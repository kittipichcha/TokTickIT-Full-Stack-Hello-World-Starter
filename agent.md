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

### 1.1 Decision-free execution contract
For Lab 2, the engineering contract is the controlling source of truth. The agent must treat the Lab 2 requirement set as a closed contract and must not invent additional product behavior, UI states, validation rules, status values, endpoints, or defaults that are not explicitly specified in the approved requirements.

If a detail is missing, contradictory, or underspecified, the agent must stop and ask for approval instead of making a design choice. "Reasonable default" behavior is allowed only when the requirement explicitly defines a fallback or default value.

### Requirement precedence order
When multiple Lab 2 documents appear to disagree, the agent must resolve conflicts in this order:
1. `Lab_02_labsheet.pdf` requirements and explicit scope statements
2. `docs/lab-02/specification.md`
3. `docs/lab-02/api-spec.md`
4. `docs/lab-02/ui-spec.md`
5. `docs/lab-02/tests.md`
6. Existing implementation code and repository conventions

The requirement docs must guide implementation; implementation code does not override the written contract.

### 1.2 Commit and push approval policy
Approval of the task authorizes implementation and validation within the approved scope. A separate explicit user approval is required before the agent stages, commits, or pushes any change.

If a task cannot pass validation or the implementation is not yet in a safe state, the agent must not stage, commit, or push. Instead, it must stop, explain the failure cause, and request approval for the next corrective step.
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
4. Only after the relevant test slice passes may the agent stage and commit the change.

### 3.1 Plan-vs-Act requirement for assigned tasks
When a task is assigned to a model or agent, it must be split into two explicit phases within the task function:
- Plan: identify scope, mapped requirements (FR/BR/AC), relevant tests, risks, and implementation order.
- Act: implement only the approved plan, run the relevant validation, and keep the change small and traceable.

The Plan phase does not edit production code. The Act phase does not broaden scope beyond the approved plan without another approval gate.

If tests fail:
- Explain fail cause.
- Propose fix plan.
- Ask for approval before larger corrective changes.
- Do not push or merge until the failing slice is fixed and validated.

## 4. Test Logging Requirement
After each completed task, insert the newest result entry at the **top** of the Results Log
(prepend each completed task result under the Results Log heading — newest first):
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
- `docs/lab-02/ai-use.md`

Format must match Lab 1 style in:
- `docs/lab-01/ai_use.md` (legacy Lab 1 filename)

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

Worktree rules:
- One active feature branch per worktree.
- Do not reuse a dirty worktree for another issue.
- New worktrees must branch from the latest `lab2-staging` baseline.
- Out-of-scope fixes require a separate branch/worktree after explicit approval.
- Remove completed worktrees only after their branch is merged or intentionally preserved.

If a bugfix outside current branch scope is needed:
1. Explain why it is out of scope.
2. Ask user permission.
3. Create a dedicated bugfix branch/worktree only after approval.

## 8. PR and Kanban Policy
When branch scope meets issue acceptance criteria:
1. Summarize completion evidence (including tests).
2. Check whether all required issue criteria are satisfied and the target behavior is fully implemented.
3. Ask user approval to open PR targeting `lab2-staging` (all feature PRs go to `lab2-staging`; the final release PR moves `lab2-staging` into `main`).
4. After PR approval/workflow confirmation, ask user approval to move issue card in Kanban.

The agent is allowed to propose or request a PR once the issue criteria are satisfied and the relevant tests pass. PR creation itself still requires explicit user approval unless the user has already explicitly authorized autonomous PR creation for that repo/task.

No autonomous PR creation or Kanban state changes without user approval.

## 9. Standard Task Flow
1. Clarify + map FR/BR/AC.
2. Propose plan and ask approval.
3. Split the task into Plan and Act phases.
4. Implement in small functional slices.
5. Run tests for changed behavior.
6. Report results.
7. Update `docs/lab-02/tests.md` (newest log entry).
8. Update `docs/lab-02/ai-use.md` in Lab 1 style.
9. Report the validated change and request explicit approval to stage, commit, and push.
10. After approval, stage, commit, and push only the validated changes within scope.
11. Ask separate approval for a PR targeting `lab2-staging` and for board updates once issue acceptance criteria are satisfied.

## 10. Stop Conditions
The agent must stop and ask the user when:
- requirement conflict is detected
- behavior is underspecified
- migration/data impact is risky
- tests contradict API/spec contract
- branch/worktree/PR action is requested implicitly but not approved explicitly