/**
 * Lab 4 migration/recovery fixture helpers (Issue #51 — DB-MIG-01/02/03).
 *
 * These helpers build a disposable Lab 3 baseline database, snapshot it with a
 * real custom-format `pg_dump`, restore it into a separate empty rehearsal
 * database, and validate preserved data after the additive Lab 4 migration.
 *
 * Safety rules (specification.md §7, BR-32):
 *   - Only disposable databases are created/dropped; the helper refuses a
 *     production-like or unmarked database name.
 *   - Snapshots live in the OS temp directory and are deleted in `finally`;
 *     they are never committed.
 *   - Attachment "storage" is represented by synthetic files whose SHA-256
 *     hashes are recorded and re-verified — never real attachment contents.
 *
 * Not a test file — it lives outside the `*.test.ts` include pattern.
 */

import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createHistoricalMigrationContext } from "../../lab-03/helpers/historical-migration-context.js";

const serverRoot = fileURLToPath(new URL("../../../", import.meta.url));

/** The five Lab 2 migrations that precede the Lab 3 Phase A/C migrations. */
const LAB2_MIGRATIONS = [
  "20260808100141_add_cateogory",
  "20260823090000_add_dev_requester",
  "20260823091000_add_is_active_to_category",
  "20260825000000_add_ticket_related_system_attachment",
  "20260826000000_add_ticket_indexes_attachment_relations",
] as const;

const PHASE_A_DIR = "20260917000000_lab3_phase_a_expand";
const PHASE_C_DIR = "20260917000001_lab3_phase_c_contract";
const LAB4_MIGRATION = "20261001000000_lab4_actions_foundation";

const DISPOSABLE_DB_MARKERS = ["test", "mig", "e2e", "fixture", "scratch", "tmp"];
const PRODUCTION_DB_MARKERS = ["prod", "production", "live"];

export interface DisposableDb {
  dbName: string;
  adminUrl: string;
  dbUrl: string;
  dbUrlWithSchema: string;
  drop: () => void;
}

function splitDbUrl(url: string): { prefix: string; dbName: string } {
  const base = url.split("?")[0];
  const lastSlash = base.lastIndexOf("/");
  return { prefix: base.slice(0, lastSlash + 1), dbName: base.slice(lastSlash + 1) };
}

function assertDisposable(dbName: string): void {
  const lower = dbName.toLowerCase();
  if (PRODUCTION_DB_MARKERS.some((m) => lower.includes(m))) {
    throw new Error(`Refusing to use a production-like database: ${dbName}`);
  }
  if (!DISPOSABLE_DB_MARKERS.some((m) => lower.includes(m))) {
    throw new Error(`Database name "${dbName}" is not marked disposable; refusing to use it.`);
  }
}

/** Runs psql with an argument array (no shell quoting; safe on Windows). */
function psql(url: string, args: string[]): string {
  return execFileSync("psql", [url, ...args], { cwd: serverRoot, encoding: "utf-8" }).toString();
}

/** Runs a command with the given env, returning combined output even on failure. */
function runCapture(command: string, env: NodeJS.ProcessEnv): string {
  try {
    return execSync(command, { cwd: serverRoot, encoding: "utf-8", env }).toString();
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
  }
}

