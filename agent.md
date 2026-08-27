# TokTickIT Lab 2 Agent Working Agreement

This file defines how the coding agent must operate for Lab 2 work in this repository.

## 0. Requirement Primacy and User Prompt Rule
Repository specifications (`docs/lab-02/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, and issue criteria) are the **top priority** and take precedence over user prompts.
- If a user prompt requests something that conflicts with or violates the defined requirements, requirements **surpass** the user prompt.
- If such a conflict occurs, the agent must explicitly **inform the user of the conflict before planning** or executing any changes.

## 1. Mandatory Clarification and Approval Gate
Before taking implementation actions, the agent must:
0. Read the governing requirements and the current issue first — before any planning. The agent must read `docs/lab-02/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, and the issue text/acceptance criteria, and map the task to FR/BR/AC IDs. Planning must be grounded in these documents, never in memory or assumptions alone.
1. Restate the task in scoped terms.
2. Present a short plan.
3. Ask for explicit approval.

No code edits, branch/worktree creation, PR actions, or issue state moves before user approval.

If prompt details are unclear, the agent must ask questions and wait.
No assumptions are allowed for ambiguous requirements.

### 1.1 Commit and push approval policy
Approval of the task authorizes implementation and validation within the approved scope. A separate explicit user approval is required before the agent stages, commits, or pushes any change.

If a task cannot pass validation or the implementation is not yet in a safe state, the agent must not stage, commit, or push. Instead, it must stop, explain the failure cause, and request approval for the next corrective step.
## 2. Requirement Traceability Discipline
For every task, the agent must map work to requirement IDs:
- FR (Functional Requirement)
- BR (Business Rule)
- AC (Acceptance Criterion)

Every proposed change summary must include those mappings.

## 3. Test-First, Test-Evidence, and Test Specification Alignment Rules
For any functionally changed behavior:
1. Add/update related tests first (or in same change set if minimal).
2. Run relevant tests.
3. Report results clearly.
4. Only after the relevant test slice passes may the agent stage and commit the change.

### 3.1 Test and `tests.md` Alignment Requirement
The agent must continuously verify that executable test code and `docs/lab-02/tests.md` are strictly aligned:
- Exact planned test paths and test IDs specified in `tests.md` and issue contracts must exist and match. The agent must never replace or redirect required test paths in `tests.md` to different files.
- Test statuses in `tests.md` (`Planned`, `Implemented`, `Passed`) must accurately reflect executable test evidence.
- A test status must NOT be marked `Passed` if only a partial matrix is covered or if dependent flows/data do not yet exist.

### 3.2 Plan-vs-Act requirement for assigned tasks
When a task is assigned to a model or agent, it must be split into two explicit phases within the task function:
- Plan: identify scope, mapped requirements (FR/BR/AC), relevant tests, risks, and implementation order. The plan must also consider removing unused imports, dead code, and unnecessary dependencies that are identified during scope analysis.
- Act: implement only the approved plan, run the relevant validation, and keep the change small and traceable.

The Plan phase does not edit production code. The Act phase does not broaden scope beyond the approved plan without another approval gate.

### 3.3 Integration & Real Database Test Rules
1. **Backend Integration Testing with Real Database**:
   - Integration tests MUST support testing against the actual database connection (PostgreSQL via Prisma / `DATABASE_URL`).
   - Use conditional execution (e.g. `process.env.DATABASE_URL ? it : it.skip`) or test lifecycle setup (`beforeAll`, `afterAll` with `disconnectPrisma()`) so tests validate against live database records safely without mutating critical test seed data.
2. **Frontend UI Integration Testing**:
   - UI tests must cover end-to-end component rendering and client storage persistence (`sessionStorage` with `REQUESTER_STORAGE_KEY`).
   - Validate full identity lifecycle: initial requester list fetching, selection persistence, context validation, and switching requesters.

### 3.4 Test Status vs. Issue Scope Rule
A `tests.md` matrix row may only be marked `Passed` when its **entire** required contract is
executable within the current issue's scope and is actually asserted by automated tests.
- If any part of the row depends on data models, endpoints, screens, or flows that belong to a
  different/downstream issue (and therefore do not exist in this branch), the row MUST stay
  `Planned` (or `Blocked` if a documented prerequisite is unavailable). Partial coverage is
  never sufficient for `Passed`.
- Do NOT add runtime code (e.g. a premature `fetchMyTickets()` hitting a not-yet-existing route)
  solely to produce test evidence before the owning feature exists. Leave the row `Planned` and
  defer it to the issue that owns the behavior.
- When code in the repository does not correspond to any requirement/test in the current issue,
  mark it as out-of-scope/pending rather than silently changing `tests.md` or forcing a `Passed`
  status.

If tests fail:
- Explain fail cause.
- Propose fix plan.
- Ask for approval before larger corrective changes.
- Do not push or merge until the failing slice is fixed and validated.

## 4. Post-Implementation Double-Check Alignment Method
After every implementation is complete and all tests pass, the agent must perform a systematic double-check to ensure all documents, code, and the issue are aligned. This is a mandatory verification gate — no commit or PR may proceed until this check passes.

### 4.1 Step 1: Re-read the Issue
Re-read the issue text and acceptance criteria to confirm every task and AC has been addressed. Verify nothing was missed or misinterpreted.

### 4.2 Step 2: Parallel Cross-Reference Check
Perform the following checks in parallel (or rapid sequence) across all governing documents and the actual codebase:

| Check | Source | Target | What to Verify |
|---|---|---|---|
| Requirements → Code | `specification.md` FR/BR list | Actual source files | Every implemented FR/BR has corresponding code; no extra behaviors beyond spec |
| API Spec → Routes | `api-spec.md` endpoints | `server/src/module.ts` routes | Endpoints claimed as implemented for the current issue scope exist and match the contract; implemented routes are documented. Planned/downstream endpoints that belong to future issues are explicitly not required to exist yet and must not cause a gate failure. |
| API Spec → README | `api-spec.md` endpoints | `README.md` "API Implemented Today" | README lists only implemented endpoints; no stale/removed endpoints documented |
| Tests.md → Test Files | `tests.md` test IDs and file paths | Actual test files on disk | Every test file path listed in `tests.md` exists on disk. Test files that are not part of the Lab 2 contract matrix (e.g. legacy Lab 1 tests, supporting utilities) are intentionally excluded from this check and do not need to appear in `tests.md`. |
| Tests.md → Status | `tests.md` Final column | Actual test run output | Every `Passed` row has passing evidence; no `Planned` row is incorrectly marked `Passed` |
| UI Spec → CSS | `ui-spec.md` color tokens, styles | `client/src/App.css` | CSS uses only Zen Green tokens; no ad-hoc colors or removed component styles |
| Issue AC → Evidence | Issue acceptance criteria | grep results, test output, file listings | Every AC is satisfied with concrete evidence |

### 4.3 Step 3: Test Status Audit
Run the full test suite and compare every test result against `tests.md`:
- For each row in `tests.md` marked `Passed`: confirm the test file exists and the test actually passes in the latest run.
- For each row marked `Implemented`: confirm the test file exists and the test runs (pass or fail).
- For each row marked `Planned`: confirm the test file does NOT yet exist (or exists but is skipped), and the status is accurate.
- If any discrepancy is found, update `tests.md` to reflect reality — never falsify status.

### 4.4 Step 4: Cleanup Verification
- Run `grep` for removed/legacy terms across `client/src/`, `server/src/`, and `README.md` to confirm no stale references remain.
- Verify no orphaned test files, unused imports, or dead code paths reference removed features.
- Confirm the repository structure in `README.md` matches the actual file tree.

### 4.5 Step 5: Report
Produce a concise alignment report summarizing:
- Which checks passed
- Any discrepancies found and how they were resolved
- Final test counts (passed/skipped/failed)
- Confirmation that all issue ACs are met

### 4.6 Step 6: Governance Isolation Rule
Changes to `agent.md` that introduce new mandatory workflows, verification gates, or working-agreement rules must be isolated in their own governance PR — they must not be bundled with feature implementation PRs. Minor corrections (typos, section numbering, clarifying existing rules without adding new obligations) may accompany any PR when documented in the PR description.

## 5. Debug Mantra Skill
Four-step discipline for any debug session:
1. **First is reproducibility.** Can the issue be reproduced reliably? Build a fast, deterministic pass/fail repro before hypothesizing.
2. **Know the fail path.** Debugger first; then source trace + knob enumeration; then in-code instrumentation with unique prefixes.
3. **Question your hypothesis.** What disproves it? Run the disproof first before committing to a fix. Generate 3–5 ranked hypotheses.
4. **Every run is a breadcrumb.** Maintain a running ledger of every experiment. Cross-reference all observations before declaring a fix correct.

## 6. Scrutinize Skill
Outsider-perspective end-to-end review discipline for plans, code changes, and PRs:
1. **Intent**: State goal in one sentence. Ask: is there a simpler, smaller, or more elegant way (or existing mechanism) to achieve this goal?
2. **Trace**: Walk actual code path end-to-end (entry point → call sites → branches → state mutation → return/side effect), including surrounding code.
3. **Verify**: Does traced path produce claimed behavior? What edge cases/inputs break it? What does it silently change? How is it tested?
4. **Report**: Output findings ordered by severity (Finding, Why it matters, Evidence, Suggested change), closing with a clear verdict.

## 7. Test Logging Requirement
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

## 8. AI Usage Log Requirement
After each completed task, update:
- `docs/lab-02/ai-use.md`

Format must match Lab 1 style in:
- `docs/lab-01/ai_use.md` (legacy Lab 1 filename)

Minimum content to update each time:
- prompt summary
- what was done with output
- reflection note if relevant

## 9. Commit Policy (Traceability)
Commits must be grouped by function/behavior, not by file.

Examples:
- Good: "feat(ticket-create): add summary/description validation and tests"
- Not allowed: "chore: update 5 files"

Agent may commit only after explicit user approval.

## 10. Branch and Worktree Policy
Branching strategy must follow main requirement functions:
- Staging branch: `lab2-staging` is created from the current head of `main` as the integration target.
- Feature branches branch off and target `lab2-staging`:
  - `feature/lab2-requirement-ai` (actual branch in use: `doc/lab-02/requirement_and_agent`)
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

## 11. PR and Kanban Policy
When branch scope meets issue acceptance criteria:
1. Summarize completion evidence (including tests).
2. Check whether all required issue criteria are satisfied and the target behavior is fully implemented.
3. Ask user approval to open PR targeting `lab2-staging` (all feature PRs go to `lab2-staging`; the final release PR moves `lab2-staging` into `main`).
4. After PR approval/workflow confirmation, ask user approval to move issue card in Kanban.

The agent is allowed to propose or request a PR once the issue criteria are satisfied and the relevant tests pass. PR creation itself still requires explicit user approval unless the user has already explicitly authorized autonomous PR creation for that repo/task.

No autonomous PR creation or Kanban state changes without user approval.

## 12. Standard Task Flow
1. Clarify + map FR/BR/AC.
2. Propose plan and ask approval.
3. Split the task into Plan and Act phases.
4. Implement in small functional slices.
5. Run tests for changed behavior.
6. Report results.
7. Update `docs/lab-02/tests.md` (newest log entry).
8. Update `docs/lab-02/ai-use.md` in Lab 1 style.
9. **Update `docs/lab-02/reviewer.md`** — whenever changes are made in response to peer review feedback (requested changes from a PR review), add a new row to the review comments table documenting the feedback source, summary, and how it was addressed. This ensures the reviewer record stays complete and traceable.
10. Report the validated change and request explicit approval to stage, commit, and push.
11. After approval, stage, commit, and push only the validated changes within scope.
12. Ask separate approval for a PR targeting `lab2-staging` and for board updates once issue acceptance criteria are satisfied.

## 13. Stop Conditions
The agent must stop and ask the user when:
- requirement conflict is detected
- behavior is underspecified
- migration/data impact is risky
- tests contradict API/spec contract
- branch/worktree/PR action is requested implicitly but not approved explicitly

## 14. Fix Plan for PR #25 P1 Blockers (Lab 2 Issue 3 - Ticket Creation Flow)
The following detailed fix plan addresses the three P1 blockers identified in PR #25 review comments. This plan must be executed in sequence with appropriate testing validation after each change.

### 14.1 P1 Blocker 1: Raw-body Integer Validator Can Be Byped and Can Reject Valid Requests
**Problem**: `validateIntegerFields()` in `server/src/integer-validation.ts` parses JSON with a reviver, but then locates the original numeric token using a regular expression against the entire raw request body: `regex.exec(rawBody)` always returns the first textual occurrence of the field name. It does not identify the token belonging to the specific top-level property currently visited by the JSON reviver. This allows an invalid top-level ID to be hidden by an earlier property with the same name.

**Example Vulnerability**: 
```json
{
  "ignored": {
    "categoryId": 1
  },
  "categoryId": 1.0,
  "relatedSystemId": 1,
  "summary": "Valid summary",
  "description": "Valid description text",
  "requester": "DEV_USER"
}
```
Regex matches the nested valid `categoryId` instead of top-level invalid one.

**Required Fix**:
1. Remove regex-based approach entirely
2. Modify walker algorithm to track which property key is currently being visited
3. Only apply integer validation when traversing top-level property names in `integerFields` set
4. Maintain current defense: ignore nested occurrences inside unknown properties
5. Ensure JSON escape sequences in property names are correctly decoded

**Test Validation**:
- Update existing integer validation tests to verify new logic works correctly
- Add new test case for vulnerability scenario with nested same-key property
- Run: `cd server && npm test integer-validation.api.test.ts`

### 14.2 P1 Blocker g2: Real-database Tests Delete Tickets but Permanently Advance `TicketSequence`
**Problem**: Integration test cleanup (`create-ticket-real-db.integration.test.ts`, `create-ticket-reference-validation.integration.test.ts`, `ticket-number-concurrency.integration.test.ts`) correctly deletes Ticket rows but does NOT roll back `TicketSequence` increments. Each successful call to `POST /api/tickets` increments the current UTC year's `TicketSequence`. Deleting the Ticket row does not reset or restore the sequence.

**Root Cause**: `TicketSequence` table persists sequence increments independently of Ticket existence.

**Required Fix**:
**Option A: Reset sequence after test suite (preferred)**
1. In test `afterAll` hook, after deleting test Tickets, also reset `TicketSequence.lastSeq` for current UTC year to a safe baseline (e.g., 1)
2. Use raw SQL: `UPDATE "TicketSequence" SET "lastSeq" = 1 WHERE "year" = ${currentYear}`
3. Must handle edge case: only reset when `lastSeq` is under our control

**Option B: Use separate test year (alternative)**
1. Modify tests to use a dedicated test year (e.g., 9999) instead of current UTC year
2. Reset that year's sequence in `beforeAll`/`afterAll` hooks

**Option C: Use transactions (most complex)**
1. Wrap entire test in Prisma transaction that gets rolled back
2. Requires refactoring of `allocateTicketNumberWithClient` to work within transaction

**Test Validation**:
- Verify before/after test runs that `TicketSequence.lastSeq` for current year remains unchanged
- Add assertion counting `TicketSequence` rows before/after test suite
- Run: `cd server && npm test create-ticket-real-db.integration.test.ts create-ticket-reference-validation.integration.test.ts ticket-number-concurrency.integration.test.ts`

### 14.3 P1 Blocker 3: Valid Request Containing Ignored Nested Object Can Return `500 INTERNAL_ERROR`
**Problem**: The API contract states that unknown JSON properties are ignored. The custom raw-JSON parser attempts to skip unknown nested objects using:
```ts
while (true) {
  readString();
  skipWhitespace();
  pos++;
  skipValue();
  skipWhitespace();

  if (rawBody[pos] === ",") pos++;
  else break;
}
```
After consuming a comma inside a nested object, the loop immediately calls `readString()` again without first calling `skipWhitespace()`. This causes `readString()` to throw on valid requests with whitespace after comma.

**Example Failure**: 
```json
{
  "ignored": {
    "a": 1,
    "b": 2
  },
  "categoryId": 1,
  "relatedSystemId": Longline truncated...
```

**Required Fix**:
1. In `skipValue()` function, inside the object traversal loop, after consuming comma (`pos++`), call `skipWhitespace()` before `readString()`
2. Also ensure whitespace is skipped after reading key-value pair
3. Maintain defensive try-catch wrapper that returns empty invalid array on walker errors

**Test Validation**:
- Create test case with whitespace in ignored nested object: `{"ignored":{"a":1, "b":2}}`
- Update integer validation test to include whitespace variations
- Run: `cd server && npm test integer-validation.api.test.ts`

### 14.4 Implementation Sequence
1. **First fix Parser issue (P1 Blocker 3)** - simplest, isolated change to `integer-validation.ts`
2. **Then fix Integer Validator (P1 Blocker 1)** - more complex logic change  
3. **Finally fix TicketSequence (P1 Blocker 2)** - test infrastructure change

**Traceability**:
- FR-02.01.01: Integer lexical validation (api-spec §0)
- FR-02.01.02: Normalization (trimming) enforcement
- AC-02.02: Real database integration test evidence
- AC-02.03: Test cleanup leaves database state unchanged

Each fix must be accompanied by:
1. Unit/integration test updates
2. Verification that existing tests still pass
3. `tests.md` status update if applicable
4. `reviewer.md` update documenting change

### 14.5 Risk Mitigation
- **Data Corruption Risk**: TicketSequence fix must not affect production data; verify Year != current UTC year in test environment
- **Regression Risk**: All fixes must maintain backward compatibility with API contract
- **Performance Impact**: Integer validator walker efficiency should remain O(n)
.### 14.6 Implementation Rules
Before implementing any fix:
1. Create a worktree from current branch (`feature/lab2-ticket-creation`)
2. Write failing test that reproduces the issue
3. Implement fix incrementally
4. Run full test suite for affected component
5. Update `tests.md` Results Log (newest first)
6. Update `ai-use.md` with prompt/actions
7. Update `reviewer.md` with fix documentation

After all three blockers fixed:
1. Run full cross-reference check (Section 4)
2. Confirm all PR #25 review comments addressed
3. Request user approval before committing/pushing

## 15. PR #25 Status Summary
**Title**: feat: Lab 2 Issue 3 - Ticket Creation Flow
**Branch**: `feature/lab2-ticket-creation`
**Target**: `lab2-staging`
**Status**: 3 P1 blockers (must fix before merge)

**Blockers**:
1. Integer validator regex bypass/rejection
2. Real-database tests permanently advance TicketSequence  
3. Parser fails on valid requests with ignored nested objects