/**
 * Lab 4 migration and recovery integration tests (Issue #51 — DB-MIG-01/02/03).
 *
 * These tests exercise the REAL additive Lab 4 migration against a disposable
 * Lab 3 baseline database, and prove the BR-32 recovery boundary:
 *   - DB-MIG-01: additive migration preserves every prior row and adds exactly
 *     the required Lab 4 structures (no new Ticket index).
 *   - DB-MIG-02: a pre-write migration failure restores the paired DB +
 *     attachment snapshots with exact preservation.
 *   - DB-MIG-03: a snapshot rehearsal into a separate empty database, then a
 *     post-write forward recovery that preserves an accepted Lab 4 write.
 *
 * Every database is disposable and dropped in `finally`; snapshots live in the
 * OS temp directory and are deleted in `finally`.
 */

import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLab3Baseline,
  applyLab4Migration,
  createDisposableDb,
  dumpDatabase,
  restoreDatabase,
  createSyntheticAttachmentStore,
  snapshotSyntheticAttachmentStore,
  verifyAttachmentHashes,
  createFailingMigrationTree,
  runPrismaMigrateDeploy,
  query,
  count,
  tableExists,
  migrationApplied,
  indexNames,
  LAB4_MIGRATION_NAME,
  FAILING_MIGRATION_NAME,
  LAB3_PHASE_A,
  LAB3_PHASE_C,
} from "./helpers/migration-fixture.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

/** The synthetic attachment store mirrors the fixture's single Attachment row. */
const ATTACHMENT_FILES = { "stored-normal.txt": "synthetic attachment contents" };

/** Captures the preserved Lab 3 data that must survive the Lab 4 migration. */
async function snapshotPreserved(dbUrl: string) {
  const users = await query(dbUrl, `SELECT * FROM "User" ORDER BY id`);
  const tickets = await query(
    dbUrl,
    `SELECT id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description,
            "requestedPriority", "itPriority", "ticketOwnerId", "currentStatus", "appearsResolved", "createdAt", "updatedAt"
     FROM "Ticket" ORDER BY id`,
  );
  const attachments = await query(dbUrl, `SELECT * FROM "Attachment" ORDER BY id`);
  const comments = await query(dbUrl, `SELECT * FROM "Comment" ORDER BY id`);
  const notes = await query(dbUrl, `SELECT * FROM "InternalNote" ORDER BY id`);
  return { users, tickets, attachments, comments, notes };
}

function expectAttachmentReferences(
  snapshot: Awaited<ReturnType<typeof snapshotPreserved>>,
  hashes: Map<string, string>,
): void {
  expect(snapshot.attachments.map((attachment) => attachment.storedFilename)).toEqual([...hashes.keys()]);
}

