/**
 * Lab 3 migration orchestrator (Issue #35).
 *
 * Implements the frozen two-phase migration workflow:
 *   Stage-1 preflight -> Phase A apply -> Stage-2 collision scan -> backfill
 *   -> post-backfill verification -> Phase C apply -> post-checks
 *
 * Migration-history mechanism (frozen §5.1 / review Rev6 §4.2):
 *   - Both phases are tracked migration directories.
 *   - Apply-then-resolve: the orchestrator applies the migration SQL out-of-band
 *     (via raw SQL), then records it with `prisma migrate resolve --applied`.
 *   - Never plain `migrate deploy` with Phase C pending.
 *   - Every `_prisma_migrations` record corresponds to a real tracked directory.
 *
 * Collision guard (frozen §9.2 / DM-11, amended Rev 13 — B-2):
 *   - Stage 1 (pre-Phase-A) accepts exactly two legal input states:
 *       (i) a fresh Lab 2 baseline, or
 *       (ii) Phase-A-applied / backfill-not-run (resume after a collision abort).
 *   - Stage 2 (post-Phase-A, pre-backfill) runs the full three-way scan:
 *       legacy↔legacy normalized emails; legacy normalized email ↔ existing User.email;
 *       legacy id ↔ existing User.id.
 *   - Any hit -> MigrationCollisionError BEFORE any User row is written, and the
 *     data-preservation abort invariant is asserted (DM-11 / DM-18).
 *
 * Recovery (DM-18): on a Stage-2 collision abort the database is left in the
 * documented Phase-A-applied state. The operator resolves the collision source
 * (manual data fix or user decision), then re-runs this orchestrator; Stage 1
 * recognizes the Phase-A-applied/backfill-not-run state and resumes at Stage 2.
 * Never un-apply tracked migrations; never hand-edit `_prisma_migrations`.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { getPrisma, disconnectPrisma } from "./prisma.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = resolve(SERVER_ROOT, "prisma", "migrations");

const PHASE_A_DIR = "20260917000000_lab3_phase_a_expand";
const PHASE_C_DIR = "20260917000001_lab3_phase_c_contract";

/** Thrown when the Stage-2 collision scan finds a blocking collision. */
export class MigrationCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationCollisionError";
  }
}

/** Thrown when a stop-and-report gate is hit (Prisma misbehavior, non-UTC data, invariant violation). */
export class MigrationStopAndReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationStopAndReportError";
  }
}

interface LegacyRequesterRow {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date | null;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Frozen password derivation (§13 decision 13):
 * "Lab3-" + first 20 hex chars of SHA-256(lowercase(trim(email)) + ":" + trim(name))
 * (lowercase hex encoding).
 */
export function deriveInitialPassword(email: string, name: string): string {
  const input = `${normalizeEmail(email)}:${name.trim()}`;
  const hash = sha256Hex(input);
  return "Lab3-" + hash.slice(0, 20);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function run(command: string): string {
  return execSync(command, { cwd: SERVER_ROOT, encoding: "utf-8" }).toString();
}

function readMigrationSql(dirName: string): string {
  const path = resolve(MIGRATIONS_DIR, dirName, "migration.sql");
  if (!existsSync(path)) {
    throw new MigrationStopAndReportError(`Migration SQL not found: ${path}`);
  }
  return readFileSync(path, "utf-8");
}

/** Applies a migration SQL file out-of-band via psql (raw SQL), then records it as applied. */
async function applyTrackedMigrationOutOfBand(dirName: string): Promise<void> {
  const sqlPath = resolve(MIGRATIONS_DIR, dirName, "migration.sql");
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  // psql does not understand Prisma's ?schema= query parameter; strip it.
  const psqlUrl = url.split("?")[0];

  // Apply the SQL out-of-band (psql). ON_ERROR_STOP ensures a failure aborts loudly.
  const psqlCmd = `psql "${psqlUrl}" -v ON_ERROR_STOP=1 -f "${sqlPath}"`;
  run(psqlCmd);

  // Record the migration as applied in _prisma_migrations (apply-then-resolve).
  run(`npx prisma migrate resolve --applied ${dirName}`);
}

/** Reads the legacy DevRequester rows via typed raw SQL (DM-16). */
async function readLegacyRequesters(): Promise<LegacyRequesterRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, name, email, "isActive", "createdAt" FROM "DevRequester" ORDER BY id`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    isActive: Boolean(r.isActive),
    createdAt: r.createdAt ? new Date(String(r.createdAt)) : null,
  }));
}

/** Stage-1 preflight: checks Lab-2-schema facts only. Accepts exactly two legal input states. */
async function stage1Preflight(): Promise<"fresh" | "phase-a-applied"> {
  const prisma = getPrisma();

  // Does the legacy DevRequester table exist?
  const devRequesterExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='DevRequester') AS exists`,
  );
  const hasDevRequester = devRequesterExists[0]?.exists === true;

