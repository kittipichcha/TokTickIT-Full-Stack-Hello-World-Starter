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
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLab3Baseline,
  applyLab4Migration,
  createDisposableDb,
  dumpDatabase,
  restoreDatabase,
  createSyntheticAttachmentStore,
  verifyAttachmentHashes,
  query,
  count,
  tableExists,
  migrationApplied,
  indexNames,
  LAB4_MIGRATION_NAME,
  LAB3_PHASE_A,
  LAB3_PHASE_C,
  type DisposableDb,
} from "./helpers/migration-fixture.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

/** The synthetic attachment store mirrors the fixture's single Attachment row. */
const ATTACHMENT_FILES = { "stored-normal.txt": "synthetic attachment contents" };

/** Captures the preserved Lab 3 data that must survive the Lab 4 migration. */
async function snapshotPreserved(dbUrl: string) {
  const users = await query(dbUrl, `SELECT id, name, email, role, "isActive" FROM "User" ORDER BY id`);
  const tickets = await query(
    dbUrl,
    `SELECT id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description,
            "requestedPriority", "itPriority", "ticketOwnerId", "currentStatus"
     FROM "Ticket" ORDER BY id`,
  );
  const attachments = await query(
    dbUrl,
    `SELECT id, "ticketId", "originalFilename", "storedFilename", "mimeType", "fileSizeBytes",
            "uploaderUserId", "isRemoved"
     FROM "Attachment" ORDER BY id`,
  );
  const comments = await query(dbUrl, `SELECT id, "ticketId", "authorId", content FROM "Comment" ORDER BY id`);
  const notes = await query(dbUrl, `SELECT id, "ticketId", "authorId", content FROM "InternalNote" ORDER BY id`);
  return { users, tickets, attachments, comments, notes };
}

describe("DB-MIG-01: additive Lab 4 migration preserves Lab 3 data", () => {
  itIfDb(
    "preserves every prior row, adds zero Actions, keeps legacy resolvedAt NULL, and adds exact indexes",
    async () => {
      const db = buildLab3Baseline("lab4mig01");
      const store = createSyntheticAttachmentStore(ATTACHMENT_FILES);
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

        // --- Migration history records the Lab 4 migration ---
        expect(await migrationApplied(db.dbUrl, LAB4_MIGRATION_NAME)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_A)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_C)).toBe(true);
      } finally {
        store.cleanup();
        db.drop();
      }
    },
    300000,
  );
});

describe("DB-MIG-02: pre-write failure restores the paired snapshots", () => {
  itIfDb(
    "a failing Lab 4 migration rolls back fully, then the DB + attachment snapshots restore exactly",
    async () => {
      const db = buildLab3Baseline("lab4mig02");
      const restoreTarget = createDisposableDb("lab4mig02restore");
      const store = createSyntheticAttachmentStore(ATTACHMENT_FILES);
      const tmp = mkdtempSync(join(tmpdir(), "lab4-mig02-"));
      const dumpPath = join(tmp, "baseline.dump");
      try {
        const before = await snapshotPreserved(db.dbUrl);
        const ticketIndexesBefore = await indexNames(db.dbUrl, "Ticket");

        // Snapshot the verified pre-cutover database and attachment store.
        dumpDatabase(db.dbUrl, dumpPath);
        expect(verifyAttachmentHashes(store)).toBe(true);

        // Inject a late failure into the REAL Lab 4 migration SQL and apply it
        // through the same psql --single-transaction mechanism.
        const migrationSql = readFileSync(
          join(serverRoot, "prisma", "migrations", LAB4_MIGRATION_NAME, "migration.sql"),
          "utf-8",
        );
        const failingPath = join(tmp, "failing-lab4.sql");
        writeFileSync(failingPath, `${migrationSql}\n\n-- [test-only] deliberate late failure\nSELECT 1/0;\n`, "utf-8");

        let failed = false;
        try {
          execFileSync(
            "psql",
            [db.dbUrl, "--single-transaction", "-v", "ON_ERROR_STOP=1", "-f", failingPath],
            { cwd: serverRoot, encoding: "utf-8" },
          );
        } catch {
          failed = true;
        }
        expect(failed).toBe(true);

        // The failure rolled back every Lab 4 DDL statement: no Lab 4 tables exist.
        expect(await tableExists(db.dbUrl, "ActionTaken")).toBe(false);
        expect(await tableExists(db.dbUrl, "ActionCreateIdempotency")).toBe(false);
        expect(await migrationApplied(db.dbUrl, LAB4_MIGRATION_NAME)).toBe(false);

        // Writers remain stopped; restore the paired snapshots together into a
        // separate empty database and verify exact preservation.
        restoreDatabase(restoreTarget.dbUrl, dumpPath);
        expect(verifyAttachmentHashes(store)).toBe(true);

        const restored = await snapshotPreserved(restoreTarget.dbUrl);
        expect(restored).toEqual(before);
        expect(await indexNames(restoreTarget.dbUrl, "Ticket")).toEqual(ticketIndexesBefore);
        expect(await migrationApplied(restoreTarget.dbUrl, LAB4_MIGRATION_NAME)).toBe(false);
        expect(await migrationApplied(restoreTarget.dbUrl, LAB3_PHASE_C)).toBe(true);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
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
      const tmp = mkdtempSync(join(tmpdir(), "lab4-mig03-"));
      const dumpPath = join(tmp, "baseline.dump");
      try {
        // --- Lab 3 prerequisite: Phase A, backfill, and Phase C are complete ---
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_A)).toBe(true);
        expect(await migrationApplied(db.dbUrl, LAB3_PHASE_C)).toBe(true);
        expect(await tableExists(db.dbUrl, "DevRequester")).toBe(false);

        const before = await snapshotPreserved(db.dbUrl);
        dumpDatabase(db.dbUrl, dumpPath);
        expect(verifyAttachmentHashes(store)).toBe(true);

        // --- Rehearsal: restore into a separate empty database and verify ---
        restoreDatabase(rehearsal.dbUrl, dumpPath);
        const rehearsed = await snapshotPreserved(rehearsal.dbUrl);
        expect(rehearsed).toEqual(before);
        expect(await migrationApplied(rehearsal.dbUrl, LAB3_PHASE_C)).toBe(true);
        expect(verifyAttachmentHashes(store)).toBe(true);

        // --- Apply the additive Lab 4 migration and validate preserved data ---
        applyLab4Migration(db);
        const afterMigration = await snapshotPreserved(db.dbUrl);
        expect(afterMigration).toEqual(before);
        expect(await count(db.dbUrl, "ActionTaken")).toBe(0);

        // --- Simulate an ACCEPTED Lab 4 write (a real Action row) ---
        const staff = await query<{ id: number }>(
          db.dbUrl,
          `SELECT id FROM "User" WHERE role = 'REQUESTER' ORDER BY id LIMIT 1`,
        );
        const ticket = await query<{ id: number }>(
          db.dbUrl,
          `SELECT id FROM "Ticket" ORDER BY id LIMIT 1`,
        );
        const actionRows = await query<{ id: number }>(
          db.dbUrl,
          `INSERT INTO "ActionTaken" ("ticketId","description","performedByUserId","status","version","updatedAt")
           VALUES ($1, 'Accepted Lab 4 write', $2, 'PENDING', 1, now()) RETURNING id`,
          [ticket[0].id, staff[0].id],
        );
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
      } finally {
        rmSync(tmp, { recursive: true, force: true });
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
