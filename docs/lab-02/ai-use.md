# Lab 2 - AI Use and Reflection

**LLM/agent used:** GitHub Copilot (GPT-5.3-Codex)

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Compare Lab 2 specification and current project, identify viability and conflicts | Reviewed code and docs, then produced a gap analysis showing current implementation is still Lab 1 baseline while Lab 2 is largely planned work. |
| 2 | Update README for Lab 2 requirements | Rewrote README to show Lab 2 scope, current implementation status, setup, current runnable commands, and phased implementation order. |
| 3 | Align `docs/lab-02/tests.md` with current structure/tooling | Replaced test doc with a phased plan tied to actual repo paths and current Vitest tooling, plus a newest-first results log section. |
| 4 | Create `agent.md` with strict working rules | Added workflow policy covering approval gates, FR/BR/AC mapping, test logging, AI-use updates, branch/worktree and PR approval requirements, and function-level commit strategy. |
| 5 | Create five GitHub issues with requirement mapping | Created issues #11 to #15 for requirement+AI baseline, user login surrogate, ticket creation, my tickets, and attachment lifecycle, each with FR/BR/AC traceability and acceptance criteria. |
| 6 | Refine documentation, review issue text for complete correctness, and prepare baseline commit | Audited doc files, fixed Lab 2 header in reviewer.md, cross-linked issues #11-#15 with prerequisite chains and FR/BR/AC criteria, updated tests.md results log, and committed baseline function-by-function. |
| 7 | Update agent.md PR target branch policy | Updated agent.md to specify that `lab2-staging` (created from current head of `main`) is the PR target for feature branches, and `main` is reserved for final release PR. |
| 8 | Address PR #16 peer/Copilot review findings and reconcile specifications, tests, and naming | Completed AC-to-test traceability matrix in `tests.md`, resolved AC-16 inactive requester lifecycle, scoped `X-Dev-Requester-Id` header, froze 5,000,000 byte attachment limit, defined deterministic sorting, renamed `ai-use.md`, and added worktree policy to `agent.md`. |
| 9 | Fix the remaining PR #16 review findings and check related agent/issue contracts | Reconciled the commit approval policy, added explicit Ticket Date authority, expanded Test-DD BR and Ticket Detail UI coverage, and synchronized downstream issue ownership and mappings. |
| 10 | Apply the final PR #16 re-review contract fixes to the Lab 2 baseline docs | Updated the planned-test table to include `Expected Result` and `Final`, preserved the Category `createdAt` migration contract, added the missing direct BR scenarios, and cleaned the traceability mappings that were still conflicting with the create-ticket rule. |
| 11 | Compare the Lab 2 project contract with the Lab 02 handout and correct formatting gaps | Verified the documents against the handout, retained the already-complete assumptions section, renamed Test-DD headings to match the required table terminology, recorded factual PR #16 review evidence, and removed the local PDF-text extraction artifact. |

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Aligning test documentation to real folder/tooling early prevents command drift and broken CI expectations later.
3. Splitting Lab 2 into focused issues with explicit prerequisite links improves branch discipline and review quality.
4. Resolving contract edge cases and establishing complete AC-to-test traceability during specification prevents downstream implementation churn.
5. Checking the process agreement and downstream issue mappings alongside the feature contracts prevents a local documentation fix from creating conflicting delivery rules.
6. A handout-alignment audit is most useful when it distinguishes present contract evidence from future implementation and final-submission evidence instead of implying unfinished work has passed.