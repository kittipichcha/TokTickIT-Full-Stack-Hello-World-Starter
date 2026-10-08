# Migration and Recovery Summary

DB-MIG-01 preserved prior User, Ticket, Attachment, Comment, and InternalNote rows (full-row snapshots) and verified the exact Lab 4 indexes without adding a Ticket index.

DB-MIG-02 injected a real failing Prisma deploy, inspected its unfinished migration record
(`finished_at` remained null), and recorded whether partial DDL left the probe object behind
without assuming automatic or complete SQL rollback. With no accepted Lab 4 write, it
damaged the synthetic attachment store, restored the matching database and attachment
snapshots into the separate disposable target, then compared preserved state, migration
rows, indexes and attachment hashes. The restored target contained neither the failed
migration nor its probe object. This is a synthetic pre-write recovery rehearsal, not
evidence of a live deployment incident.

DB-MIG-03 rehearsed restore into a separate disposable database, applied the additive migration, accepted an Action write performed by an active IT Staff user, and forward-recovered without restoring the old snapshot while preserving the accepted Action and Lab 3 data.

DB-MIG-04 verified the pinned byte-identical historical schema (`server/tests/lab-03/fixtures/lab3-final-schema.prisma`, SHA-256 `7b5c5aceb173a4198731de90d3492d1f38861943099ea1fc5c2c85f6b31b5070`) and seven migrations, fail-closed override rules, explicit schema arguments, and the normal pending/deploy/up-to-date migration path via the server-local Prisma CLI.

Only redacted summaries are committed. Dumps, credentials, and attachment snapshots remain outside the repository.
