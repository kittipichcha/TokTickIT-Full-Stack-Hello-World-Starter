import { afterAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { disconnectPrisma, getPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));
const ACTION_MARKER = "[seed-action:";
const TICKET_MARKER = "[seed:";

function runSeed(): void {
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverRoot,
    stdio: "pipe",
    env: process.env,
  });
}

async function readSeedSnapshot() {
  const prisma = getPrisma();
  const tickets = await prisma.ticket.findMany({
    where: { description: { contains: TICKET_MARKER } },
    select: { id: true, ticketOwnerId: true, currentStatus: true, requestedPriority: true, itPriority: true },
    orderBy: { id: "asc" },
  });
  const actions = await prisma.actionTaken.findMany({
    where: { description: { contains: ACTION_MARKER } },
    select: {
      id: true,
      ticketId: true,
      description: true,
      status: true,
      performedByUserId: true,
      assigneeUserId: true,
      version: true,
      revisions: { orderBy: { id: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  return {
    tickets,
    actions,
    perTicketCounts: tickets.map(({ id }) => [id, actions.filter((action) => action.ticketId === id).length]),
  };
}

describe("DB-SEED-01: Actions fixtures are repeatable and non-destructive", () => {
  afterAll(async () => {
    if (process.env.DATABASE_URL) await disconnectPrisma();
  });

  itIfDb("creates owned zero/one/many Action fixtures once with varied identities and statuses", async () => {
    runSeed();
    const snapshot = await readSeedSnapshot();
    const firstActions = snapshot.actions;

    expect(firstActions).toHaveLength(3);
    expect(firstActions.map((action) => action.status).sort()).toEqual([
      "CANCELLED",
      "COMPLETED",
      "PENDING",
    ]);
    expect(firstActions.filter((action) => action.assigneeUserId === null)).toHaveLength(1);
    expect(firstActions.filter((action) => action.assigneeUserId !== null && action.assigneeUserId !== action.performedByUserId)).toHaveLength(2);
    expect(firstActions.filter((action) => action.status !== "PENDING").every((action) => action.revisions.length === 1)).toBe(true);
    expect(firstActions.filter((action) => action.status === "PENDING").every((action) => action.revisions.length === 0)).toBe(true);

    const counts = snapshot.perTicketCounts.map(([, count]) => count as number);
    expect(counts.some((count) => count === 0)).toBe(true);
    expect(counts.some((count) => count === 1)).toBe(true);
    expect(counts.some((count) => count >= 2)).toBe(true);
    expect(snapshot.tickets.some((ticket) => ticket.ticketOwnerId === null)).toBe(true);
    expect(snapshot.tickets.some((ticket) => ticket.ticketOwnerId !== null)).toBe(true);
    expect(new Set(snapshot.tickets.map((ticket) => ticket.currentStatus))).toEqual(
      new Set(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "NEW", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]),
    );
    expect(new Set(snapshot.tickets.map((ticket) => ticket.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
  }, 60000);

  itIfDb("is idempotent across two runs and preserves Actions, per-Ticket counts, and revisions", async () => {
    runSeed();
    const first = await readSeedSnapshot();

    runSeed();
    const second = await readSeedSnapshot();

    expect(second).toEqual(first);
    expect(new Set(second.actions.map((action) => action.id)).size).toBe(3);
  }, 60000);

  itIfDb("keeps additive dashboard dates and edited fixtures unchanged on re-seeding", async () => {
    runSeed();
    const prisma = getPrisma();
    const rows = await prisma.ticket.findMany({ where: { description: { contains: '[seed:dashboard-' } }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(4);
    const recent = rows.find(row => row.description.includes('dashboard-recent-resolved'))!;
    const old = rows.find(row => row.description.includes('dashboard-old-resolved'))!;
    expect(recent.resolvedAt!.getTime()).toBeGreaterThan(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(old.resolvedAt!.getTime()).toBeLessThan(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const legacy = await prisma.ticket.findFirstOrThrow({ where: { description: { contains: '[seed:printer-network]' } } });
    expect(legacy.resolvedAt).toBeNull();
    const action = await prisma.actionTaken.findFirstOrThrow({ where: { description: { contains: '[seed-dashboard-action:' } } });
    expect(action.status).toBe('PENDING'); expect(action.assigneeUserId).not.toBeNull(); expect(action.assigneeUserId).not.toBe(action.performedByUserId);
    try {
      const edited = await prisma.ticket.update({ where: { id: recent.id }, data: { summary: 'Legitimate edited dashboard demo', currentStatus: 'REOPENED', resolvedAt: null } });
      runSeed();
      expect(await prisma.ticket.findUnique({ where: { id: recent.id } })).toEqual(edited);
      expect(await prisma.actionTaken.findUnique({ where: { id: action.id } })).toEqual(action);
    } finally { await prisma.ticket.update({ where: { id: recent.id }, data: { summary: recent.summary, currentStatus: recent.currentStatus, resolvedAt: recent.resolvedAt, updatedAt: recent.updatedAt } }); }
  }, 60000);
});
