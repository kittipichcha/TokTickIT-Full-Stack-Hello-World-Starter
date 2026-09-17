import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

function runSeed(): void {
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverRoot,
    stdio: "pipe",
    env: process.env,
  });
}

describe("SEED-01: Seed idempotency and full mandatory population", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await getPrisma().$queryRawUnsafe("SELECT 1");
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await disconnectPrisma();
  });

  itIfDb("runs twice with identical state and no errors", async () => {
    const prisma = getPrisma();

    runSeed();
    const counts1 = {
      requesters: await prisma.user.count({ where: { role: "REQUESTER" } }),
      staff: await prisma.user.count({ where: { role: "IT_STAFF" } }),
      admins: await prisma.user.count({ where: { role: "ADMINISTRATOR" } }),
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      tickets: await prisma.ticket.count(),
    };

    runSeed();
    const counts2 = {
      requesters: await prisma.user.count({ where: { role: "REQUESTER" } }),
      staff: await prisma.user.count({ where: { role: "IT_STAFF" } }),
      admins: await prisma.user.count({ where: { role: "ADMINISTRATOR" } }),
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      tickets: await prisma.ticket.count(),
    };

    expect(counts2).toEqual(counts1);
  }, 60000);

  itIfDb("populates the mandatory user population", async () => {
    const prisma = getPrisma();

    // >= 4 active + 1 inactive Requester.
    const activeRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: true } });
    const inactiveRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: false } });
    expect(activeRequesters).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);

    // >= 3 active + 1 inactive IT Staff.
    const activeStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } });
    const inactiveStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } });
    expect(activeStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveStaff).toBeGreaterThanOrEqual(1);

    // >= 1 active Administrator.
    const activeAdmins = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(activeAdmins).toBeGreaterThanOrEqual(1);

    // Preserved categories and related systems.
    expect(await prisma.category.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.relatedSystem.count()).toBeGreaterThanOrEqual(6);

    // Realistic tickets across statuses/priorities/ownership.
    const tickets = await prisma.ticket.findMany();
    expect(tickets.length).toBeGreaterThan(0);
    const statuses = new Set(tickets.map((t) => t.currentStatus));
    expect(statuses.size).toBeGreaterThan(1);

    // Example comments and internal notes.
    expect(await prisma.comment.count()).toBeGreaterThan(0);
    expect(await prisma.internalNote.count()).toBeGreaterThan(0);
  });
});