# REL-12 Integrated Lab 2 to Lab 3 Migration Run

- Date: 2026-09-26
- Tested implementation SHA: `ce2e40ddf049cf7cf62b43280a563b750622a0a4`
- Environment: Windows, Node.js, Vitest 4.1.10, PostgreSQL
- Disposable connection: `E2E_DATABASE_URL` from ignored `server/.env`; its value is not recorded
- Test: `server/tests/lab-03/migration.integration.test.ts`
- Execution: Vitest was run with `DATABASE_URL` overridden in-process to the disposable
  `E2E_DATABASE_URL`. The fixture creates and drops its unique
  `tocktick_lab3_mig05_<pid>` database in that PostgreSQL cluster.
- Result: 1 test file passed; 19 tests passed, 0 failed, 0 skipped; duration 644.26 seconds.
- Coverage: real Lab 2-shaped migration, requester/ticket/attachment preservation, deterministic
  migrated-user password and forced change, collision detection, failure atomicity, and resume.
- Safety: no ordinary `DATABASE_URL` value was used, printed, or committed. The disposable
  fixture database was removed by the test cleanup.

Vitest printed expected diagnostics from deliberate collision, failure-injection, and invariant
tests. The process exited successfully; these diagnostics are not suite failures.