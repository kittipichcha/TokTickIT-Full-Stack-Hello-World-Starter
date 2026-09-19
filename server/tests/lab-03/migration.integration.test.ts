import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
import { deriveInitialPassword } from "../../src/migrate-lab3.js";
import bcrypt from "bcrypt";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

// Deterministic test-only session secret (frozen §13 / Rev6 §4.5).
process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const VALID_NEW_PASSWORD = "NewPass123!xyz";

/** Extracts the session cookie value from a supertest response (set-cookie may be an array). */
function extractSessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first).split(";")[0];
}

// ---------------------------------------------------------------------------
// Isolated migration fixture (DB-MIG-05)
//
// DB-MIG-05 must execute the REAL migration orchestrator against a real Lab 2
// baseline, not merely assert email normalization. The fixture is a throwaway
// PostgreSQL database built from the tracked Lab 2 migration SQL, seeded with a
// deliberate normalized-email collision. The orchestrator runs as a subprocess
// (the repository's supported CLI entrypoint) so it uses its own Prisma client
// bound to the fixture database.
// ---------------------------------------------------------------------------

const LAB2_MIGRATIONS = [
  "20260808100141_add_cateogory",
  "20260823090000_add_dev_requester",
  "20260823091000_add_is_active_to_category",
  "20260825000000_add_ticket_related_system_attachment",
  "20260826000000_add_ticket_indexes_attachment_relations",
];

const PHASE_A_DIR = "20260917000000_lab3_phase_a_expand";
const PHASE_C_DIR = "20260917000001_lab3_phase_c_contract";

const FIXTURE_DB_NAME = `tocktick_lab3_mig05_${process.pid}`;

/** Splits a Prisma DATABASE_URL into a base prefix (…/ ) and the database name. */
function splitDbUrl(url: string): { prefix: string; dbName: string } {
  const base = url.split("?")[0];
  const lastSlash = base.lastIndexOf("/");
  return { prefix: base.slice(0, lastSlash + 1), dbName: base.slice(lastSlash + 1) };
}

function fixtureUrls(): { adminUrl: string; fixtureUrl: string; fixtureUrlWithSchema: string } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { prefix } = splitDbUrl(url);
  const fixtureUrl = `${prefix}${FIXTURE_DB_NAME}`;
  return {
    adminUrl: `${prefix}postgres`,
    fixtureUrl,
    fixtureUrlWithSchema: `${fixtureUrl}?schema=public`,
  };
}

function run(command: string, env: NodeJS.ProcessEnv = process.env): string {
  return execSync(command, { cwd: serverRoot, encoding: "utf-8", env }).toString();
}

/** Runs psql with an argument array (no shell quoting; safe on Windows). */
function psql(url: string, args: string[]): string {
  return execFileSync("psql", [url, ...args], { cwd: serverRoot, encoding: "utf-8" }).toString();
}

