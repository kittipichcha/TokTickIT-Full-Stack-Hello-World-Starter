# Issue #38 PR #49 Review Remediation Evidence

Date: 2026-09-24
Tested source SHA before evidence commit: `674ea4f293de6866f54dec9aad4bc5eecb4e4e48`
Branch: `feature/issue-38-staff-ticket-operations`

## Scope

- B1 / `API-49-CREAD-01`: real-session IT Staff and Administrator Public Comment reads.
- B2 / `UI-49-SAFE-01/02`: literal DOM rendering for Public Comments and Internal Notes.
- B3 / `API-49-FAIL-01..04`: canonical unexpected-failure containment and healthy recovery.
- B4 / `UI-49-RACE-01`: delayed Staff Detail refresh ordering and newer-result preservation.

## Commands and Logs

Run from `C:/Users/kitti/CPE334`:

- `npm --prefix issue-38-worktree/client test -- src/lab-03-tests/CommentThread.test.tsx src/lab-03-tests/InternalNoteThread.test.tsx src/lab-03-tests/StaffTicketDetail.test.tsx` -> `focused-client.txt`
- `npm --prefix issue-38-worktree/client test` -> `full-client.txt`
- `npm --prefix issue-38-worktree/client run build` -> `client-build.txt`
- `npm --prefix issue-38-worktree/server test -- tests/lab-03/comments-notes.api.test.ts tests/lab-03/staff-queue.api.test.ts tests/lab-03/staff-ticket-detail.api.test.ts` -> `focused-server.txt`
- `npm --prefix issue-38-worktree/server test` -> `full-server-summary.txt`; the interrupted
	rerun is retained separately as `full-server-interrupted.txt` and is not pass evidence.
- `npm --prefix issue-38-worktree/server run build` -> `server-build.txt`
- `git -C issue-38-worktree diff --check` -> `diff-check.txt`
- `git -C issue-38-worktree rev-parse HEAD` -> `source-sha.txt`

## Evidence Boundary

The focused and full unit/API suites and builds do not claim browser/E2E, responsive, accessibility, release, or human-review approval. Those remain Issue #42 and reviewer-owned gates. The completed full server result was 38 files / 539 tests passed; the separate interrupted rerun is disclosed above. No environment secrets are included in this bundle.