describe("DB-MIG-01: additive Lab 4 migration preserves Lab 3 data", () => {
  itIfDb(
    "preserves every prior row, adds zero Actions, keeps legacy resolvedAt NULL, and adds exact indexes",
    async () => {
      const db = buildLab3Baseline("lab4mig01");
      const store = createSyntheticAttachmentStore(ATTACHMENT_FILES);
      const attachmentSnapshot = snapshotSyntheticAttachmentStore(store);
      try {
        // A legacy Resolved Ticket: status set before Lab 4, resolvedAt column does not exist yet.
        await query(db.dbUrl, `UPDATE "Ticket" SET "currentStatus" = 'RESOLVED' WHERE id = 2`);

        const before = await snapshotPreserved(db.dbUrl);
        const ticketIndexesBefore = await indexNames(db.dbUrl, "Ticket");

        applyLab4Migration(db);

        const after = await snapshotPreserved(db.dbUrl);

        // --- Every preserved row is byte-for-byte identical ---
        expect(after.users).toEqual(before.users);
        expect(after.tickets).toEqual(before.tickets);
        expect(after.attachments).toEqual(before.attachments);
        expect(after.comments).toEqual(before.comments);
        expect(after.notes).toEqual(before.notes);

        // --- Zero Actions; no synthetic history ---
        expect(await count(db.dbUrl, "ActionTaken")).toBe(0);
        expect(await count(db.dbUrl, "ActionTakenRevision")).toBe(0);
        expect(await count(db.dbUrl, "TicketStatusChange")).toBe(0);
        expect(await count(db.dbUrl, "ActionCreateIdempotency")).toBe(0);

        // --- Ticket.version initialized to 1; legacy Resolved resolvedAt stays NULL ---
        const versions = await query<{ id: number; version: number; resolvedAt: string | null }>(
          db.dbUrl,
          `SELECT id, version, "resolvedAt" FROM "Ticket" ORDER BY id`,
        );
        for (const row of versions) {
          expect(row.version).toBe(1);
          expect(row.resolvedAt).toBeNull();
        }

        // --- Exact Lab 4 indexes and the idempotency unique constraint exist ---
        expect(await indexNames(db.dbUrl, "ActionTaken")).toEqual([
          "ActionTaken_assigneeUserId_status_createdAt_id_idx",
          "ActionTaken_performedByUserId_createdAt_id_idx",
          "ActionTaken_pkey",
          "ActionTaken_ticketId_createdAt_id_idx",
        ]);
        expect(await indexNames(db.dbUrl, "ActionTakenRevision")).toEqual([
          "ActionTakenRevision_actionId_editedAt_id_idx",
          "ActionTakenRevision_pkey",
        ]);
        expect(await indexNames(db.dbUrl, "TicketStatusChange")).toEqual([
          "TicketStatusChange_pkey",
          "TicketStatusChange_ticketId_changedAt_id_idx",
        ]);
        expect(await indexNames(db.dbUrl, "ActionCreateIdempotency")).toEqual([
          "ActionCreateIdempotency_actorUserId_route_key_key",
          "ActionCreateIdempotency_expiresAt_id_idx",
          "ActionCreateIdempotency_pkey",
        ]);

        // --- No new Ticket index was added ---
        expect(await indexNames(db.dbUrl, "Ticket")).toEqual(ticketIndexesBefore);

        // --- Attachment storage hashes are unchanged ---
        expect(verifyAttachmentHashes(store)).toBe(true);
        expect(store.hashes).toEqual(attachmentSnapshot.hashes);
        expectAttachmentReferences(after, attachmentSnapshot.hashes);

        // --- Migration history records the Lab 4 migration ---
        expect(await migrationApplied(db.dbUrl, LAB4_MIGRATION_NAME)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_A)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_C)).toBe(true);
      } finally {
        attachmentSnapshot.cleanup();
        store.cleanup();
        db.drop();
      }
    },
    300000,
  );
});

