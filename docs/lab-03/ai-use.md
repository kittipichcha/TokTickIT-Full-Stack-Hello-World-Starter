# Lab 3 - AI Use and Reflection

**LLM/agent used:** GitHub Copilot (DeepSeek V4 Flash 0731)

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Create `lab3-staging` from `main` and a worktree/branch for Issue #34 | Created `lab3-staging`, pushed it, and created worktree `issue-34-sprint-3-contract` on branch `feature/issue-34-sprint-3-contract`. |
| 2 | Plan the Sprint 3 engineering contract using the planning skill | Researched the Lab 2 baseline, the Lab 3 handout, and the repository conventions, then produced a feature-by-feature plan. |
| 3 | Confirm open decisions (auth mechanism, hashing, status matrix, queue defaults, comment limits) | Locked in session-cookie auth, bcrypt, drafted status matrix, queue defaults, and comment length limits. |
| 4 | Draft `docs/lab-03/specification.md` | Produced the Sprint 3 engineering specification with FR/BR, authorization matrix, status matrix, migration inventory, AC, and DoD. |
| 5 | Draft `docs/lab-03/api-spec.md` | Produced the REST API contract with auth/session decisions and all endpoints. |
| 6 | Draft `docs/lab-03/ui-spec.md` | Produced the Zen Green UI contract for all Lab 3 screens. |
| 7 | Draft `docs/lab-03/tests.md` | Produced the test design and traceability matrix in the Lab 2 format, with every AC mapped to a planned test. |

## Reflection
1. A strict process baseline before feature coding reduces confusion and keeps implementation traceable to FR/BR/AC.
2. Reusing the established Lab 2 documentation format avoids inventing new conventions and keeps the contract consistent.
3. Freezing the authorization and status matrices during specification prevents downstream implementation churn.
4. Every Acceptance Criterion must map to at least one planned test before implementation begins.
5. The contract must be reviewed and approved before dependent implementation issues begin.

## Issue #34 Implementation Entry

- Prompt summary: Create the Sprint 3 engineering contract (Spec DD + Test DD) for Issue #34 from the Lab 3 handout and Lab 2 baseline.
- What was done with output: Created `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `ai-use.md`, and `reviewer.md` in the `issue-34-sprint-3-contract` worktree.
- Reflection: This issue produces documentation only; no implementation code was changed. Test rows are all `Planned` and will be executed by downstream issues.

## Issue #34 Contract-Freeze Revision Entry

- Prompt summary: After peer review, freeze the two remaining contract decisions that were previously left to implementation: the exact password policy and the exact migrated-Requester initial-password derivation.
- What was done with output: Revised the engineering contract to explicitly freeze:
  - **Password policy** (specification.md BR-10 and Section 13 decision 12): 12–128 characters; at least one uppercase ASCII letter, one lowercase ASCII letter, one digit, and one ASCII special character; not trimmed before validation; whitespace permitted; no reuse/history rule. Propagated to `api-spec.md` (change-password, admin create user, admin initial-password) and `ui-spec.md` (Change Password screen), and strengthened `API-AUTH-07` in `tests.md`.
  - **Migrated-Requester initial-password derivation** (specification.md Section 9.2 and Section 13 decision 13): `Lab3-` + first 20 hex chars of SHA-256(lowercase(trim(email)) + ":" + trim(name)), encoded as lowercase hex. The seed module implements this frozen rule; it does not define it. Strengthened `DB-MIG-03` in `tests.md` to verify the exact derivation and repeated-run determinism.
- Reflection: The two decisions were contract decisions, not implementation details, so they had to be frozen before implementation. The specification is now the single source of truth for both the password policy and the migration derivation; no document defers either decision to the seed module.