  // Does the User table exist?
  const userExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') AS exists`,
  );
  const hasUser = userExists[0]?.exists === true;

  // Is Phase A recorded in _prisma_migrations?
  const phaseARecord = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM _prisma_migrations WHERE migration_name = '${PHASE_A_DIR}'`,
  );
  const phaseAApplied = Number(phaseARecord[0]?.cnt ?? 0) > 0;

  if (hasDevRequester && !hasUser) {
    // Legal input state (i): fresh Lab 2 baseline.
    return "fresh";
  }

  if (hasDevRequester && hasUser && phaseAApplied) {
    // Legal input state (ii): Phase-A-applied / backfill-not-run (resume after collision abort).
    // Verify backfill has NOT run (User table empty of migrated requesters).
    const userCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "User"`,
    );
    if (Number(userCount[0]?.cnt ?? 0) === 0) {
      return "phase-a-applied";
    }
    throw new MigrationStopAndReportError(
      "Unrecognized database state: User table is non-empty but DevRequester still exists. " +
        "This is not a legal re-entry state. Follow the README runbook; never hand-edit _prisma_migrations.",
    );
  }

  if (!hasDevRequester && !hasUser) {
    throw new MigrationStopAndReportError(
      "Unrecognized database state: neither DevRequester nor User exists. Expected a Lab 2 baseline.",
    );
  }

  if (!hasDevRequester && hasUser) {
    throw new MigrationStopAndReportError(
      "Unrecognized database state: DevRequester is gone and User exists — this is a finalized " +
        "(Phase-C-complete) database. The orchestrator is never re-run against a finalized database. " +
        "DB-MIG-03 determinism is proven by independent fresh-snapshot repetition, not re-execution.",
    );
  }

  throw new MigrationStopAndReportError("Unrecognized database state. Follow the README runbook.");
}

/** Stage-2 collision scan: full three-way comparison. Returns colliding descriptions (empty = OK). */
async function stage2CollisionScan(): Promise<string[]> {
  const prisma = getPrisma();
  const legacy = await readLegacyRequesters();
  const collisions: string[] = [];

  // 1. legacy↔legacy normalized emails
  const seenEmails = new Map<string, number>();
  for (const row of legacy) {
    const norm = normalizeEmail(row.email);
    if (seenEmails.has(norm)) {
      collisions.push(
        `Duplicate normalized email "${norm}" between DevRequester id ${seenEmails.get(norm)} and ${row.id}`,
      );
    } else {
      seenEmails.set(norm, row.id);
    }
  }

  // 2. legacy normalized email ↔ existing User.email
  const existingUsers = await prisma.$queryRawUnsafe<{ id: number; email: string }[]>(
    `SELECT id, email FROM "User"`,
  );
  const existingEmails = new Map<string, number>();
  for (const u of existingUsers) {
    existingEmails.set(normalizeEmail(u.email), u.id);
  }
  for (const row of legacy) {
    const norm = normalizeEmail(row.email);
    if (existingEmails.has(norm)) {
      collisions.push(
        `Migrated email "${norm}" (DevRequester id ${row.id}) collides with existing User id ${existingEmails.get(norm)}`,
      );
    }
  }

  // 3. legacy id ↔ existing User.id
  const existingIds = new Set(existingUsers.map((u) => u.id));
  for (const row of legacy) {
    if (existingIds.has(row.id)) {
      collisions.push(
        `DevRequester id ${row.id} collides with existing User id ${row.id} (blocks exact ID preservation)`,
      );
    }
  }

  return collisions;
}