describe("DB-MIG-02: pre-write failure restores the paired snapshots", () => {
  itIfDb(
    "a real prisma migrate deploy failure is recovered by restoring the paired DB + attachment snapshots",
    async () => {
      const db = buildLab3Baseline("lab4mig02");
      const restoreTarget = createDisposableDb("lab4mig02restore");
      const store = createSyntheticAttachmentStore(ATTACHMENT_FILES);
      const attachmentSnapshot = snapshotSyntheticAttachmentStore(store);
      const tmp = mkdtempSync(join(tmpdir(), "lab4-mig02-"));
      const dumpPath = join(tmp, "baseline.dump");
      const failingTree = createFailingMigrationTree();
      try {
        // 1. The verified Lab 3 database is built by `buildLab3Baseline`.
        // 4. Record the pre-cutover baseline: IDs, values, counts, FKs/references,
        //    migration state, and attachment hashes.
        const before = await snapshotPreserved(db.dbUrl);
        const ticketIndexesBefore = await indexNames(db.dbUrl, "Ticket");
        const migrationStateBefore = await query<{ migration_name: string; finished_at: string | null }>(
          db.dbUrl,
          `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name`,
        );

        // 2. Snapshot the complete DB; 3. snapshot the synthetic attachment storage.
        dumpDatabase(db.dbUrl, dumpPath);
        expect(verifyAttachmentHashes(store)).toBe(true);

        // 5. Run the isolated Prisma migration history containing the deliberately
        //    failing migration through the REAL `prisma migrate deploy` path.
        const deploy = runPrismaMigrateDeploy(failingTree.schemaPath, db.dbUrlWithSchema);

        // 6. Require `prisma migrate deploy` to fail.
        expect(deploy.ok).toBe(false);

        // 7. Inspect and record the actual failed state rather than assuming
        //    complete rollback. The failed migration must be recorded as unfinished.
        const failedMigration = await query<{ migration_name: string; finished_at: string | null }>(
          db.dbUrl,
          `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = $1`,
          [FAILING_MIGRATION_NAME],
        );
        expect(failedMigration).toHaveLength(1);
        expect(failedMigration[0].finished_at).toBeNull();
        // Record (do not assert) whether partial DDL left the probe object behind;
        // this test must not depend on a particular partial-DDL result.
        const probeExistsAfterFailure = await tableExists(db.dbUrl, "Lab4FailureProbe");

        // 8. Application writers remain conceptually stopped throughout recovery:
        //    no writer is started between the failure above and the restore below.

        // 9. Restore the verified database snapshot into a clean disposable DB.
        restoreDatabase(restoreTarget.dbUrl, dumpPath);
        // 10. Restore the paired attachment snapshot.
        writeFileSync(join(store.dir, "stored-normal.txt"), "damaged attachment");
        expect(verifyAttachmentHashes(store)).toBe(false);
        attachmentSnapshot.restore();
        expect(verifyAttachmentHashes(store)).toBe(true);
        expect(store.hashes).toEqual(attachmentSnapshot.hashes);

        // 11. Verify the restored state exactly equals the pre-cutover baseline.
        const restored = await snapshotPreserved(restoreTarget.dbUrl);
        expect(restored).toEqual(before);
        expectAttachmentReferences(restored, attachmentSnapshot.hashes);
        expect(await indexNames(restoreTarget.dbUrl, "Ticket")).toEqual(ticketIndexesBefore);
        const migrationStateAfter = await query<{ migration_name: string; finished_at: string | null }>(
          restoreTarget.dbUrl,
          `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name`,
        );
        expect(migrationStateAfter).toEqual(migrationStateBefore);
        expect(await migrationApplied(restoreTarget.dbUrl, LAB4_MIGRATION_NAME)).toBe(false);
        expect(await migrationApplied(restoreTarget.dbUrl, LAB3_PHASE_C)).toBe(true);

        // 12. No failed-test migration state or probe object survives in the restored DB.
        expect(await migrationApplied(restoreTarget.dbUrl, FAILING_MIGRATION_NAME)).toBe(false);
        expect(
          await tableExists(restoreTarget.dbUrl, "Lab4FailureProbe"),
          `probe existed in the failed source DB: ${probeExistsAfterFailure}`,
        ).toBe(false);
      } finally {
        failingTree.cleanup();
        rmSync(tmp, { recursive: true, force: true });
        attachmentSnapshot.cleanup();
        store.cleanup();
        restoreTarget.drop();
        db.drop();
      }
    },
    300000,
  );
});

