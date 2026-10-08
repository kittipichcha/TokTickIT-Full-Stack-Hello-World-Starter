# Issue #55 — integrated staging verification

Base: `ed91b191ed44c3cb71de1ae61484f91e32b98e28` from remote `lab4-staging`.
Branch/worktree: `feature/lab4-integration-release`, `issue-55-worktree`.
Remote main remains `9fe2bd3ad6a1c80aaa4578f3ad18b1be76aa08d6`.
Verification includes the working implementation diff. The final executable fingerprints,
runner manifests and Git comparison identify the tested source independently of the later
evidence-document commit; HEAD alone did not describe the uncommitted test runs.

| Gate | Result | Raw evidence |
| --- | --- | --- |
| Complete backend / real DB / migration / seed / concurrency / performance | 681 passed, 0 failed/skipped, 47 files; exit 0, 1,444.72 s, pristine seeded DB | `server-final-test.log`, `server-final-results.json`, `server-final-manifest.json` |
| Complete component regression on final CSS and consequence assertions | 366 passed, 0 failed/skipped, 23 files; exit 0 | `client-test.log`, `client-results.json`, backend/component report |
| Complete configured browser regression | 294 passed, 0 failed/skipped/flaky, 18 files across desktop/tablet/mobile; exit 0, 1,916,091.506 ms | `staging/playwright.txt`, `staging/playwright.json`, `staging/playwright-manifest.json` |
| Affected browser hardening/Actions/workflow/visual slices | 45 passed, 0 failed/skipped/flaky; exit 0, 237,419.862 ms | `staging/browser-affected.txt`, `staging/browser-affected.json` |
| Final builds, Prisma validation/status | Server/client build, normal Prisma validation and eight-migration up-to-date status passed; command exits checked | `server-build.log`, `client-build.log`, build manifests, `prisma-validate.log`, `prisma-status.log` |
| Five README procedures | Passed: setup, seed, migration, tests and demo, with canonical preservation/recovery and actual role journeys | `clean-checkout-results.md`, `staging/rehearsal/` |
| Actual image inspection | See image ledger; geometry is separate proof. 105 final Lab 4 PNGs copied and hashed; 76 known historical Lab 2/3 generated images restored to baseline | `visual-review.md`, `staging/screenshot-inventory.json`, `staging/historical-output-restoration.json` |
| Acceptance and handout reconciliation | All 27 approved product AC and 41 preserved Test DD rows pass current staging evidence; final release obligations remain Pending | `acceptance-matrix.md`, `final-gate.md`, Test DD |

PERF-01 used 1,000 Tickets and 3,000 Actions, five warmups and 20 measured samples per
role. The nineteenth sorted sample (nearest-rank p95) was 26.7344 ms / 5,529 bytes for
Requester and 43.4827 ms / 18,607 bytes for Staff, below 1,000 ms and 65,536 bytes.
Raw final samples: `staging/performance-requester.json`, `staging/performance-staff.json`.
Only their two known historical issue #54 generated copies were restored to baseline.
All 182 final executable hashes match the tested bytes; independent source/image/docs
reviews found no introduced blocking defect. Final aggregate review is recorded separately.

Authored source, Markdown and JSON pass `git diff --cached --check`. Raw runner `.txt`/`.log`
files retain their original spaces/blank lines, and `source-diff.patch` retains required Git
context-line spaces; those generated paths are explicitly excluded from the whitespace check.
An auxiliary PowerShell per-project count checker failed on null recursion and was stopped;
the corrected null-safe Node JSON audit verifies 98 desktop + 98 tablet + 98 mobile cases.
Neither diagnostic changed executable source or the final runner reports.

## Retained diagnostics and bounded fixes

- The first browser attempt stopped before useful certification when prerequisites were not
  yet complete. Its log is retained; there is no completed report or passing count.
- A complete development browser run reported 45 passed / 12 failed, and the next reported
  48 passed / 9 failed. Their JSON/logs remain in `staging/browser-focused-*-failure*`.
  Early mismatches were test assumptions about accessible heading/status text, Back links,
  initially collapsed history, and preserved Create Ticket success state. Specific legitimate
  disabled priority/pagination/validation controls now require an actual known explanation.
  These development failures are not final certification or unexplained successful retries.
- A valid unbroken Action description exposed a real committed-success-snapshot overflow.
  The card already wrapped correctly. The independently reviewed packet in `hardening-fix.md`
  scopes the production change to `.actions-taken .success-box { overflow-wrap: anywhere; }`.
  The affected 45-case run passes the real accepted edit/save plus no-page-overflow assertion
  at desktop, tablet and mobile. The failure image is retained under `staging/diagnostics/`.
- The first component run's worker-contention timeout and its isolated/complete reproductions
  remain documented in `backend-component-verification.md`; no timeout or expectation was
  weakened. The final sequential full component report contains all 366 tests.
- The first backend attempt lacked seed prerequisites and did not produce a completed overnight
  JSON report. A subsequent seeded attempt inherited dirty fixture identities from that interrupted
  database. The unchanged affected API contracts pass 51 focused tests on a pristine seeded DB;
  the final complete run passes all 681 tests on that fresh database. Prior incomplete output is retained, with
  no fabricated exit or aggregate count. The final report names are `server-final-test.log`,
  `server-final-results.json` and `server-final-manifest.json`.
- Windows denied ordinary runtime setup and held the Prisma DLL during concurrent processes.
  Approved execution restored actual validation; the runner-free explicit generation retry
  completed successfully. These are environment diagnostics, not product failures or passes.

Synthetic migrations/restores and injected presentation failures do not claim a live deployment
or production incident. The preserved eight migrations and paired DB/files recovery are tested
through their canonical suites. Human #55 approval, main merge/new main runs, board completion
and the final nine-part PDF remain separate pending gates. This package does not close #55 or
pretend an agent review is a human review.
