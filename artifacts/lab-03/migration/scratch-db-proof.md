# Lab 3 Scratch-DB Proof — Issue #35 (DM-13 / DM-18)

**Date:** 2026-09-17
**Branch:** `feature/issue-35-identity-db-migration-auth`
**Prisma:** 5.22.0 (pinned — not upgraded)
**Scratch DB:** `tocktick_lab3_scratch` (PostgreSQL 18, localhost:5432)

## Purpose

Prove the frozen migration-history mechanism (apply-then-resolve) and the two-phase
orchestrator work on pinned Prisma 5.22 **before** feature implementation, per the
stop-and-report gate (review Rev8 §4.5 / plan Step 3).

## 1. Apply-then-resolve mechanism (Prisma 5.22)

The orchestrator applies each tracked migration's SQL out-of-band (via psql), then records
it with `prisma migrate resolve --applied`.

- Out-of-band SQL application: ✅ works
- `prisma migrate resolve --applied <migration>`: ✅ **"Migration ... marked as applied."**
- `prisma migrate status` after resolve: ✅ **"Database schema is up to date!"**
- Every `_prisma_migrations` record ↔ a real tracked directory: ✅ (7 records ↔ 7 dirs)

**Key assumption validated:** Prisma 5.22's `migrate resolve --applied` accepts a pending
tracked migration after out-of-band SQL execution. **No misbehavior — no stop-and-report
triggered.**

## 2. Full orchestrator run (fresh Lab 2 baseline)

Command: `npx tsx src/migrate-lab3.ts run` against a fresh Lab-2-shaped scratch DB
(5 Lab 2 migrations + seed: 5 DevRequesters, 4 categories, 6 systems).

```
[migrate-lab3] Stage-1 preflight: input state = fresh
[migrate-lab3] Applying Phase A (20260917000000_lab3_phase_a_expand) out-of-band...
[migrate-lab3] Backfilling 5 DevRequester rows into User...
[migrate-lab3] Post-backfill verification passed (isRemoved invariant, FK integrity, counts).
[migrate-lab3] Applying Phase C (20260917000001_lab3_phase_c_contract) out-of-band...
[migrate-lab3] Migration complete: migrate status clean; final schema validated.
```

Post-run verification:
- `prisma migrate status`: ✅ 7 migrations, up to date
- `prisma migrate diff --from-url <db> --to-schema-datamodel schema.prisma`: ✅ **No difference detected**
- 5 DevRequesters → 5 Users, exact ID preservation (1–5), `role=REQUESTER`,
  `mustChangePassword=true`, `passwordHash` length 60
- All §9.3 timestamps now `timestamp with time zone` (DM-TIME-01): ✅
  (`Category.createdAt`, `RelatedSystem.createdAt`, `Ticket.createdAt/updatedAt`,
  `Attachment.uploadedAt/removedAt`, `User.createdAt/updatedAt`)
- `Attachment.uploaderUserId` NOT NULL; `removedByUserId` nullable; `isRemoved` preserved;
  legacy requester columns dropped; `DevRequester` dropped

## 3. Collision abort + recovery (DM-18)

### Subcase A — duplicate normalized email
- Injected a 6th DevRequester with email `ADA@example.com` (normalizes to `ada@example.com`,
  colliding with id 1).
- Orchestrator output:
  ```
  MigrationCollisionError: 1 collision(s) block the migration.
    - Duplicate normalized email "ada@example.com" between DevRequester id 1 and 6
  Database left in the documented Phase-A-applied state. ...
  ```
- Post-abort state: ✅ `User` = 0 rows (no backfill), `DevRequester` = 6 (unchanged),
  Phase A applied + recorded only.

### Recovery / resume
- Fixed the collision source (`DELETE FROM "DevRequester" WHERE id=6`).
- Re-ran orchestrator:
  ```
  [migrate-lab3] Stage-1 preflight: input state = phase-a-applied
  [migrate-lab3] Resuming: Phase A already applied ...; skipping apply.
  [migrate-lab3] Backfilling 5 DevRequester rows into User...
  [migrate-lab3] Migration complete: migrate status clean; final schema validated.
  ```
- Final: ✅ 5 Users, `migrate status` clean, `No difference detected`.

## 4. Conclusion

The apply-then-resolve migration-history mechanism and the two-phase orchestrator
(Stage-1 preflight → Phase A → Stage-2 scan → backfill → post-backfill verification →
Phase C → post-checks) are **proven on pinned Prisma 5.22**. The collision guard aborts
loudly before any `User` write and leaves the documented Phase-A-applied state; the
recovery/resume procedure completes the migration. **No stop-and-report gate was triggered.**