describe("DB-MIG-03: snapshot rehearsal and post-write forward recovery", () => {
  itIfDb(
    "rehearses a restore into a separate empty DB, then forward-recovers without restoring the old snapshot",
    async () => {
      const db = buildLab3Baseline("lab4mig03");
      const rehearsal = createDisposableDb("lab4mig03rehearsal");
      const store = createSyntheticAttachmentStore(ATTACHMENT_FILES);
      const attachmentSnapshot = snapshotSyntheticAttachmentStore(store);
      const tmp = mkdtempSync(join(tmpdir(), "lab4-mig03-"));
      const dumpPath = join(tmp, "baseline.dump");
      try {
        // --- Lab 3 prerequisite: Phase A, backfill, and Phase C are complete ---
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_A)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_C)).toBe(true);
        expect(await tableExists(db.dbUrl, "DevRequester")).toBe(false);

        await query(
          db.dbUrl,
          `INSERT INTO "User" (name, email, role, "passwordHash", "isActive", "mustChangePassword", "createdAt", "updatedAt")
           VALUES ('Forward Recovery Staff', 'forward-recovery-staff@example.test', 'IT_STAFF', repeat('x', 60), true, false, now(), now())`,
        );

        const before = await snapshotPreserved(db.dbUrl);
        dumpDatabase(db.dbUrl, dumpPath);
        expect(verifyAttachmentHashes(store)).toBe(true);

        // --- Rehearsal: restore into a separate empty database and verify ---
        restoreDatabase(rehearsal.dbUrl, dumpPath);
        writeFileSync(join(store.dir, "stored-normal.txt"), "rehearsal mutation");
        attachmentSnapshot.restore();
        const rehearsed = await snapshotPreserved(rehearsal.dbUrl);
        expect(rehearsed).toEqual(before);
        expect(await migrationApplied(rehearsal.dbUrl, LAB3_PHASE_C)).toBe(true);
        expect(verifyAttachmentHashes(store)).toBe(true);
        expect(store.hashes).toEqual(attachmentSnapshot.hashes);
        expectAttachmentReferences(rehearsed, attachmentSnapshot.hashes);

        // --- Apply the additive Lab 4 migration and validate preserved data ---
        applyLab4Migration(db);
        const afterMigration = await snapshotPreserved(db.dbUrl);
        expect(afterMigration).toEqual(before);
        expect(await count(db.dbUrl, "ActionTaken")).toBe(0);

        // --- Simulate an ACCEPTED Lab 4 write (a real Action row) ---
        const performer = await query<{ id: number; role: string; isActive: boolean }>(
          db.dbUrl,
          `SELECT id, role::text AS role, "isActive" FROM "User"
           WHERE role = 'IT_STAFF' AND "isActive" = true ORDER BY id LIMIT 1`,
        );
        const ticket = await query<{ id: number }>(
          db.dbUrl,
          `SELECT id FROM "Ticket" ORDER BY id LIMIT 1`,
        );
        const actionRows = await query<{ id: number }>(
          db.dbUrl,
          `INSERT INTO "ActionTaken" ("ticketId","description","performedByUserId","status","version","updatedAt")
           VALUES ($1, 'Accepted Lab 4 write', $2, 'PENDING', 1, now()) RETURNING id`,
          [ticket[0].id, performer[0].id],
        );
        expect(performer[0].role).toBe("IT_STAFF");
        expect(performer[0].isActive).toBe(true);
        const actionId = actionRows[0].id;

        // --- Simulate a post-write schema defect and forward-recover ---
        // The old snapshot must NOT be restored; instead apply a forward corrective
        // migration (a temporary additive column) and prove the accepted Action survives.
        await query(db.dbUrl, `ALTER TABLE "ActionTaken" ADD COLUMN "forwardFixMarker" TEXT`);
        await query(db.dbUrl, `UPDATE "ActionTaken" SET "forwardFixMarker" = 'recovered' WHERE id = $1`, [actionId]);

        const survived = await query<{ id: number; description: string; forwardFixMarker: string }>(
          db.dbUrl,
          `SELECT id, description, "forwardFixMarker" FROM "ActionTaken" WHERE id = $1`,
          [actionId],
        );
        expect(survived).toHaveLength(1);
        expect(survived[0].description).toBe("Accepted Lab 4 write");
        expect(survived[0].forwardFixMarker).toBe("recovered");

        // The preserved Lab 3 data is still intact after forward recovery.
        const afterRecovery = await snapshotPreserved(db.dbUrl);
        expect(afterRecovery).toEqual(before);
        expect(verifyAttachmentHashes(store)).toBe(true);
        expectAttachmentReferences(afterRecovery, attachmentSnapshot.hashes);
        expect(await count(db.dbUrl, "ActionTaken")).toBe(1);
        expect((await query<{ description: string }>(
          db.dbUrl,
          `SELECT description FROM "ActionTaken" WHERE id = $1`,
          [actionId],
        ))[0].description).toBe("Accepted Lab 4 write");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
        attachmentSnapshot.cleanup();
        store.cleanup();
        rehearsal.drop();
        db.drop();
      }
    },
    300000,
  );
});

afterAll(() => {
  // Nothing global to clean up; every resource is released in each test's finally.
});