/** Creates a fresh disposable database named `<base>_<label>_<pid>`. */
export function createDisposableDb(label: string): DisposableDb {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { prefix, dbName } = splitDbUrl(url);
  const disposableName = `${dbName}_${label}_${process.pid}`;
  assertDisposable(disposableName);

  const adminUrl = `${prefix}postgres`;
  const dbUrl = `${prefix}${disposableName}`;
  psql(adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${disposableName}";`]);
  psql(adminUrl, ["-q", "-c", `CREATE DATABASE "${disposableName}";`]);

  return {
    dbName: disposableName,
    adminUrl,
    dbUrl,
    dbUrlWithSchema: `${dbUrl}?schema=public`,
    drop: () => {
      try {
        psql(adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${disposableName}";`]);
      } catch {
        // Best-effort cleanup.
      }
    },
  };
}

/** Queries a database directly (bypasses the cached Prisma client). */
export async function query<T extends Record<string, unknown>>(
  dbUrl: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    const result = await pool.query<T>(sql, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function count(dbUrl: string, table: string): Promise<number> {
  const rows = await query<{ cnt: string }>(dbUrl, `SELECT COUNT(*)::text AS cnt FROM "${table}"`);
  return Number(rows[0]?.cnt ?? 0);
}

export async function tableExists(dbUrl: string, table: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    dbUrl,
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`,
    [table],
  );
  return rows[0]?.exists === true;
}

export async function migrationApplied(dbUrl: string, name: string): Promise<boolean> {
  const rows = await query<{ cnt: string }>(
    dbUrl,
    `SELECT COUNT(*)::text AS cnt FROM _prisma_migrations WHERE migration_name = $1`,
    [name],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function indexNames(dbUrl: string, table: string): Promise<string[]> {
  const rows = await query<{ indexname: string }>(
    dbUrl,
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
    [table],
  );
  return rows.map((r) => r.indexname);
}

/**
 * Builds a disposable Lab 3 baseline database:
 *   1. Apply the five Lab 2 migrations out-of-band and record them as applied.
 *   2. Seed a representative Lab 2 dataset (requesters, categories, systems,
 *      tickets, attachments).
 *   3. Run the REAL Lab 3 orchestrator against the copied historical schema to
 *      complete Phase A, the backfill, and Phase C.
 *
 * Returns the disposable database handle.
 */
export function buildLab3Baseline(label: string): DisposableDb {
  const db = createDisposableDb(label);
  const ctx = createHistoricalMigrationContext();
  try {
    for (const dir of LAB2_MIGRATIONS) {
      psql(db.dbUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-f", `prisma/migrations/${dir}/migration.sql`]);
      runCapture(`npx prisma migrate resolve --applied ${dir} --schema "${ctx.schemaPath}"`, {
        ...process.env,
        DATABASE_URL: db.dbUrlWithSchema,
      });
    }

    const seedSql = `
      INSERT INTO "Category" ("name","isActive") VALUES ('Hardware',true),('Software',true);
      INSERT INTO "RelatedSystem" ("name","isActive") VALUES ('Corporate Laptop',true),('Campus Wi-Fi',true);
      INSERT INTO "DevRequester" ("name","email","isActive") VALUES
        ('Ada Lovelace','ada@example.com',true),
        ('Grace Hopper','grace@example.com',true);
      INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId","relatedSystemId","summary","description","requestedPriority","itPriority","ticketOwnerId","currentStatus","createdAt","updatedAt") VALUES
        ('TKT-2026-000001',1,1,1,'Ticket A','Description A','HIGH','HIGH',NULL,'NEW','2026-01-01 10:00:00','2026-01-02 10:00:00'),
        ('TKT-2026-000002',2,2,2,'Ticket B','Description B','LOW',NULL,NULL,'NEW','2026-02-01 10:00:00','2026-02-02 10:00:00');
      INSERT INTO "Attachment" ("ticketId","originalFilename","storedFilename","mimeType","fileSizeBytes","uploaderRequesterId","isRemoved","uploadedAt") VALUES
        (1,'normal.txt','stored-normal.txt','text/plain',100,1,false,'2026-01-03 10:00:00');
    `;
    psql(db.dbUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-c", seedSql]);

    const output = runCapture("npx tsx src/migrate-lab3.ts run", {
      ...process.env,
      DATABASE_URL: db.dbUrlWithSchema,
      ...ctx.env,
    });
    if (!output.includes("Migration complete")) {
      throw new Error(`Lab 3 baseline migration did not complete:\n${output}`);
    }
    return db;
  } finally {
    ctx.cleanup();
  }
}

/** Applies the additive Lab 4 migration to a database using the repository schema. */
export function applyLab4Migration(db: DisposableDb): void {
  const output = runCapture("npx prisma migrate deploy --schema prisma/schema.prisma", {
    ...process.env,
    DATABASE_URL: db.dbUrlWithSchema,
  });
  if (!output.includes("successfully applied") && !output.includes("No pending migrations")) {
    throw new Error(`Lab 4 migration deploy failed:\n${output}`);
  }
}

/** Takes a custom-format PostgreSQL snapshot into a temp file. Returns the path. */
export function dumpDatabase(dbUrl: string, filePath: string): void {
  execFileSync("pg_dump", ["--format=custom", "--file", filePath, dbUrl], {
    cwd: serverRoot,
    encoding: "utf-8",
  });
}

/** Restores a custom-format snapshot into an (empty) database. */
export function restoreDatabase(dbUrl: string, filePath: string): void {
  execFileSync("pg_restore", ["--no-owner", "--dbname", dbUrl, filePath], {
    cwd: serverRoot,
    encoding: "utf-8",
  });
}

export interface SyntheticAttachmentStore {
  dir: string;
  /** Map of stored filename -> SHA-256 hex digest. */
  hashes: Map<string, string>;
  cleanup: () => void;
}

export interface SyntheticAttachmentSnapshot {
  hashes: Map<string, string>;
  restore: () => void;
  cleanup: () => void;
}

/**
 * Creates a synthetic attachment-storage directory with deterministic file
 * contents and records each file's SHA-256. Never uses real attachment data.
 */
export function createSyntheticAttachmentStore(files: Record<string, string>): SyntheticAttachmentStore {
  const dir = mkdtempSync(join(tmpdir(), "lab4-attachment-store-"));
  const hashes = new Map<string, string>();
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    writeFileSync(path, content, "utf-8");
    hashes.set(name, createHash("sha256").update(readFileSync(path)).digest("hex"));
  }
  return {
    dir,
    hashes,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup.
      }
    },
  };
}

/** Captures a paired synthetic attachment snapshot with an explicit restore operation. */
export function snapshotSyntheticAttachmentStore(store: SyntheticAttachmentStore): SyntheticAttachmentSnapshot {
  const snapshotDir = mkdtempSync(join(tmpdir(), "lab4-attachment-snapshot-"));
  for (const name of store.hashes.keys()) {
    copyFileSync(join(store.dir, name), join(snapshotDir, name));
  }
  return {
    hashes: new Map(store.hashes),
    restore: () => {
      rmSync(store.dir, { recursive: true, force: true });
      mkdirSync(store.dir, { recursive: true });
      for (const name of store.hashes.keys()) {
        copyFileSync(join(snapshotDir, name), join(store.dir, name));
      }
    },
    cleanup: () => {
      try {
        rmSync(snapshotDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup.
      }
    },
  };
}

/** Re-verifies every recorded attachment hash against the store on disk. */
export function verifyAttachmentHashes(store: SyntheticAttachmentStore): boolean {
  for (const [name, expected] of store.hashes) {
    const path = join(store.dir, name);
    if (!existsSync(path)) return false;
    const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (actual !== expected) return false;
  }
  return true;
}

export const LAB4_MIGRATION_NAME = LAB4_MIGRATION;
export const LAB3_PHASE_A = PHASE_A_DIR;
export const LAB3_PHASE_C = PHASE_C_DIR;
export { resolve };
