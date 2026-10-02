# Migration and Recovery Summary

DB-MIG-01 preserved prior User, Ticket, Attachment, Comment, and InternalNote rows (full-row snapshots) and verified the exact Lab 4 indexes without adding a Ticket index.

DB-MIG-02 injected a late SQL failure, verified rollback, damaged the synthetic attachment store, then restored the paired disposable database and synthetic attachment snapshot together and compared preserved state and attachment hashes.

DB-MIG-03 rehearsed restore into a separate disposable database, applied the additive migration, accepted an Action write performed by an active IT Staff user, and forward-recovered without restoring the old snapshot while preserving the accepted Action and Lab 3 data.

DB-MIG-04 verified the pinned byte-identical historical schema (`server/tests/lab-03/fixtures/lab3-final-schema.prisma`, SHA-256 `7b5c5aceb173a4198731de90d3492d1f38861943099ea1fc5c2c85f6b31b5070`) and seven migrations, fail-closed override rules, explicit schema arguments, and the normal pending/deploy/up-to-date migration path via the server-local Prisma CLI.

Only redacted summaries are committed. Dumps, credentials, and attachment snapshots remain outside the repository.
