# Migration and Recovery Summary

DB-MIG-01 preserved prior User, Ticket, Attachment, Comment, and InternalNote rows and verified the exact Lab 4 indexes without adding a Ticket index.

DB-MIG-02 injected a late SQL failure, verified rollback, restored a paired disposable database and synthetic attachment fixture, and compared preserved state.

DB-MIG-03 rehearsed restore into a separate disposable database, applied the additive migration, accepted an Action write, and forward-recovered without restoring the old snapshot.

DB-MIG-04 verified byte-identical historical schema/migration fixtures, fail-closed override rules, explicit schema arguments, and normal pending/deploy/up-to-date migration paths.

Only redacted summaries are committed. Dumps, credentials, and attachment snapshots remain outside the repository.
