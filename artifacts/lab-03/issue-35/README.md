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
| [`server-vitest.txt`](./server-vitest.txt) | Server suite at head SHA: **368 passed / 30 files** (incl. full Lab 2 regression + `server/tests/lab-03/*`). |
| [`client-vitest.txt`](./client-vitest.txt) | Client suite at head SHA: **107 passed / 10 files** (incl. `client/src/lab-03-tests/*`). |
| [`server-build-validate.txt`](./server-build-validate.txt) | `npx prisma validate` valid; `npx prisma migrate status` clean (7 migrations); server `npm run build` (`tsc`) exit 0. |
| [`client-build.txt`](./client-build.txt) | Client `npm run build` (`tsc && vite build`) exit 0. |
| [`db-mig-execution.txt`](./db-mig-execution.txt) | **B-4:** DB-MIG-01..05 **executed** (not skipped) and passed against the Lab-3-migrated database. |
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
cd server && npx vitest run tests/lab-03/migration.integration.test.ts --reporter=verbose  # -> db-mig-execution.txt
```

## Non-deployable intermediate state

Per DM-17 / the #35 Definition of Done, this branch is **not deployed** and is **not** a
fully authenticated application. The auth surface coexists with the header-gated legacy
Lab 2 routes until #37 Rev 12 RR-01 deletes the declared compatibility set. `E2E-01..04`
are owned by #42 and are **not** claimed complete by this issue.
