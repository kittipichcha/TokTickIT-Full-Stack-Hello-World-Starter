# Issue #35 — Evidence Bundle

**Issue:** #35 — Lab 3 #2: Identity, Database Migration & Authentication
**Branch:** `feature/issue-35-identity-db-migration-auth`
**Base:** `origin/lab3-staging` @ `749aa966` (PR #45 merge)
**Head SHA at capture:** see [`head-sha.txt`](./head-sha.txt)
**Captured:** 2026-09-17

This bundle is the executable evidence for #35's `Passed` rows. It implements #35 Rev 13's
**Evidence Plan** and answers the PR #46 review findings B-2 (evidence), B-4 (DB-MIG
execution) and B-6 (ground-truth compliance map). Every `Passed` claim in
`docs/lab-03/tests.md` is backed by a run recorded here.

## Contents

| File | Proves |
|---|---|
| [`head-sha.txt`](./head-sha.txt) | The exact commit the evidence refers to. |
| [`server-vitest.txt`](./server-vitest.txt) | Server suite at head SHA (incl. full Lab 2 regression + `server/tests/lab-03/*`). |
| [`client-vitest.txt`](./client-vitest.txt) | Client suite at head SHA (incl. `client/src/lab-03-tests/*`). |
| [`server-build-validate.txt`](./server-build-validate.txt) | `npx prisma validate` valid; `npx prisma migrate status` clean; server `npm run build` (`tsc`) exit 0. |
| [`client-build.txt`](./client-build.txt) | Client `npm run build` (`tsc && vite build`) exit 0. |
| [`db-mig-execution.txt`](./db-mig-execution.txt) | **B-4:** DB-MIG-01..05, DB-MIG-PRESERVE-01/02, MIG-FAIL-01/02/03 **executed** (not skipped) and passed against isolated Lab 2 fixtures. |
| [`seed-execution.txt`](./seed-execution.txt) | **B-4/B-5:** SEED-01, SEED-TKT-01..04, SEED-IDEMP-01/02, SEED-COLLISION-01, SEED-COMMENT-01, SEED-NOTE-01 executed and passed. |
| [`client-api-error.txt`](./client-api-error.txt) | **B-3:** UNIT-API-ERROR-01/02/03 executed and passed. |
| [`grep-gate.txt`](./grep-gate.txt) | DM-17 grep gate: zero `prisma.devRequester` references; all legacy identifiers confined to the declared set. Plus `git diff --check`, conflict-marker grep, and `.env`-not-tracked proof. |
| [`compliance-map.md`](./compliance-map.md) | **B-6:** frozen requirement → implementation → test mapping quoting `specification.md` §9.2/§9.3/§13 and `api-spec.md` §0–§4. |
| [`lab2-test-changes.md`](./lab2-test-changes.md) | **Review step 7:** every Lab 2 test adaptation vs the baseline, classified, with per-test justification. Seeds #37 RR-04's audit. |

## Related evidence (pre-existing, retained)

| File | Proves |
|---|---|
| [`../migration/scratch-db-proof.md`](../migration/scratch-db-proof.md) | DM-13/DM-18: apply-then-resolve on Prisma 5.22, full orchestrator run, and the collision → recovery → resume demonstration. |
| [`../migration/integration-gate.md`](../migration/integration-gate.md) | DM-17 handoff integration gate (clean checkout → generate → build → regression → legacy + auth smoke) and the grep gate. |

## Verification commands

```bash
cd server && npx vitest run            # -> server-vitest.txt
cd client && npx vitest run            # -> client-vitest.txt
cd server && npx prisma validate && npx prisma migrate status && npm run build
cd client && npm run build
cd server && npx vitest run tests/lab-03/migration.integration.test.ts  # -> db-mig-execution.txt
cd server && npx vitest run tests/lab-03/seed.integration.test.ts       # -> seed-execution.txt
cd client && npx vitest run src/lab-03-tests/ApiClient.test.ts          # -> client-api-error.txt
```

## Non-deployable intermediate state

Per DM-17 / the #35 Definition of Done, this branch is **not deployed** and is **not** a
fully authenticated application. The auth surface coexists with the header-gated legacy
Lab 2 routes until #37 Rev 12 RR-01 deletes the declared compatibility set. `E2E-01..04`
are owned by #42 and are **not** claimed complete by this issue.