/** Asserts the data-preservation abort invariant (DM-11 / DM-18) after a Stage-2 collision. */
async function assertDataPreservationInvariant(stage1Snapshot: Record<string, number>): Promise<void> {
  const prisma = getPrisma();
  const tables = ["Category", "RelatedSystem", "Ticket", "Attachment", "DevRequester", "TicketSequence"];
  for (const table of tables) {
    const count = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "${table}"`,
    );
    const actual = Number(count[0]?.cnt ?? 0);
    if (stage1Snapshot[table] !== actual) {
      throw new MigrationStopAndReportError(
        `Data-preservation invariant violated: ${table} count changed from ${stage1Snapshot[table]} to ${actual} after collision abort.`,
      );
    }
  }
  // User table must be empty (pre-backfill) in subcases A/C; in subcase B it holds the pre-seeded rows.
  // The invariant is: User contains exactly its pre-backfill contents. We assert it is unchanged
  // from the Stage-1 snapshot (which captured the pre-backfill User count).
  const userCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) AS cnt FROM "User"`);
  const actualUser = Number(userCount[0]?.cnt ?? 0);
  if (stage1Snapshot["User"] !== actualUser) {
    throw new MigrationStopAndReportError(
      `Data-preservation invariant violated: User count changed from ${stage1Snapshot["User"]} to ${actualUser} after collision abort.`,
    );
  }
}

