import { afterAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { disconnectPrisma, getPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));
const ACTION_MARKER = "[seed-action:";

function runSeed(): void {
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverRoot,
    stdio: "pipe",
    env: process.env,
  });
}

describe("DB-SEED-01: Actions fixtures are repeatable and non-destructive", () => {
  afterAll(async () => {
    if (process.env.DATABASE_URL) await disconnectPrisma();
  });

  itIfDb("creates owned zero/one/many Action fixtures once with varied identities and statuses", async () => {
    runSeed();
    const prisma = getPrisma();
    const firstActions = await prisma.actionTaken.findMany({
      where: { description: { contains: ACTION_MARKER } },
      include: { revisions: true },
      orderBy: { id: "asc" },
    });

    expect(firstActions).toHaveLength(3);
    expect(firstActions.map((action) => action.status).sort()).toEqual([
      "CANCELLED",
      "COMPLETED",
      "PENDING",
    ]);
    expect(firstActions.filter((action) => action.assigneeUserId === null)).toHaveLength(1);
    expect(firstActions.filter((action) => action.assigneeUserId !== null && action.assigneeUserId !== action.performedByUserId)).toHaveLength(2);
    expect(firstActions.filter((action) => action.status !== "PENDING").every((action) => action.revisions.length === 1)).toBe(true);
  }, 60000);

  itIfDb("is idempotent across two runs and preserves the owned Action identities", async () => {
    const prisma = getPrisma();
    runSeed();
    const first = await prisma.actionTaken.findMany({
      where: { description: { contains: ACTION_MARKER } },
      select: { id: true, description: true, version: true },
      orderBy: { id: "asc" },
    });

    runSeed();
    const second = await prisma.actionTaken.findMany({
      where: { description: { contains: ACTION_MARKER } },
      select: { id: true, description: true, version: true },
      orderBy: { id: "asc" },
    });

    expect(second).toEqual(first);
    expect(await prisma.actionTakenRevision.count({ where: { actionId: { in: first.map((action) => action.id) } } })).toBe(2);
  }, 60000);
});