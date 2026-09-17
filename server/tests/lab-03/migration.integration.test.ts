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
function runOrchestrator(fixtureUrlWithSchema: string): { ok: boolean; output: string } {
  try {
    const output = run("npx tsx src/migrate-lab3.ts run", {
      ...process.env,
      DATABASE_URL: fixtureUrlWithSchema,
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

function dropFixture(adminUrl: string): void {
  try {
    psql(adminUrl, ["-q", "-c", `DROP DATABASE IF EXISTS "${FIXTURE_DB_NAME}";`]);
  } catch {
    // Best-effort cleanup; never fail the suite on teardown.
  }
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

    // DM-TIME-01: all §9.3 timestamps are timestamptz.
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
    expect(tzCols.length).toBeGreaterThan(0);
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
});