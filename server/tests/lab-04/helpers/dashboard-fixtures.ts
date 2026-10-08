import { getPrisma } from "../../../src/prisma.js";
import { allocateTicketNumber } from "../../../src/ticket-number.js";
import type { Ticket } from "@prisma/client";
import { TICKET_STATUSES } from "../../../src/ticket-status.js";
import { buildLab3Baseline, applyLab4Migration, query } from "./migration-fixture.js";
import pg from "pg";
import { vi } from "vitest";

export async function importDashboardApp() {
  const pools: pg.Pool[] = [];
  const RealPool = pg.Pool;
  const spy = vi.spyOn(pg, "Pool").mockImplementation(function(options: pg.PoolConfig) {
    const pool = new RealPool(options); pools.push(pool); return pool;
  } as unknown as typeof pg.Pool);
  try {
    const { app } = await import("../../../src/app.js");
    return { app, closeSessions: async () => { await Promise.all(pools.map(pool => pool.end())); } };
  } finally { spy.mockRestore(); }
}

/** Prepare the database before any app/session/auth import in each worker. */
export async function prepareDashboardDatabase(label: string) {
  const originalUrl = process.env.DATABASE_URL;
  const db = buildLab3Baseline(label);
  applyLab4Migration(db);
  await query(db.dbUrl, 'DELETE FROM "Attachment"; DELETE FROM "Ticket";');
  process.env.DATABASE_URL = db.dbUrlWithSchema;
  return { db, cleanup: async () => {
    await (await import("../../../src/prisma.js")).disconnectPrisma();
    process.env.DATABASE_URL = originalUrl;
    await query(db.adminUrl, 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [db.dbName]);
    db.drop();
  } };
}

export const CLOCK = new Date("2026-10-06T12:00:00.000Z");
export const CUTOFF = new Date("2026-09-29T12:00:00.000Z");
export async function dashboardFixture() {
  const { createActionFixture } = await import("./action-fixtures.js");
  const f = await createActionFixture();
  const prisma = getPrisma();
  const template = await prisma.ticket.findUniqueOrThrow({ where: { id: f.ticketId } });
  const tickets: Ticket[] = [];
  for (let i = 0; i < 27; i++) {
    const currentStatus = i >= 24 ? "RESOLVED" : TICKET_STATUSES[i % 8]!;
    const updatedAt = new Date(CUTOFF.getTime() + [-1, 0, 1][i % 3]!);
    const ticket = await prisma.ticket.create({ data: {
      ticketNumber: await allocateTicketNumber(2026), requesterId: i === 23 ? f.otherRequester.id : f.requester.id,
      categoryId: template.categoryId, relatedSystemId: template.relatedSystemId,
      summary: `Dashboard ${i}`, description: "private-ticket-sentinel", requestedPriority: "MEDIUM",
      itPriority: [null, "LOW", "MEDIUM", "HIGH"][i % 4] as "LOW" | "MEDIUM" | "HIGH" | null,
      ticketOwnerId: [null, f.staff.id, f.otherStaff.id, f.admin.id][i % 4], currentStatus,
      updatedAt, createdAt: new Date("2026-09-01T00:00:00.000Z"),
      resolvedAt: currentStatus === "RESOLVED" ? (i === 4 ? null : updatedAt) : (currentStatus === "CLOSED" ? CLOCK : null), appearsResolved: i % 2 === 0,
    } });
    tickets.push(ticket);
  }
  await prisma.ticket.update({ where: { id: f.ticketId }, data: { updatedAt: new Date("2026-08-01T00:00:00Z") } });
  return { ...f, tickets, cleanup: async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tickets.map(t => t.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
    await f.cleanup();
  } };
}
