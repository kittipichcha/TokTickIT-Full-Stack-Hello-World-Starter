---
name: review-pr
description: "Use when: reviewing a PR for merge readiness — validates acceptance criteria against codebase, verifies test.md accuracy, checks for unused imports/dependencies, detects out-of-scope changes, checks for bugs, invalid test cases, edge cases, and suggests actionable fixes. Trigger phrases: review PR, merge check, PR review, is this ready to merge, reviewer agent."
agent: "agent"
argument-hint: "Review the active PR for merge readiness"
---

## Step 1 — Gather Context

1. Use `github-pull-request_currentActivePullRequest` to get the active PR (title, description, branch, changed files, comments).
2. **Identify the latest request change comment**:
   - From the PR's comments array, filter for comments where `commentType` is `"CHANGES_REQUESTED"` (or where the body contains a clear review verdict requesting changes).
   - Select the most recent such comment by timestamp (`createdAt` or `updatedAt`).
   - Extract the comment body and parse it for specific requested changes (e.g., P1/P2 blockers, bullet points, numbered items). This becomes the **latest requested changes** list.
   - **If no request change comment exists**, stop and ask the user for clarification. The review cannot proceed without a specific change request to validate against.
3. Read `AGENTS.md` at the repository root for technology-stack constraints and lab-scope restrictions (optional but recommended for context).
4. **Do not fetch linked issues or acceptance criteria**. The review is based solely on the latest request change comment.

---

## Step 2 — Validate Requested Changes

**Focus only on the latest request change comment identified in Step 1.** For each requested change (e.g., P1/P2 blockers, bullet points, numbered items):

1. **Trace it to the codebase** — find the exact file(s) and line(s) that implement the fix or address the change.
2. **Verify the change is addressed** — locate the code changes that directly respond to each requested change. If the requested change is about a bug, ensure the bug is fixed; if about missing test coverage, ensure tests are added; if about architectural issues, ensure the architecture is corrected.
3. **Check that the fix does not introduce regressions** — ensure the fix does not break existing functionality or tests.
4. **Check AGENTS.md compliance** — does the implementation respect the required technology stack (React + TypeScript + Vite + Bootstrap, Node.js + Express + TypeScript, PostgreSQL + Prisma, REST, Vitest + Supertest)? Are any forbidden libraries or frameworks introduced? (Optional but recommended for context.)

Report findings in a table:

| # | Requested Change | Status | Evidence (file:line) | Issue |
|---|-----------|--------|----------------------|-------|
| 1 | ... | ✅ Pass / ❌ Fail / ⚠️ Partial | ... | ... |

---

## Step 3 — Test Validation (Optional)

**Only perform this step if the latest request change comment involves test-related changes.** If the requested change mentions missing tests, test coverage, or bug validation, then:

1. Locate the relevant test files (`.test.ts`, `.test.tsx`, `.integration.test.ts`) in `server/tests/` and `client/tests/`.
2. For each requested change that involves tests:
   - **Exists?** — does the corresponding test file and test case actually exist?
   - **Runs?** — is the test wired into the test runner (Vitest config)?
   - **Valid?** — does the test case correctly test the intended functionality? Check for:
     - Logical bugs in test assertions
     - Misuse of mocking or test doubles
     - Incorrect expected values or edge cases
   - **Edge Cases Covered?** — does the test include edge cases relevant to the requested change?
3. **Check for bugs in implementation** — review the implementation code for:
   - Common bugs (off-by-one errors, race conditions, memory leaks)
   - Security vulnerabilities (SQL injection, XSS, improper validation)
   - Performance issues (unnecessary re-renders, N+1 queries)
   - Error handling gaps (unhandled exceptions, missing validation)

Report findings in a table:

| # | Test / Implementation Check | Status | Evidence (file:line) | Issue |
|---|----------------------|---------|------------------------|-------|

---

## Step 4 — Code Quality Check (Optional)

**Only perform this step if the latest request change comment mentions code quality issues (unused imports, dependencies, TypeScript errors).** If not, skip.

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

## Step 5 — Scope Relevance Check (Optional)

**Only perform this step if the latest request change comment mentions scope creep or out-of-scope changes.** If not, skip.

Check whether any changed files or modifications are unrelated to the requested change. Flag any change that:

- Implements functionality not mentioned in the requested change comment.
- Belongs to a later lab (e.g., authentication before it's assigned, image upload before it's assigned).
- Modifies infrastructure/config in ways unrelated to the requested change.
- Introduces new dependencies not justified by the requested change.

Report findings:

| File | Change | Why Out-of-Scope | Suggested Action |
|------|--------|------------------|------------------|

---

## Step 6 — Final Verdict & Actionable Fixes

Summarize with one of:

- **✅ Approved** — all requested changes from the latest comment are addressed, no regressions introduced.
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