/**
 * Isolated historical-migration fixture context (Issue #51 — DB-MIG-04).
 *
 * The Lab 3 migration integration test must exercise the REAL migration
 * orchestrator against a byte-identical copy of the historical (Lab 2 + Lab 3)
 * schema and migration tree — never the repository's live `prisma/` directory,
 * which now also contains the Lab 4 migration.
 *
 * This helper:
 *   1. Creates a per-run temporary root with `mkdtemp`.
 *   2. Copies `schema.prisma`, `migration_lock.toml`, and the seven named Lab 3
 *      migration directories (each `migration.sql`) into that root.
 *   3. Verifies every copied file's SHA-256 against its source BEFORE any Prisma
 *      command can run; a missing file or hash mismatch fails setup.
 *   4. Exposes the absolute copied `schema.prisma` path and the fixture root so
 *      the orchestrator's fail-closed override validation can accept them.
 *   5. Removes the temporary root in `finally`.
 *
 * The helper never mutates the repository tree and never targets a non-disposable
 * database; the orchestrator independently re-validates the override and the
 * database URL before invoking Prisma.
 *
 * Not a test file — it lives outside the `*.test.ts` include pattern.
 */

import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The seven historical migrations that define the Lab 3 baseline. */
export const HISTORICAL_MIGRATIONS = [
  "20260808100141_add_cateogory",
  "20260823090000_add_dev_requester",
  "20260823091000_add_is_active_to_category",
  "20260825000000_add_ticket_related_system_attachment",
  "20260826000000_add_ticket_indexes_attachment_relations",
  "20260917000000_lab3_phase_a_expand",
  "20260917000001_lab3_phase_c_contract",
] as const;

const serverRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sourcePrismaDir = resolve(serverRoot, "prisma");
const historicalSchemaPath = resolve(serverRoot, "tests/lab-03/fixtures/lab3-final-schema.prisma");

/** SHA-256 hex digest of a file's bytes. */
function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export interface HistoricalMigrationContext {
  /** Absolute path of the per-run temporary fixture root. */
  root: string;
  /** Absolute path of the copied historical `schema.prisma`. */
  schemaPath: string;
  /** Absolute path of the copied `migrations` directory. */
  migrationsDir: string;
  /** Environment overrides the orchestrator subprocess must inherit. */
  env: Record<string, string>;
  /** Removes the temporary root. Safe to call more than once. */
  cleanup: () => void;
}

/**
 * Creates the isolated historical-migration context.
 *
 * Throws (before any Prisma command) when a source file is missing or a copied
 * file's hash does not match its source.
 */
export function createHistoricalMigrationContext(): HistoricalMigrationContext {
  const root = mkdtempSync(join(tmpdir(), "lab3-historical-migration-"));
  const migrationsDir = join(root, "migrations");
  mkdirSync(migrationsDir, { recursive: true });

  const copyVerified = (sourcePath: string, destPath: string): void => {
    if (!existsSync(sourcePath)) {
      throw new Error(`Historical migration fixture source is missing: ${sourcePath}`);
    }
    copyFileSync(sourcePath, destPath);
    const sourceHash = sha256File(sourcePath);
    const destHash = sha256File(destPath);
    if (sourceHash !== destHash) {
      throw new Error(
        `Historical migration fixture hash mismatch for ${sourcePath}: ` +
          `source=${sourceHash} copy=${destHash}`,
      );
    }
  };

  const schemaPath = join(root, "schema.prisma");
  copyVerified(historicalSchemaPath, schemaPath);
  copyVerified(join(sourcePrismaDir, "migrations", "migration_lock.toml"), join(migrationsDir, "migration_lock.toml"));

  // The seven historical migration directories.
  for (const dir of HISTORICAL_MIGRATIONS) {
    const destDir = join(migrationsDir, dir);
    mkdirSync(destDir, { recursive: true });
    copyVerified(
      join(sourcePrismaDir, "migrations", dir, "migration.sql"),
      join(destDir, "migration.sql"),
    );
  }

  return {
    root,
    schemaPath,
    migrationsDir,
    env: {
      NODE_ENV: "test",
      MIGRATION_TEST_SCHEMA_PATH: schemaPath,
      MIGRATION_TEST_FIXTURE_ROOT: root,
    },
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; never fail the suite on teardown.
      }
    },
  };
}
