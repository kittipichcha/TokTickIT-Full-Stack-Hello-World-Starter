# Lab 2 - AI Use and Reflection

**LLM/agent used:** <GitHub Copilot (GPT-5.3-Codex)>

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Compare Lab 2 specification and current project, identify viability and conflicts | Reviewed code and docs, then produced a gap analysis showing current implementation is still Lab 1 baseline while Lab 2 is largely planned work. |
| 2 | Update README for Lab 2 requirements | Rewrote README to show Lab 2 scope, current implementation status, setup, current runnable commands, and phased implementation order. |
| 3 | Align `docs/lab-02/tests.md` with current structure/tooling | Replaced test doc with a phased plan tied to actual repo paths and current Vitest tooling, plus a newest-first results log section. |
| 4 | Create `agent.md` with strict working rules | Added workflow policy covering approval gates, FR/BR/AC mapping, test logging, AI-use updates, branch/worktree and PR approval requirements, and function-level commit strategy. |
| 5 | Create five GitHub issues with requirement mapping | Created issues #11 to #15 for requirement+AI baseline, user login surrogate, ticket creation, my tickets, and attachment lifecycle, each with FR/BR/AC traceability and acceptance criteria. |
| 6 | Refine documentation, review issue text for complete correctness, and prepare baseline commit | Audited doc files, fixed Lab 2 header in reviewer.md, cross-linked issues #11-#15 with prerequisite chains and FR/BR/AC criteria, updated tests.md results log, and committed baseline function-by-function. |

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Aligning test documentation to real folder/tooling early prevents command drift and broken CI expectations later.
3. Splitting Lab 2 into focused issues with explicit prerequisite links improves branch discipline and review quality.