/** Captures a Stage-1 snapshot of table row counts (used by the abort invariant). */
async function captureStage1Snapshot(): Promise<Record<string, number>> {
  const prisma = getPrisma();
  const tables = ["Category", "RelatedSystem", "Ticket", "Attachment", "DevRequester", "TicketSequence", "User"];
  const snapshot: Record<string, number> = {};
  for (const table of tables) {
    // The User table may not exist yet at Stage 1 (fresh Lab 2 baseline); treat as 0.
    const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}') AS exists`,
    );
    if (exists[0]?.exists !== true) {
      snapshot[table] = 0;
      continue;
    }
    const count = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "${table}"`,
    );
    snapshot[table] = Number(count[0]?.cnt ?? 0);
  }
  return snapshot;
}

/** Backfills every DevRequester row into User with exact ID preservation (single transaction). */
async function runBackfill(): Promise<void> {
  const prisma = getPrisma();
  const legacy = await readLegacyRequesters();

  await prisma.$transaction(async (tx) => {
    for (const row of legacy) {
      const derived = deriveInitialPassword(row.email, row.name);
      const passwordHash = await bcrypt.hash(derived, 10);
      const now = new Date();
      await tx.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "name", "email", "role", "passwordHash", "isActive", "mustChangePassword", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'REQUESTER', $4, $5, true, $6, $7)`,
        row.id,
        row.name.trim(),
        normalizeEmail(row.email),
        passwordHash,
        row.isActive,
        row.createdAt ?? now,
        now,
      );
    }

    // Backfill Attachment shadow columns from the legacy requester columns.
    await tx.$executeRawUnsafe(
      `UPDATE "Attachment" SET "uploaderUserId" = "uploaderRequesterId", "removedByUserId" = "removedByRequesterId"`,
    );

    // Backfill Ticket.itPriority = requestedPriority where null (DM-12).
    await tx.$executeRawUnsafe(
      `UPDATE "Ticket" SET "itPriority" = "requestedPriority" WHERE "itPriority" IS NULL`,
    );
  });

  // setval the User.id sequence past the max preserved ID (DM-10).
  const maxId = await prisma.$queryRawUnsafe<{ max: bigint | null }[]>(`SELECT MAX(id) AS max FROM "User"`);
  const nextVal = Number(maxId[0]?.max ?? 0) + 1;
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), ${nextVal})`);
}

/** Post-backfill verification (fails loudly): isRemoved invariant, FK integrity, counts. */
async function postBackfillVerification(legacyCount: number): Promise<void> {
  const prisma = getPrisma();

  // isRemoved = (removedAt IS NOT NULL) row-level invariant (BASE-1 / Rev-11).
  const invariantViolations = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Attachment" WHERE "isRemoved" <> ("removedAt" IS NOT NULL)`,
  );
  if (Number(invariantViolations[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError(
      "isRemoved invariant violated: rows exist where isRemoved <> (removedAt IS NOT NULL). " +
        "This indicates pre-existing corrupt data. Abort for manual cleanup; never 'fix' by silent UPDATE.",
    );
  }

  // FK integrity: all Ticket.requesterId resolve to User rows.
  const orphanTickets = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Ticket" t LEFT JOIN "User" u ON u.id = t."requesterId" WHERE u.id IS NULL`,
  );
  if (Number(orphanTickets[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError("FK integrity violated: Ticket.requesterId does not resolve to a User row.");
  }

  // Attachment uploaderUserId/removedByUserId resolve to User rows.
  const orphanUploaders = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Attachment" a LEFT JOIN "User" u ON u.id = a."uploaderUserId" WHERE a."uploaderUserId" IS NOT NULL AND u.id IS NULL`,
  );
  if (Number(orphanUploaders[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError("FK integrity violated: Attachment.uploaderUserId does not resolve to a User row.");
  }

  // Row counts match.
  const userCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) AS cnt FROM "User"`);
  if (Number(userCount[0]?.cnt ?? 0) !== legacyCount) {
    throw new MigrationStopAndReportError(
      `Row count mismatch: expected ${legacyCount} Users, found ${Number(userCount[0]?.cnt ?? 0)}.`,
    );
  }
}

/** Post-checks: migrate status clean + final-schema checklist. */
async function postChecks(): Promise<void> {
  const status = run("npx prisma migrate status");
  if (!status.includes("up to date")) {
    throw new MigrationStopAndReportError("migrate status is not clean after Phase C.");
  }
  const validate = run("npx prisma validate");
  if (!validate.includes("valid")) {
    throw new MigrationStopAndReportError("prisma validate failed on the final schema.");
  }
}

/** Runs the full Lab 3 migration workflow. */
export async function runLab3Migration(): Promise<void> {
  const prisma = getPrisma();

  // Stage 1 preflight (step 0).
  const inputState = await stage1Preflight();
  const stage1Snapshot = await captureStage1Snapshot();
  console.log(`[migrate-lab3] Stage-1 preflight: input state = ${inputState}`);

  // Phase A apply (only on a fresh baseline).
  if (inputState === "fresh") {
    console.log(`[migrate-lab3] Applying Phase A (${PHASE_A_DIR}) out-of-band...`);
    await applyTrackedMigrationOutOfBand(PHASE_A_DIR);
  } else {
    console.log(`[migrate-lab3] Resuming: Phase A already applied (${PHASE_A_DIR}); skipping apply.`);
  }

  // Stage 2 collision scan (post-Phase-A, pre-backfill).
  const collisions = await stage2CollisionScan();
  if (collisions.length > 0) {
    // Assert the data-preservation abort invariant, then throw.
    await assertDataPreservationInvariant(stage1Snapshot);
    const detail = collisions.join("\n  - ");
    throw new MigrationCollisionError(
      `MigrationCollisionError: ${collisions.length} collision(s) block the migration.\n  - ${detail}\n` +
        `Database left in the documented Phase-A-applied state. Resolve the collision source (manual data fix or user decision), ` +
        `then re-run the orchestrator to resume at Stage 2. Never un-apply tracked migrations; never hand-edit _prisma_migrations.`,
    );
  }

  // Backfill (single transaction).
  const legacy = await readLegacyRequesters();
  console.log(`[migrate-lab3] Backfilling ${legacy.length} DevRequester rows into User...`);
  await runBackfill();

  // Post-backfill verification.
  await postBackfillVerification(legacy.length);
  console.log("[migrate-lab3] Post-backfill verification passed (isRemoved invariant, FK integrity, counts).");

  // Phase C apply.
  console.log(`[migrate-lab3] Applying Phase C (${PHASE_C_DIR}) out-of-band...`);
  await applyTrackedMigrationOutOfBand(PHASE_C_DIR);

  // Post-checks.
  await postChecks();
  console.log("[migrate-lab3] Migration complete: migrate status clean; final schema validated.");

  await disconnectPrisma();
}

// CLI entry point.
const isMain = process.argv[2] === "run";
if (isMain) {
  runLab3Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}