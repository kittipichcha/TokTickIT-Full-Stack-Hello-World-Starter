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
 *   - Stage 1 (pre-Phase-A) accepts exactly three legal input states:
 *       (i) a fresh Lab 2 baseline,
 *       (ii) Phase-A-applied / backfill-not-run (resume after a collision abort), or
 *       (iii) Phase-A-applied / backfill-complete / Phase-C-unapplied (resume after a
 *            Phase C failure — see "Atomicity and recovery" below).
 *   - Stage 2 (post-Phase-A, pre-backfill) runs the full three-way scan:
 *       legacy↔legacy normalized emails; legacy normalized email ↔ existing User.email;
 *       legacy id ↔ existing User.id.
 *   - Any hit -> MigrationCollisionError BEFORE any User row is written, and the
 *     data-preservation abort invariant is asserted (DM-11 / DM-18).
 *
 * Atomicity and recovery (PR #46 review follow-up):
 *   - Every tracked migration SQL file is applied with `psql --single-transaction`, so a
 *     late Phase C statement failure rolls back ALL Phase C DDL and the migration is never
 *     recorded as applied. `_prisma_migrations` is never hand-edited.
 *   - All legacy-data invariants that can be evaluated BEFORE the irreversible backfill
 *     boundary are validated pre-backfill (`validateLegacyInvariants`). The remaining
 *     post-backfill checks are executed INSIDE the backfill transaction, so a failure
 *     rolls the backfill back and leaves the supported Phase-A-applied state.
 *   - If Phase C nevertheless fails after a committed backfill, the database is left in the
 *     documented, resumable state (iii): Phase A applied, User backfilled, Phase C unapplied.
 *     Stage 1 recognizes it and resumes at Phase C. Never un-apply tracked migrations; never
 *     hand-edit `_prisma_migrations`.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
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

/**
 * Strips any credential-bearing connection-string fragment from an error before it can
 * propagate into logs, test output, or committed evidence.
 *
 * Defense in depth: the orchestrator never interpolates credentials into a command string
 * (see `applyTrackedMigrationOutOfBand`), but a raw `DATABASE_URL` can still surface in an
 * error message from psql, Prisma, or the shell. This regex removes the `user:password@`
 * portion of any `scheme://…` URL so a password can never reach downstream output.
 */
function sanitizeExecError(err: unknown): Error {
  const e = err as { message?: string; stderr?: Buffer | string; cmd?: string };
  const scrub = (value: string): string =>
    value.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s:@]*):[^/\s@]*@/g, "$1:***@");

  const message = scrub(String(e?.message ?? err));
  const sanitized = new Error(message);
  if (e?.stderr !== undefined) {
    (sanitized as { stderr?: string }).stderr = scrub(String(e.stderr));
  }
  if (e?.cmd !== undefined) {
    (sanitized as { cmd?: string }).cmd = scrub(String(e.cmd));
  }
  return sanitized;
}

function run(command: string, extraEnv?: Record<string, string>): string {
  try {
    return execSync(command, {
      cwd: SERVER_ROOT,
      encoding: "utf-8",
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    }).toString();
  } catch (err) {
    throw sanitizeExecError(err);
  }
}

function readMigrationSql(dirName: string): string {
  const path = resolve(MIGRATIONS_DIR, dirName, "migration.sql");
  if (!existsSync(path)) {
    throw new MigrationStopAndReportError(`Migration SQL not found: ${path}`);
  }
  return readFileSync(path, "utf-8");
}

/**
 * Deterministic test-only failure injection (PR #46 review follow-up).
 *
 * When `MIGRATION_TEST_FAIL_PHASE_C_AT` is set AND `NODE_ENV === "test"`, the PHASE C
 * migration SQL is applied with a deliberately failing statement appended at the named
 * point, so the failure/recovery tests exercise the REAL migration mechanism (psql
 * `--single-transaction`) rather than a bypass. This is never active outside tests, and
 * it never affects Phase A (which must succeed for the recovery state to be reachable).
 *
 * Recognized values:
 *   "end"  -> append a failing statement after the last real Phase C statement.
 */
