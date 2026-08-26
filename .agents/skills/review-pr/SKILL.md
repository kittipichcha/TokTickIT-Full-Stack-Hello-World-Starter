---
name: review-pr
description: "Use when: reviewing a PR for merge readiness — validates acceptance criteria against codebase, verifies test.md accuracy, checks for unused imports/dependencies, detects out-of-scope changes, and suggests actionable fixes. Trigger phrases: review PR, merge check, PR review, is this ready to merge, reviewer agent."
agent: "agent"
argument-hint: "Review the active PR for merge readiness"
---

## Step 1 — Gather Context

1. Use `github-pull-request_currentActivePullRequest` to get the active PR (title, description, branch, changed files).
2. From the PR description, extract:
   - The linked GitHub Issue number(s) (e.g., `Closes #4`, `Fixes #12`).
   - Any acceptance criteria or checklist written in the PR body.
   - **If no issue is linked**, stop and ask the user to provide the issue number(s) before continuing. Do not proceed without an issue reference.
3. Fetch each linked issue with `mcp_github_mcp_se_issue_read` and extract its **acceptance criteria**, **definition of done**, and **requirements**.
4. Read the project `README.md` at the repository root.
5. Read `AGENTS.md` at the repository root for technology-stack constraints and lab-scope restrictions.

---

## Step 2 — Acceptance Criteria vs. Codebase & README

For every acceptance criterion found in the issue(s) and PR description:

1. **Trace it to the codebase** — find the exact file(s) and line(s) that implement it.
2. **Check README alignment** — does the README document the feature correctly? Are setup steps, environment variables, and run commands accurate?
3. **Check AGENTS.md compliance** — does the implementation respect the required technology stack (React + TypeScript + Vite + Bootstrap, Node.js + Express + TypeScript, PostgreSQL + Prisma, REST, Vitest + Supertest)? Are any forbidden libraries or frameworks introduced?
4. **Flag gaps** — any criterion with no corresponding implementation, or any implementation with no corresponding criterion or documentation (including requirements.md, api-spec.md, ui-spec.md and tests.md), should be flagged as an issue. Please note that small refactors, renames, helper extractions, or formatting changes are considered out-of-scope unless explicitly mentioned in the issue.

Report findings in a table:

| # | Criterion | Status | Evidence (file:line) | Issue |
|---|-----------|--------|----------------------|-------|
| 1 | ... | ✅ Pass / ❌ Fail / ⚠️ Partial | ... | ... |

---

## Step 3 — Test Plan Validation (`tests.md`)

1. Locate the relevant `docs/lab-XX/tests.md` file for the current lab.
2. Read every test file referenced or implied by `tests.md` in both `server/tests/` and `client/tests/`.
3. For each test case listed in `tests.md`:
   - **Exists?** — does the corresponding test file and test case actually exist?
   - **Runs?** — is the test wired into the test runner (Vitest config)?
   - **Aligns?** — does the test verify behavior that matches an acceptance criterion from the issue?
   - **No conflicts?** — does the test conflict with any other test (e.g., shared mutable state, port conflicts)?
4. **Check for unnecessary tests** — are there test cases that test behavior outside the scope of the linked issues?
5. **Check for missing coverage** — are there acceptance criteria with no corresponding test?
6. **E2E coverage** — if Playwright/E2E tests are expected, verify they exist and cover the required user flows.
7. **Check the requested changed in the PR** -- check whether the test and codebase cover the change requested in the PR.

Report findings in a table:

| # | Test (from tests.md) | Exists? | Aligns with Criterion? | Issue |
|---|----------------------|---------|------------------------|-------|

---

## Step 4 — Unused Imports & Dependencies

1. For every changed source file (`.ts`, `.tsx`):
   - Check for **unused imports** — symbols imported but never referenced in the file.
   - Check for **unused variables/functions** — declared but never used.
2. Check `client/package.json` and `server/package.json`:
   - Are all `dependencies` and `devDependencies` actually imported/used somewhere in the codebase?
   - Are there any packages that are imported but missing from `package.json`?
3. Attempt to run `npx tsc --noEmit` in both `client/` and `server/`. If `node_modules` is not installed, fall back to static analysis of imports. Report any TypeScript errors found.

Report findings:

| File | Unused Import / Dep | Suggested Fix |
|------|---------------------|---------------|

---

## Step 5 — Out-of-Scope Detection

Apply **strict** scope checking: every change must be traceable to an acceptance criterion from a linked issue.

1. Compare every changed file against the PR description and linked issues.
2. Flag any file or change that:
   - Implements functionality not mentioned in any acceptance criterion (including small refactors, renames, helper extractions, or formatting changes — if it's not in the issue, flag it).
   - Belongs to a later lab (e.g., authentication before it's assigned, image upload before it's assigned).
   - Modifies infrastructure/config in ways unrelated to the issue (e.g., reformatting unrelated files, changing CI config without reason).
   - Introduces new dependencies not justified by the issue.
3. Check `AGENTS.md` lab-scope restrictions — flag anything that implements later-lab functionality early.

Report findings:

| File | Change | Why Out-of-Scope | Suggested Action |
|------|--------|------------------|------------------|

---

## Step 6 — Final Verdict & Actionable Fixes

Summarize with one of:

- **✅ Approved** — all criteria pass, tests align, no unused code, no scope creep.
- **⚠️ Changes Requested** — issues found; each has a concrete, actionable fix suggestion below.
- **🔴 Needs Discussion** — ambiguous requirements, conflicting criteria, or decisions the reviewer cannot resolve alone.

For every issue found, provide an **actionable fix** in the format:

> **Fix for [issue]:** In `path/to/file.ts`, [specific change]. Run `[command]` to verify.

---

## Constraints

- Stay within the TokTickIT technology stack: React + TypeScript + Vite + Bootstrap (client), Node.js + Express + TypeScript + PostgreSQL + Prisma (server), Vitest + Supertest (testing).
- Do not suggest introducing forbidden libraries (Next.js, Tailwind, MySQL, Drizzle, GraphQL, etc.).
- Reference exact file paths and line numbers in all findings.
- If you cannot determine something (e.g., a test requires a running database), state that clearly rather than guessing.