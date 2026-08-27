import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

// server/ root (tests/lab-02 -> ../..)
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

const REQUIRED_CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];
const UNRELATED_CATEGORY = "ZZZ Seed Test Unrelated Category";

function runSeed(): void {
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverRoot,
    stdio: "pipe",
    env: process.env,
  });
}

describe("SEED-01 / SEED-02: seed idempotency and required records", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    // Plant an unrelated, pre-existing Category that the seed must preserve.
    await prisma.category.upsert({
      where: { name: UNRELATED_CATEGORY },
      update: {},
      create: { name: UNRELATED_CATEGORY },
    });
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    await prisma.category.deleteMany({ where: { name: UNRELATED_CATEGORY } });
    await disconnectPrisma();
  });

  itIfDb("SEED-02: contains the four required categories exactly once", async () => {
    runSeed();
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { name: { in: REQUIRED_CATEGORIES } },
    });

    for (const name of REQUIRED_CATEGORIES) {
      const matches = categories.filter((c) => c.name === name);
      expect(matches.length).toBe(1);
    }
  }, 60000);

  itIfDb("SEED-02: contains at least six related systems, four active requesters, and one inactive requester", async () => {
    runSeed();
    const prisma = getPrisma();

    const systems = await prisma.relatedSystem.count({ where: { isActive: true } });
    expect(systems).toBeGreaterThanOrEqual(6);

    const activeRequesters = await prisma.devRequester.count({ where: { isActive: true } });
    expect(activeRequesters).toBeGreaterThanOrEqual(4);

    const inactiveRequesters = await prisma.devRequester.count({ where: { isActive: false } });
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
  }, 60000);

  itIfDb("SEED-01: preserves unrelated pre-existing categories", async () => {
    const prisma = getPrisma();
    const before = await prisma.category.findUnique({ where: { name: UNRELATED_CATEGORY } });
    expect(before).not.toBeNull();

    runSeed();

    const after = await prisma.category.findUnique({ where: { name: UNRELATED_CATEGORY } });
    expect(after).not.toBeNull();
    expect(after!.id).toBe(before!.id);
    expect(after!.name).toBe(before!.name);
  }, 60000);

  itIfDb("SEED-01: is idempotent — running the seed twice creates no duplicates", async () => {
    const prisma = getPrisma();

    runSeed();
    const categories1 = await prisma.category.count();
    const requesters1 = await prisma.devRequester.count();
    const systems1 = await prisma.relatedSystem.count();

    runSeed();
    const categories2 = await prisma.category.count();
    const requesters2 = await prisma.devRequester.count();
    const systems2 = await prisma.relatedSystem.count();

    expect(categories2).toBe(categories1);
    expect(requesters2).toBe(requesters1);
    expect(systems2).toBe(systems1);

    // The four required categories remain exactly once each.
    for (const name of REQUIRED_CATEGORIES) {
      const count = await prisma.category.count({ where: { name } });
      expect(count).toBe(1);
    }
  }, 60000);
});