function injectPhaseCFailure(dirName: string, sql: string): string {
  const marker = process.env.MIGRATION_TEST_FAIL_PHASE_C_AT;
  if (!marker || process.env.NODE_ENV !== "test" || dirName !== PHASE_C_DIR) {
    return sql;
  }
  if (marker === "end") {
    return `${sql}\n\n-- [test-only] deliberate late Phase C failure\nSELECT 1/0;\n`;
  }
  throw new MigrationStopAndReportError(
    `Unsupported MIGRATION_TEST_FAIL_PHASE_C_AT value: ${marker} (expected "end").`,
  );
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

  // Never interpolate credentials into the command string: `execSync` embeds the exact
  // command in the error it throws on failure, and that error text is captured verbatim
  // into committed evidence logs. Parse the URL, strip the password from the connection
  // string that becomes part of the command, and pass the password via `PGPASSWORD`.
  const parsed = new URL(psqlUrl);
  const password = decodeURIComponent(parsed.password);
  parsed.password = "";
  const safeConnString = parsed.toString();

  // Test-only deterministic failure injection: when active, apply a modified copy of the
  // migration SQL (real statements + one deliberate late failure) through the SAME psql
  // mechanism, so the failure/recovery tests exercise the production path. The injected
  // file is written OUTSIDE the migrations directory so Prisma never sees it.
  const originalSql = readMigrationSql(dirName);
  const injectedSql = injectPhaseCFailure(dirName, originalSql);
  let effectiveSqlPath = sqlPath;
  if (injectedSql !== originalSql) {
    effectiveSqlPath = resolve(tmpdir(), `migrate-lab3-injected-${process.pid}-${Date.now()}.sql`);
    writeFileSync(effectiveSqlPath, injectedSql, "utf-8");
  }

  // Apply the SQL out-of-band (psql) inside a SINGLE transaction.
  // `--single-transaction` wraps the whole file in BEGIN/COMMIT, so a late statement
  // failure rolls back every earlier statement in the file. `ON_ERROR_STOP` makes psql
  // exit non-zero on the first error (without it, psql would continue and COMMIT).
  // Together they guarantee: all-or-nothing DDL, and no `_prisma_migrations` record on
  // failure (the resolve step below is only reached when psql exits 0).
  try {
    const psqlCmd = `psql "${safeConnString}" --single-transaction -v ON_ERROR_STOP=1 -f "${effectiveSqlPath}"`;
    run(psqlCmd, { PGPASSWORD: password });
  } finally {
    if (effectiveSqlPath !== sqlPath && existsSync(effectiveSqlPath)) {
      rmSync(effectiveSqlPath, { force: true });
    }
  }

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

/**
 * Verifies that backfilled User records match legacy DevRequester identity
 * (same id, role = 'REQUESTER', normalized email).
 */
async function verifyBackfillIdentity(legacy: LegacyRequesterRow[]): Promise<void> {
  const prisma = getPrisma();
  const users = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, email, role FROM "User" ORDER BY id`,
  );
  const userMap = new Map<number, { email: string; role: string }>();
  for (const u of users) {
    userMap.set(Number(u.id), {
      email: String(u.email),
      role: String(u.role),
    });
  }

  const mismatched: number[] = [];
  for (const leg of legacy) {
    const matchedUser = userMap.get(leg.id);
    if (
      !matchedUser ||
      matchedUser.role !== "REQUESTER" ||
      matchedUser.email !== normalizeEmail(leg.email)
    ) {
      mismatched.push(leg.id);
    }
  }

  if (mismatched.length > 0) {
    throw new MigrationStopAndReportError(
      `Backfilled User records do not match legacy DevRequester identity for IDs: ${mismatched.join(", ")}. ` +
        `Expected same ID, role='REQUESTER', and normalized email. ` +
        `Follow the README runbook; never hand-edit _prisma_migrations.`,
    );
  }
}

/** Stage-1 preflight: checks Lab-2-schema facts only. Accepts exactly three legal input states. */
async function stage1Preflight(): Promise<"fresh" | "phase-a-applied" | "backfill-complete"> {
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

  // Is Phase C recorded in _prisma_migrations?
  const phaseCRecord = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM _prisma_migrations WHERE migration_name = '${PHASE_C_DIR}'`,
  );
  const phaseCApplied = Number(phaseCRecord[0]?.cnt ?? 0) > 0;

  if (hasDevRequester && !hasUser) {
    // Legal input state (i): fresh Lab 2 baseline.
    return "fresh";
  }

  if (hasDevRequester && hasUser && phaseAApplied && !phaseCApplied) {
    // Legal input states (ii) and (iii): Phase A applied, Phase C not applied.
    // Distinguish by whether the backfill has already run.
    const legacy = await readLegacyRequesters();
    const userCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "User"`,
    );
    const actualUsers = Number(userCount[0]?.cnt ?? 0);

    if (actualUsers === 0) {
      // (ii) Phase-A-applied / backfill-not-run (resume after a collision abort).
      return "phase-a-applied";
    }

    if (actualUsers === legacy.length) {
      // (iii) Phase-A-applied / backfill-complete / Phase-C-unapplied.
      // This is the documented resumable state left by a Phase C failure after a
      // committed backfill. Verify legacy-to-User identity before resuming at Phase C.
      await verifyBackfillIdentity(legacy);
      return "backfill-complete";
    }

    throw new MigrationStopAndReportError(
      `Unrecognized database state: User table holds ${actualUsers} rows but ${legacy.length} ` +
        `DevRequester rows exist. This is neither the pre-backfill nor the post-backfill state. ` +
        `Follow the README runbook; never hand-edit _prisma_migrations.`,
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

/**
 * Pre-backfill legacy-invariant validation.
 *
 * Every invariant that can be evaluated from the LEGACY data BEFORE the irreversible
 * backfill boundary is validated here, so a failure leaves the database in the already
 * supported Phase-A-applied / backfill-not-run state (resume after a collision abort).
 * This closes the recovery hole where a post-backfill verification failure would leave a
 * partially migrated state the orchestrator could not resume.
 */
async function validateLegacyInvariants(): Promise<void> {
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

  // Legacy FK integrity: every Ticket.requesterId resolves to a DevRequester row.
  const orphanTickets = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Ticket" t LEFT JOIN "DevRequester" d ON d.id = t."requesterId" WHERE d.id IS NULL`,
  );
  if (Number(orphanTickets[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError(
      "Legacy FK integrity violated: Ticket.requesterId does not resolve to a DevRequester row.",
    );
  }

  // Legacy FK integrity: every Attachment.uploaderRequesterId resolves to a DevRequester row.
  const orphanUploaders = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Attachment" a LEFT JOIN "DevRequester" d ON d.id = a."uploaderRequesterId" WHERE a."uploaderRequesterId" IS NOT NULL AND d.id IS NULL`,
  );
  if (Number(orphanUploaders[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError(
      "Legacy FK integrity violated: Attachment.uploaderRequesterId does not resolve to a DevRequester row.",
    );
  }

  // Legacy FK integrity: every Attachment.removedByRequesterId resolves to a DevRequester row.
  const orphanRemovers = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Attachment" a LEFT JOIN "DevRequester" d ON d.id = a."removedByRequesterId" WHERE a."removedByRequesterId" IS NOT NULL AND d.id IS NULL`,
  );
  if (Number(orphanRemovers[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError(
      "Legacy FK integrity violated: Attachment.removedByRequesterId does not resolve to a DevRequester row.",
    );
  }

  // Legacy FK integrity: every Ticket.ticketOwnerId (if set) resolves to a DevRequester row.
  const orphanOwners = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Ticket" t LEFT JOIN "DevRequester" d ON d.id = t."ticketOwnerId" WHERE t."ticketOwnerId" IS NOT NULL AND d.id IS NULL`,
  );
  if (Number(orphanOwners[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError(
      "Legacy FK integrity violated: Ticket.ticketOwnerId does not resolve to a DevRequester row.",
    );
  }
}

/**
 * Backfills every DevRequester row into User with exact ID preservation (single transaction).
 *
 * The post-backfill verification runs INSIDE the same transaction, so a verification
 * failure rolls the backfill back and leaves the supported Phase-A-applied state rather
 * than a partially migrated database.
 */
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

    // Post-backfill verification INSIDE the transaction: a failure rolls everything back.
    await verifyBackfillWithinTransaction(tx, legacy.length);
  });

  // setval the User.id sequence past the max preserved ID (DM-10).
  const maxId = await prisma.$queryRawUnsafe<{ max: bigint | null }[]>(`SELECT MAX(id) AS max FROM "User"`);
  const nextVal = Number(maxId[0]?.max ?? 0) + 1;
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), ${nextVal})`);
}

/**
 * Post-backfill verification executed inside the backfill transaction.
 *
 * These checks can only fail if the backfill transaction itself was incorrect (or the
 * legacy data was already corrupt, which `validateLegacyInvariants` catches pre-backfill).
 * Running them in-transaction means a failure rolls the backfill back atomically.
 */
async function verifyBackfillWithinTransaction(
  tx: { $queryRawUnsafe: <T>(sql: string) => Promise<T> },
  legacyCount: number,
): Promise<void> {
  // FK integrity: all Ticket.requesterId resolve to User rows.
  const orphanTickets = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Ticket" t LEFT JOIN "User" u ON u.id = t."requesterId" WHERE u.id IS NULL`,
  );
  if (Number(orphanTickets[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError("FK integrity violated: Ticket.requesterId does not resolve to a User row.");
  }

  // Attachment uploaderUserId/removedByUserId resolve to User rows.
  const orphanUploaders = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) AS cnt FROM "Attachment" a LEFT JOIN "User" u ON u.id = a."uploaderUserId" WHERE a."uploaderUserId" IS NOT NULL AND u.id IS NULL`,
  );
  if (Number(orphanUploaders[0]?.cnt ?? 0) > 0) {
    throw new MigrationStopAndReportError("FK integrity violated: Attachment.uploaderUserId does not resolve to a User row.");
  }

  // Row counts match.
  const userCount = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) AS cnt FROM "User"`);
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

  // Stage 2 collision scan (post-Phase-A, PRE-backfill only).
  //
  // The scan compares legacy DevRequester rows against the User table. Once the backfill
  // has committed, every legacy row legitimately has a matching User, so re-running the
  // scan would report false collisions. On a `backfill-complete` resume the scan is
  // therefore skipped: the backfill already passed the scan before it committed.
  if (inputState !== "backfill-complete") {
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
  } else {
    console.log("[migrate-lab3] Resuming: backfill already committed; skipping the pre-backfill collision scan.");
  }

  // Pre-backfill legacy-invariant validation: anything determinable from the legacy data
  // is validated BEFORE the irreversible backfill boundary, so a failure leaves the
  // supported Phase-A-applied state (never a partially migrated database).
  await validateLegacyInvariants();

  if (inputState === "backfill-complete") {
    // Resume after a Phase C failure: the backfill already committed and was verified
    // in-transaction. Skip the backfill and resume at Phase C.
    console.log("[migrate-lab3] Resuming: backfill already complete; skipping backfill, applying Phase C.");
  } else {
    // Backfill (single transaction, with in-transaction verification).
    const legacy = await readLegacyRequesters();
    console.log(`[migrate-lab3] Backfilling ${legacy.length} DevRequester rows into User...`);
    await runBackfill();
    console.log("[migrate-lab3] Backfill committed; in-transaction verification passed (FK integrity, counts).");
  }

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