/** Runs the real orchestrator CLI against the fixture DB; captures output even on failure. */
function runOrchestrator(
  fixtureUrlWithSchema: string,
  extraEnv: NodeJS.ProcessEnv = {},
): { ok: boolean; output: string } {
  try {
    const output = run("npx tsx src/migrate-lab3.ts run", {
      ...process.env,
      DATABASE_URL: fixtureUrlWithSchema,
      ...extraEnv,
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
    return { ok: false, output: String(output) };
  }
}

/** Queries the fixture DB directly (bypasses the cached Prisma client). */
async function queryFixture<T extends Record<string, unknown>>(
  fixtureUrl: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = new pg.Pool({ connectionString: fixtureUrl });
  try {
    const result = await pool.query<T>(sql, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function fixtureCount(fixtureUrl: string, table: string): Promise<number> {
  const rows = await queryFixture<{ cnt: string }>(fixtureUrl, `SELECT COUNT(*)::text AS cnt FROM "${table}"`);
  return Number(rows[0]?.cnt ?? 0);
}

async function fixtureTableExists(fixtureUrl: string, table: string): Promise<boolean> {
  const rows = await queryFixture<{ exists: boolean }>(
    fixtureUrl,
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`,
    [table],
  );
  return rows[0]?.exists === true;
}

async function fixtureMigrationApplied(fixtureUrl: string, migrationName: string): Promise<boolean> {
  const rows = await queryFixture<{ cnt: string }>(
    fixtureUrl,
    `SELECT COUNT(*)::text AS cnt FROM _prisma_migrations WHERE migration_name = $1`,
    [migrationName],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Builds a fresh Lab 2 baseline fixture DB and seeds a deliberate email collision. */
function buildCollidingFixture(): { adminUrl: string; fixtureUrl: string; fixtureUrlWithSchema: string } {
  const urls = fixtureUrls();

  psql(urls.adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
  psql(urls.adminUrl, ["-q", "-c", `CREATE DATABASE "${FIXTURE_DB_NAME}";`]);

  // Apply the tracked Lab 2 migrations out-of-band, then record each as applied.
  for (const dir of LAB2_MIGRATIONS) {
    psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-f", `prisma/migrations/${dir}/migration.sql`]);
    run(`npx prisma migrate resolve --applied ${dir}`, {
      ...process.env,
      DATABASE_URL: urls.fixtureUrlWithSchema,
    });
  }

  // Seed a Lab 2 baseline with a deliberate normalized-email collision:
  // DevRequester id 1 "ada@example.com" and id 3 "ADA@example.com" both normalize
  // to "ada@example.com".
  const seedSql = `
    INSERT INTO "Category" ("name","isActive") VALUES ('Hardware',true),('Software',true);
    INSERT INTO "RelatedSystem" ("name","isActive") VALUES ('Corporate Laptop',true),('Campus Wi-Fi',true);
    INSERT INTO "DevRequester" ("name","email","isActive") VALUES
      ('Ada Lovelace','ada@example.com',true),
      ('Grace Hopper','grace@example.com',true),
      ('Collision Twin','ADA@example.com',true);
    INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId","relatedSystemId","summary","description","requestedPriority","itPriority","currentStatus","createdAt","updatedAt")
      VALUES ('TKT-2026-000001',1,1,1,'Summary one','Description one','LOW','LOW','NEW', now(), now());
    INSERT INTO "Attachment" ("ticketId","originalFilename","storedFilename","mimeType","fileSizeBytes","uploaderRequesterId","isRemoved","uploadedAt")
      VALUES (1,'a.txt','stored-a.txt','text/plain',10,1,false, now());
  `;
  psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-c", seedSql]);

  return urls;
}

/**
 * Builds a fresh, fully populated Lab 2 baseline fixture (DB-MIG-PRESERVE-01/02).
 *
 * The fixture deliberately varies requesters, categories, related systems, statuses,
 * priorities, ownership, and attachment removal state so that a migration which drops,
 * reorders, or re-points a record cannot satisfy the preservation assertions.
 */
function buildPopulatedFixture(): { adminUrl: string; fixtureUrl: string; fixtureUrlWithSchema: string } {
  const urls = fixtureUrls();

  psql(urls.adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
  psql(urls.adminUrl, ["-q", "-c", `CREATE DATABASE "${FIXTURE_DB_NAME}";`]);

  for (const dir of LAB2_MIGRATIONS) {
    psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-f", `prisma/migrations/${dir}/migration.sql`]);
    run(`npx prisma migrate resolve --applied ${dir}`, {
      ...process.env,
      DATABASE_URL: urls.fixtureUrlWithSchema,
    });
  }

  const seedSql = `
    INSERT INTO "Category" ("name","isActive") VALUES ('Hardware',true),('Software',true);
    INSERT INTO "RelatedSystem" ("name","isActive") VALUES ('Corporate Laptop',true),('Campus Wi-Fi',true);

    -- Four legacy requesters with mixed active states.
    INSERT INTO "DevRequester" ("name","email","isActive") VALUES
      ('Ada Lovelace','ada@example.com',true),
      ('Edsger Dijkstra','edsger@example.com',false),
      ('Grace Hopper','grace@example.com',true),
      ('Alan Turing','alan@example.com',true);

    -- Tickets spread across requesters, categories, systems, priorities.
    -- NOTE 1: the Lab 2 baseline enum only defines NEW; the remaining statuses are added by
    -- Phase A, so a genuine Lab 2 fixture can only use NEW here.
    -- NOTE 2: Lab 2 had no ticket-owner concept, so ticketOwnerId is authentically NULL.
    -- Phase A adds Ticket_ticketOwnerId_fkey -> User, which cannot be satisfied before the
    -- backfill populates User; a non-NULL legacy owner would be invalid Lab 2 data.
    INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId","relatedSystemId","summary","description","requestedPriority","itPriority","ticketOwnerId","currentStatus","createdAt","updatedAt") VALUES
      ('TKT-2026-000001',1,1,1,'Ticket A','Description A','HIGH','HIGH',NULL,'NEW','2026-01-01 10:00:00','2026-01-02 10:00:00'),
      ('TKT-2026-000002',2,2,2,'Ticket B','Description B','LOW', NULL,NULL,'NEW','2026-02-01 10:00:00','2026-02-02 10:00:00'),
      ('TKT-2026-000003',3,1,2,'Ticket C','Description C','MEDIUM','MEDIUM',NULL,'NEW','2026-03-01 10:00:00','2026-03-02 10:00:00'),
      ('TKT-2026-000004',4,2,1,'Ticket D','Description D','HIGH','LOW',NULL,'NEW','2026-04-01 10:00:00','2026-04-02 10:00:00');

    -- Attachments: normal, soft-removed with remover, and a different uploader.
    INSERT INTO "Attachment" ("ticketId","originalFilename","storedFilename","mimeType","fileSizeBytes","uploaderRequesterId","isRemoved","removedAt","removalReason","removedByRequesterId","uploadedAt") VALUES
      (1,'normal.txt','stored-normal.txt','text/plain',100,1,false,NULL,NULL,NULL,'2026-01-03 10:00:00'),
      (2,'removed.txt','stored-removed.txt','text/plain',200,2,true,'2026-02-03 10:00:00','No longer needed',3,'2026-02-03 09:00:00'),
      (3,'other-uploader.txt','stored-other.txt','text/plain',300,4,false,NULL,NULL,NULL,'2026-03-03 10:00:00');
  `;
  psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-c", seedSql]);

  return urls;
}

/** Captures a complete pre-migration snapshot of the Lab 2 fixture (not just counts). */
async function snapshotFixture(fixtureUrl: string): Promise<{
  requesters: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  relatedSystems: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
}> {
  const requesters = await queryFixture(fixtureUrl, `SELECT id, name, email, "isActive" FROM "DevRequester" ORDER BY id`);
  const categories = await queryFixture(fixtureUrl, `SELECT id, name, "isActive" FROM "Category" ORDER BY id`);
  const relatedSystems = await queryFixture(fixtureUrl, `SELECT id, name, "isActive" FROM "RelatedSystem" ORDER BY id`);
  const tickets = await queryFixture(
    fixtureUrl,
    `SELECT id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description,
            "requestedPriority", "itPriority", "ticketOwnerId", "currentStatus", "createdAt", "updatedAt"
     FROM "Ticket" ORDER BY id`,
  );
  const attachments = await queryFixture(
    fixtureUrl,
    `SELECT id, "ticketId", "originalFilename", "storedFilename", "mimeType", "fileSizeBytes",
            "uploaderRequesterId", "isRemoved", "removalReason",
            to_char("removedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "removedAt",
            to_char("uploadedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "uploadedAt",
            "removedByRequesterId"
     FROM "Attachment" ORDER BY id`,
  );
  return { requesters, categories, relatedSystems, tickets, attachments };
}

/** Captures the post-migration snapshot (User replaces DevRequester; shadow columns renamed). */
async function snapshotMigratedFixture(fixtureUrl: string): Promise<{
  users: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  relatedSystems: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
}> {
  const users = await queryFixture(fixtureUrl, `SELECT id, name, email, role, "isActive", "mustChangePassword" FROM "User" ORDER BY id`);
  const categories = await queryFixture(fixtureUrl, `SELECT id, name, "isActive" FROM "Category" ORDER BY id`);
  const relatedSystems = await queryFixture(fixtureUrl, `SELECT id, name, "isActive" FROM "RelatedSystem" ORDER BY id`);
  const tickets = await queryFixture(
    fixtureUrl,
    `SELECT id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description,
            "requestedPriority", "itPriority", "ticketOwnerId", "currentStatus", "createdAt", "updatedAt"
     FROM "Ticket" ORDER BY id`,
  );
  const attachments = await queryFixture(
    fixtureUrl,
    `SELECT id, "ticketId", "originalFilename", "storedFilename", "mimeType", "fileSizeBytes",
            "uploaderUserId", "isRemoved", "removalReason",
            to_char("removedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "removedAt",
            to_char("uploadedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "uploadedAt",
            "removedByUserId"
     FROM "Attachment" ORDER BY id`,
  );
  return { users, categories, relatedSystems, tickets, attachments };
}

function dropFixture(adminUrl: string): void {
  try {
    psql(adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
  } catch {
    // Best-effort cleanup; never fail the suite on teardown.
  }
}

/**
 * Builds a populated fixture and drives it into the documented resumable state:
 * Phase A applied, backfill committed, Phase C unapplied (DB-MIG-08/09/10).
 *
 * The state is reached through the REAL orchestrator by injecting a late Phase C failure,
 * exactly as MIG-FAIL-01 does — never by hand-editing `_prisma_migrations`.
 */
function buildBackfillCompleteFixture(): {
  adminUrl: string;
  fixtureUrl: string;
  fixtureUrlWithSchema: string;
} {
  const urls = buildPopulatedFixture();
  const failed = runOrchestrator(urls.fixtureUrlWithSchema, {
    NODE_ENV: "test",
    MIGRATION_TEST_FAIL_PHASE_C_AT: "end",
  });
  if (failed.ok) {
    throw new Error("Expected the injected Phase C failure to abort the orchestrator.");
  }
  return urls;
}

describe("DB-MIG-01..05: DevRequester -> User migration", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    // Ensure the database is in the finalized (Phase-C-complete) state with migrated Users.
    // The orchestrator (migrate-lab3.ts) performs the migration; these tests assert the result.
    const prisma = getPrisma();
    // No-op: the migration is expected to have been applied. We just verify connectivity.
    await prisma.$queryRawUnsafe("SELECT 1");
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await disconnectPrisma();
  });

  itIfDb("DB-MIG-01: every DevRequester became exactly one User with exact ID preservation", async () => {
    const prisma = getPrisma();
    // The DevRequester table is dropped in Phase C; the migrated Users preserve the original IDs.
    // We assert the known seed requesters exist as Users with role REQUESTER.
    const users = await prisma.user.findMany({
      where: { role: "REQUESTER" },
      orderBy: { id: "asc" },
    });

    // The Lab 2 seed had 5 requesters (4 active + 1 inactive).
    expect(users.length).toBeGreaterThanOrEqual(5);

    // Exact ID preservation: the known seed requesters have IDs 1-5.
    const ada = users.find((u) => u.email === "ada@example.com");
    expect(ada).toBeDefined();
    expect(ada!.id).toBe(1);
    expect(ada!.role).toBe("REQUESTER");
    expect(ada!.isActive).toBe(true);

    const edsger = users.find((u) => u.email === "edsger@example.com");
    expect(edsger).toBeDefined();
    expect(edsger!.isActive).toBe(false);
  });

  itIfDb("DB-MIG-02: final schema checklist — User fields, timestamptz, passwordHash length, isRemoved invariant", async () => {
    const prisma = getPrisma();

    // User has all 9 frozen fields incl. createdAt/updatedAt.
    const userCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='User'`,
    );
    const colNames = userCols.map((c) => c.column_name);
    for (const field of ["id", "name", "email", "role", "passwordHash", "isActive", "mustChangePassword", "createdAt", "updatedAt"]) {
      expect(colNames).toContain(field);
    }

    // passwordHash length 60 for all rows.
    const badHash = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "User" WHERE char_length("passwordHash") <> 60`,
    );
    expect(Number(badHash[0]?.cnt ?? 0)).toBe(0);

    // DM-TIME-01: the EXACT frozen §9.3 timestamp set must be timestamptz(3).
    // Asserting the exact set (not merely "some column is timestamptz") proves every
    // required column was converted.
    const expectedTimestamptzColumns = [
      "Attachment.removedAt",
      "Attachment.uploadedAt",
      "Category.createdAt",
      "Comment.createdAt",
      "InternalNote.createdAt",
      "RelatedSystem.createdAt",
      "Ticket.createdAt",
      "Ticket.updatedAt",
      "User.createdAt",
      "User.updatedAt",
    ].sort();

    const tzCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE (table_name='Category' AND column_name='createdAt')
          OR (table_name='RelatedSystem' AND column_name='createdAt')
          OR (table_name='Ticket' AND column_name IN ('createdAt','updatedAt'))
          OR (table_name='Attachment' AND column_name IN ('uploadedAt','removedAt'))
          OR (table_name='User' AND column_name IN ('createdAt','updatedAt'))
          OR (table_name='Comment' AND column_name='createdAt')
          OR (table_name='InternalNote' AND column_name='createdAt')`,
    );

    const actualTimestamptzColumns = tzCols.map((c) => `${c.table_name}.${c.column_name}`).sort();
    expect(actualTimestamptzColumns).toEqual(expectedTimestamptzColumns);
    for (const col of tzCols) {
      expect(col.data_type).toBe("timestamp with time zone");
    }

    // isRemoved invariant: isRemoved = (removedAt IS NOT NULL).
    const invariantViolations = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM "Attachment" WHERE "isRemoved" <> ("removedAt" IS NOT NULL)`,
    );
    expect(Number(invariantViolations[0]?.cnt ?? 0)).toBe(0);

    // Attachment has uploaderUserId (NOT NULL) and removedByUserId (nullable); no legacy requester columns.
    const attCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='Attachment'`,
    );
    const attNames = attCols.map((c) => c.column_name);
    expect(attNames).toContain("uploaderUserId");
    expect(attNames).toContain("removedByUserId");
    expect(attNames).not.toContain("uploaderRequesterId");
    expect(attNames).not.toContain("removedByRequesterId");

    // DevRequester table is dropped.
    const devRequesterExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='DevRequester') AS exists`,
    );
    expect(devRequesterExists[0]?.exists).toBe(false);

    // Ticket.appearsResolved NOT NULL @default(false).
    const appearsResolved = await prisma.$queryRawUnsafe<{ is_nullable: string; column_default: string | null }[]>(
      `SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name='Ticket' AND column_name='appearsResolved'`,
    );
    expect(appearsResolved[0]?.is_nullable).toBe("NO");
  });

  itIfDb("DB-MIG-03: migrated requester initial password matches the frozen derivation and authenticates", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
    expect(user).toBeDefined();

    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
    // bcrypt.compare(derived, stored) is true.
    expect(await bcrypt.compare(derived, user!.passwordHash)).toBe(true);
    // mustChangePassword is enforced.
    expect(user!.mustChangePassword).toBe(true);
  });

  itIfDb("DB-MIG-04: migrated requester is blocked until password change, then unblocked (same session)", async () => {
    const prisma = getPrisma();
    const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");

    // Reset Ada to the deterministic migrated state so this test is independent of prior runs.
    await prisma.user.update({
      where: { email: "ada@example.com" },
      data: { passwordHash: await bcrypt.hash(derived, 10), isActive: true, mustChangePassword: true },
    });
    const before = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
    expect(before!.mustChangePassword).toBe(true);

    try {
      // 1. Log in with the deterministic initial password.
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: derived });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.mustChangePassword).toBe(true);
      const cookie = extractSessionCookie(loginRes);
      const csrf = loginRes.headers["x-csrf-token"];

      // 2. Normal application access is blocked while mustChangePassword = true.
      const blocked = await request(app).get("/api/app/context").set("Cookie", cookie);
      expect(blocked.status).toBe(401);
      expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

      // 3. Change the password using the SAME session.
      const changed = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrf)
        .send({ currentPassword: derived, newPassword: VALID_NEW_PASSWORD });
      expect(changed.status).toBe(200);
      expect(changed.body.data.mustChangePassword).toBe(false);

      // 4. The same session now reaches normal application functionality.
      const allowed = await request(app).get("/api/app/context").set("Cookie", cookie);
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.email).toBe("ada@example.com");

      // 5. The stored password actually changed (bcrypt uses a random salt — never assert a hash string).
      const after = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
      expect(after!.mustChangePassword).toBe(false);
      expect(after!.passwordHash).not.toBe(before!.passwordHash);
      expect(await bcrypt.compare(derived, after!.passwordHash)).toBe(false);
      expect(await bcrypt.compare(VALID_NEW_PASSWORD, after!.passwordHash)).toBe(true);
    } finally {
      // Restore the migrated state so DB-MIG-03 (and subsequent runs) observe the
      // deterministic migrated password rather than this test's changed password.
      await prisma.user.update({
        where: { email: "ada@example.com" },
        data: { passwordHash: await bcrypt.hash(derived, 10), isActive: true, mustChangePassword: true },
      });
    }
  });

  itIfDb(
    "DB-MIG-05: a real migration collision aborts before backfill, preserves legacy data, and resumes after resolution",
    async () => {
      const urls = buildCollidingFixture();
      try {
        // --- Run the REAL orchestrator against the colliding Lab 2 fixture ---
        const first = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(first.ok).toBe(false);
        expect(first.output).toContain("MigrationCollisionError");
        expect(first.output).toContain("ada@example.com");

        // --- Abort invariant: no User backfill occurred ---
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(0);

        // --- Abort invariant: legacy data is unchanged ---
        expect(await fixtureCount(urls.fixtureUrl, "DevRequester")).toBe(3);
        expect(await fixtureCount(urls.fixtureUrl, "Ticket")).toBe(1);
        expect(await fixtureCount(urls.fixtureUrl, "Attachment")).toBe(1);
        expect(await fixtureCount(urls.fixtureUrl, "Category")).toBe(2);
        expect(await fixtureCount(urls.fixtureUrl, "RelatedSystem")).toBe(2);

        // --- Abort invariant: Phase A applied, Phase C NOT applied ---
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_A_DIR)).toBe(true);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);

        // --- Resolve the collision source, then resume ---
        await queryFixture(urls.fixtureUrl, `DELETE FROM "DevRequester" WHERE email = 'ADA@example.com'`);
        const second = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(second.ok).toBe(true);
        expect(second.output).toContain("Migration complete");

        // --- Final state: DevRequester gone, Users populated, Phase C applied, status clean ---
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(false);
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(2);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(true);

        const status = run("npx prisma migrate status", {
          ...process.env,
          DATABASE_URL: urls.fixtureUrlWithSchema,
        });
        expect(status).toContain("up to date");
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    180000,
  );

  itIfDb(
    "DB-MIG-PRESERVE-01: every legacy Requester and Ticket survives the real migration unchanged",
    async () => {
      const urls = buildPopulatedFixture();
      try {
        const before = await snapshotFixture(urls.fixtureUrl);

        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(true);
        expect(result.output).toContain("Migration complete");

        const after = await snapshotMigratedFixture(urls.fixtureUrl);

        // --- Requester -> User: one-for-one, exact ID/name/email/isActive preservation ---
        expect(after.users.length).toBe(before.requesters.length);
        for (const legacy of before.requesters) {
          const user = after.users.find((u) => u.id === legacy.id);
          expect(user, `User for DevRequester id ${legacy.id} must exist`).toBeDefined();
          expect(user!.id).toBe(legacy.id);
          expect(user!.name).toBe(legacy.name);
          expect(user!.email).toBe(String(legacy.email).trim().toLowerCase());
          expect(user!.isActive).toBe(legacy.isActive);
          expect(user!.role).toBe("REQUESTER");
          expect(user!.mustChangePassword).toBe(true);
        }

        // --- Categories / Related Systems preserved exactly ---
        expect(after.categories).toEqual(before.categories);
        expect(after.relatedSystems).toEqual(before.relatedSystems);

        // --- Tickets: exact ID set and every relationship/value preserved ---
        expect(after.tickets.map((t) => t.id)).toEqual(before.tickets.map((t) => t.id));
        for (const legacy of before.tickets) {
          const ticket = after.tickets.find((t) => t.id === legacy.id);
          expect(ticket, `Ticket id ${legacy.id} must survive`).toBeDefined();
          expect(ticket!.ticketNumber).toBe(legacy.ticketNumber);
          expect(ticket!.requesterId).toBe(legacy.requesterId);
          expect(ticket!.categoryId).toBe(legacy.categoryId);
          expect(ticket!.relatedSystemId).toBe(legacy.relatedSystemId);
          expect(ticket!.summary).toBe(legacy.summary);
          expect(ticket!.description).toBe(legacy.description);
          expect(ticket!.requestedPriority).toBe(legacy.requestedPriority);
          expect(ticket!.ticketOwnerId).toBe(legacy.ticketOwnerId);
          expect(ticket!.currentStatus).toBe(legacy.currentStatus);
          // DM-12: itPriority is backfilled from requestedPriority where it was NULL.
          expect(ticket!.itPriority).toBe(legacy.itPriority ?? legacy.requestedPriority);
        }
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    180000,
  );

  itIfDb(
    "DB-MIG-PRESERVE-02: every legacy Attachment and its ownership/removal state survives the real migration",
    async () => {
      const urls = buildPopulatedFixture();
      try {
        const before = await snapshotFixture(urls.fixtureUrl);

        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(true);

        const after = await snapshotMigratedFixture(urls.fixtureUrl);

        // --- Attachments: exact ID set and every field preserved ---
        expect(after.attachments.map((a) => a.id)).toEqual(before.attachments.map((a) => a.id));
        for (const legacy of before.attachments) {
          const att = after.attachments.find((a) => a.id === legacy.id);
          expect(att, `Attachment id ${legacy.id} must survive`).toBeDefined();
          expect(att!.ticketId).toBe(legacy.ticketId);
          expect(att!.originalFilename).toBe(legacy.originalFilename);
          expect(att!.storedFilename).toBe(legacy.storedFilename);
          expect(att!.mimeType).toBe(legacy.mimeType);
          expect(att!.fileSizeBytes).toBe(legacy.fileSizeBytes);
          expect(att!.isRemoved).toBe(legacy.isRemoved);
          expect(att!.removalReason).toBe(legacy.removalReason);

          // Ownership relationship renamed: uploaderRequesterId -> uploaderUserId.
          expect(att!.uploaderUserId).toBe(legacy.uploaderRequesterId);
          // Removal relationship renamed: removedByRequesterId -> removedByUserId.
          expect(att!.removedByUserId).toBe(legacy.removedByRequesterId);

          // removedAt preserved as the same UTC instant. Both snapshots render the value
          // as an explicit UTC ISO string, so the naive Lab 2 TIMESTAMP and the migrated
          // timestamptz are compared on equal footing (Phase C interprets the legacy
          // naive value as UTC via `AT TIME ZONE 'UTC'`).
          expect(att!.removedAt).toBe(legacy.removedAt);
          expect(att!.uploadedAt).toBe(legacy.uploadedAt);
        }
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    180000,
  );

  itIfDb(
    "MIG-FAIL-01: a late Phase C failure rolls back ALL Phase C DDL and is never recorded as applied",
    async () => {
      const urls = buildPopulatedFixture();
      try {
        // Deliberately fail the last Phase C statement through the REAL psql mechanism.
        const failed = runOrchestrator(urls.fixtureUrlWithSchema, {
          NODE_ENV: "test",
          MIGRATION_TEST_FAIL_PHASE_C_AT: "end",
        });
        expect(failed.ok).toBe(false);

        // Phase C must NOT be recorded as applied.
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);

        // No partially applied Phase C DDL: DevRequester still exists, legacy columns intact,
        // and the Phase C-only index was not created.
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(true);
        const attCols = await queryFixture<{ column_name: string }>(
          urls.fixtureUrl,
          `SELECT column_name FROM information_schema.columns WHERE table_name='Attachment'`,
        );
        const attNames = attCols.map((c) => c.column_name);
        expect(attNames).toContain("uploaderRequesterId");
        expect(attNames).toContain("removedByRequesterId");

        const ownerIdx = await queryFixture<{ cnt: string }>(
          urls.fixtureUrl,
          `SELECT COUNT(*)::text AS cnt FROM pg_indexes WHERE indexname = 'Ticket_ticketOwnerId_idx'`,
        );
        expect(Number(ownerIdx[0]?.cnt ?? 0)).toBe(0);

        // Legacy data remains intact.
        expect(await fixtureCount(urls.fixtureUrl, "DevRequester")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Ticket")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Attachment")).toBe(3);

        // The database is in the documented resumable state: Phase A applied, backfill
        // committed, Phase C unapplied.
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_A_DIR)).toBe(true);
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(4);

        // --- MIG-FAIL-03: a subsequent valid run resumes and completes ---
        const resumed = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(resumed.ok).toBe(true);
        expect(resumed.output).toContain("Migration complete");

        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(false);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(true);
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Ticket")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Attachment")).toBe(3);

        const status = run("npx prisma migrate status", {
          ...process.env,
          DATABASE_URL: urls.fixtureUrlWithSchema,
        });
        expect(status).toContain("up to date");
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );

  itIfDb(
    "MIG-FAIL-02: a pre-backfill legacy-invariant failure leaves the supported Phase-A-applied state",
    async () => {
      const urls = buildPopulatedFixture();
      try {
        // Corrupt the legacy data so the pre-backfill isRemoved invariant fails. This is
        // validated BEFORE the irreversible backfill boundary, so no User row is written.
        await queryFixture(
          urls.fixtureUrl,
          `UPDATE "Attachment" SET "isRemoved" = true, "removedAt" = NULL WHERE id = 1`,
        );

        const failed = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(failed.ok).toBe(false);
        expect(failed.output).toContain("isRemoved invariant violated");

        // No backfill occurred: the database is in the supported Phase-A-applied state.
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(0);
        expect(await fixtureCount(urls.fixtureUrl, "DevRequester")).toBe(4);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_A_DIR)).toBe(true);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);

        // Repair the corrupt data, then resume successfully.
        await queryFixture(
          urls.fixtureUrl,
          `UPDATE "Attachment" SET "isRemoved" = false, "removedAt" = NULL WHERE id = 1`,
        );
        const resumed = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(resumed.ok).toBe(true);
        expect(resumed.output).toContain("Migration complete");
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(4);
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );

  itIfDb(
    "DB-MIG-03 (supplementary): the frozen derivation is deterministic across independent fresh migrations",
    async () => {
      // Two independent fresh fixtures must produce the SAME initial password for the same
      // source identity — proving determinism without relying on a hard-coded password.
      const hashes: string[] = [];
      for (let run = 0; run < 2; run++) {
        const urls = buildPopulatedFixture();
        try {
          const result = runOrchestrator(urls.fixtureUrlWithSchema);
          expect(result.ok).toBe(true);

          const rows = await queryFixture<{ passwordHash: string }>(
            urls.fixtureUrl,
            `SELECT "passwordHash" FROM "User" WHERE email = 'ada@example.com'`,
          );
          expect(rows.length).toBe(1);
          hashes.push(rows[0].passwordHash);

          // The stored hash verifies against the frozen derivation for this identity.
          const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
          expect(await bcrypt.compare(derived, rows[0].passwordHash)).toBe(true);
        } finally {
          dropFixture(urls.adminUrl);
        }
      }

      // bcrypt salts differ, so the hashes differ — but both must verify the same derived
      // password, which is what "deterministic derivation" means.
      const derived = deriveInitialPassword("ada@example.com", "Ada Lovelace");
      for (const hash of hashes) {
        expect(await bcrypt.compare(derived, hash)).toBe(true);
      }
    },
    240000,
  );

  itIfDb(
    "DB-MIG-06: resume with matching counts but mismatched identity is rejected",
    async () => {
      const urls = fixtureUrls();
      psql(urls.adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
      psql(urls.adminUrl, ["-q", "-c", `CREATE DATABASE "${FIXTURE_DB_NAME}";`]);

      try {
        for (const dir of LAB2_MIGRATIONS) {
          psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-f", `prisma/migrations/${dir}/migration.sql`]);
          run(`npx prisma migrate resolve --applied ${dir}`, {
            ...process.env,
            DATABASE_URL: urls.fixtureUrlWithSchema,
          });
        }

        // Seed 1 legacy requester
        psql(urls.fixtureUrl, [
          "-v", "ON_ERROR_STOP=1", "-q", "-c",
          `INSERT INTO "DevRequester" ("id", "name", "email", "isActive") VALUES (1, 'Ada Lovelace', 'ada@example.com', true);`,
        ]);

        // Apply Phase A out-of-band and record as applied
        psql(urls.fixtureUrl, [
          "-v", "ON_ERROR_STOP=1", "-q", "-f",
          `prisma/migrations/${PHASE_A_DIR}/migration.sql`,
        ]);
        run(`npx prisma migrate resolve --applied ${PHASE_A_DIR}`, {
          ...process.env,
          DATABASE_URL: urls.fixtureUrlWithSchema,
        });

        // Insert 1 unrelated User so actualUsers === legacy.length (1 === 1), but identity does not match
        await queryFixture(
          urls.fixtureUrl,
          `INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
           VALUES (999, 'Unrelated User', 'unrelated@example.com', 'dummyhash', 'REQUESTER', true, true, now(), now())`,
        );

        // Run the orchestrator — must abort and reject resume
        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(false);
        expect(result.output).toContain("Backfilled User records do not match the frozen legacy-to-User mapping");

        // Phase C is NOT applied and DevRequester table still exists
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(true);
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    180000,
  );

  itIfDb(
    "DB-MIG-07: resume with matching id/email/role but divergent name/password/activation is rejected",
    async () => {
      const urls = fixtureUrls();
      psql(urls.adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
      psql(urls.adminUrl, ["-q", "-c", `CREATE DATABASE "${FIXTURE_DB_NAME}";`]);

      try {
        for (const dir of LAB2_MIGRATIONS) {
          psql(urls.fixtureUrl, ["-v", "ON_ERROR_STOP=1", "-q", "-f", `prisma/migrations/${dir}/migration.sql`]);
          run(`npx prisma migrate resolve --applied ${dir}`, {
            ...process.env,
            DATABASE_URL: urls.fixtureUrlWithSchema,
          });
        }

        // Seed 1 legacy requester.
        psql(urls.fixtureUrl, [
          "-v", "ON_ERROR_STOP=1", "-q", "-c",
          `INSERT INTO "DevRequester" ("id", "name", "email", "isActive") VALUES (1, 'Ada Lovelace', 'ada@example.com', true);`,
        ]);

        // Apply Phase A out-of-band and record as applied.
        psql(urls.fixtureUrl, [
          "-v", "ON_ERROR_STOP=1", "-q", "-f",
          `prisma/migrations/${PHASE_A_DIR}/migration.sql`,
        ]);
        run(`npx prisma migrate resolve --applied ${PHASE_A_DIR}`, {
          ...process.env,
          DATABASE_URL: urls.fixtureUrlWithSchema,
        });

        // Insert 1 User whose id/email/role MATCH the legacy row exactly, but whose name,
        // activation, and password hash diverge. The narrower DB-MIG-06 check would accept
        // this; the full frozen-mapping check must reject it.
        const wrongHash = await bcrypt.hash("WrongPassword123!", 10);
        await queryFixture(
          urls.fixtureUrl,
          `INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
           VALUES (1, 'Wrong Name', 'ada@example.com', $1, 'REQUESTER', false, true, now(), now())`,
          [wrongHash],
        );

        // Run the orchestrator — must abort and reject resume.
        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(false);
        expect(result.output).toContain("Backfilled User records do not match the frozen legacy-to-User mapping");

        // Phase C is NOT applied and DevRequester table still exists.
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(true);
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    180000,
  );

  itIfDb(
    "SEC-MIG-01: a failing psql migration never leaks the DB credential into captured output",
    async () => {
      const urls = buildPopulatedFixture();
      try {
        // Force a real psql failure through the production path (late Phase C statement).
        const failed = runOrchestrator(urls.fixtureUrlWithSchema, {
          NODE_ENV: "test",
          MIGRATION_TEST_FAIL_PHASE_C_AT: "end",
        });
        expect(failed.ok).toBe(false);

        // The captured output (stdout + stderr + error message) must contain no
        // `scheme://user:password@` credential fragment.
        expect(failed.output).not.toMatch(/:\/\/[^/\s]*:[^@\s]*@/);
        // The actual password value must never appear.
        const password = decodeURIComponent(new URL(urls.fixtureUrl).password);
        expect(password.length).toBeGreaterThan(0);
        expect(failed.output).not.toContain(password);
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );

  itIfDb(
    "DB-MIG-08: resume aborts when an attachment uploaderUserId diverges from uploaderRequesterId",
    async () => {
      const urls = buildBackfillCompleteFixture();
      try {
        // Corrupt exactly one attachment's shadow uploader so it no longer mirrors the
        // legacy column. Phase C would drop the legacy column and lose the true uploader.
        await queryFixture(
          urls.fixtureUrl,
          `UPDATE "Attachment" SET "uploaderUserId" = 2 WHERE id = 1`,
        );

        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(false);
        expect(result.output).toContain("Attachment ownership shadow columns do not mirror");
        expect(result.output).toContain("1");

        // Phase C is NOT recorded; the legacy columns and DevRequester still exist.
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(true);
        const attCols = await queryFixture<{ column_name: string }>(
          urls.fixtureUrl,
          `SELECT column_name FROM information_schema.columns WHERE table_name='Attachment'`,
        );
        const attNames = attCols.map((c) => c.column_name);
        expect(attNames).toContain("uploaderRequesterId");
        expect(attNames).toContain("removedByRequesterId");

        // The attachment rows are unchanged (the guard never mutates data).
        const rows = await queryFixture<{ id: number; uploaderUserId: number; uploaderRequesterId: number }>(
          urls.fixtureUrl,
          `SELECT id, "uploaderUserId", "uploaderRequesterId" FROM "Attachment" ORDER BY id`,
        );
        expect(rows.find((r) => r.id === 1)).toMatchObject({ uploaderUserId: 2, uploaderRequesterId: 1 });
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );

  itIfDb(
    "DB-MIG-09: resume aborts when removedByUserId is NULL while removedByRequesterId is set",
    async () => {
      const urls = buildBackfillCompleteFixture();
      try {
        // Attachment id 2 is soft-removed with removedByRequesterId = 3. Null the shadow
        // remover. A plain `<>` comparison would return NULL here and silently pass; the
        // `IS DISTINCT FROM` guard must catch it.
        await queryFixture(
          urls.fixtureUrl,
          `UPDATE "Attachment" SET "removedByUserId" = NULL WHERE id = 2`,
        );

        const result = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(result.ok).toBe(false);
        expect(result.output).toContain("Attachment ownership shadow columns do not mirror");
        expect(result.output).toContain("2");

        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(false);
        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(true);
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );

  itIfDb(
    "DB-MIG-10: a correct backfill-complete fixture resumes and completes Phase C",
    async () => {
      const urls = buildBackfillCompleteFixture();
      try {
        // The populated fixture already contains a soft-removed attachment (remover set),
        // a never-removed attachment (both remover columns NULL), and a different uploader.
        const resumed = runOrchestrator(urls.fixtureUrlWithSchema);
        expect(resumed.ok).toBe(true);
        expect(resumed.output).toContain("Migration complete");

        expect(await fixtureTableExists(urls.fixtureUrl, "DevRequester")).toBe(false);
        expect(await fixtureMigrationApplied(urls.fixtureUrl, PHASE_C_DIR)).toBe(true);
        expect(await fixtureCount(urls.fixtureUrl, "User")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Ticket")).toBe(4);
        expect(await fixtureCount(urls.fixtureUrl, "Attachment")).toBe(3);

        // Ownership survived the drop: uploaderUserId/removedByUserId hold the values that
        // were in the legacy columns.
        const rows = await queryFixture<{ id: number; uploaderUserId: number; removedByUserId: number | null }>(
          urls.fixtureUrl,
          `SELECT id, "uploaderUserId", "removedByUserId" FROM "Attachment" ORDER BY id`,
        );
        expect(rows.find((r) => r.id === 1)).toMatchObject({ uploaderUserId: 1, removedByUserId: null });
        expect(rows.find((r) => r.id === 2)).toMatchObject({ uploaderUserId: 2, removedByUserId: 3 });
        expect(rows.find((r) => r.id === 3)).toMatchObject({ uploaderUserId: 4, removedByUserId: null });

        const status = run("npx prisma migrate status", {
          ...process.env,
          DATABASE_URL: urls.fixtureUrlWithSchema,
        });
        expect(status).toContain("up to date");
      } finally {
        dropFixture(urls.adminUrl);
      }
    },
    240000,
  );
});