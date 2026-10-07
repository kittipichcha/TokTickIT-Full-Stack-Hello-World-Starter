import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cpus, totalmem, platform, release } from "node:os";
import request from "supertest";
import { Prisma } from "@prisma/client";
import * as dashboards from "../../src/dashboard-service.js";
import { allocateTicketNumber } from "../../src/ticket-number.js";
import type { TestSession } from "../lab-03/helpers/auth.js";
import { buildLab3Baseline, applyLab4Migration, query, type DisposableDb } from "./helpers/migration-fixture.js";

// Each worker creates its own historical/migrated disposable fixture before importing app.
const enabled = Boolean(process.env.DATABASE_URL);
const run = enabled ? it : it.skip;
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
const actionStatuses = ["PENDING", "COMPLETED", "CANCELLED"] as const;
const base = new Date("2026-10-06T12:00:00.000Z");
const marker = `perf54-${Date.now()}`;
const summary = "Dashboard smoke — เครื่องพิมพ์ Unicode example ".padEnd(80, "x");
const ticketDescription = "Deterministic Ticket smoke — ตรวจสอบระบบ ".padEnd(160, "x");
const description = "Deterministic Action smoke — ตรวจสอบระบบ ".padEnd(120, "x");
let requester: TestSession;
let staff: TestSession;
let ticketIds: number[] = [];
let userIds: number[] = [];
let categoryId = 0;
let systemId = 0;
let isolated: DisposableDb | undefined;
const originalUrl = process.env.DATABASE_URL;
let app: typeof import("../../src/app.js").app;
let getPrisma: typeof import("../../src/prisma.js").getPrisma;
let disconnectPrisma: typeof import("../../src/prisma.js").disconnectPrisma;
let loginAs: typeof import("../lab-03/helpers/auth.js").loginAs;
let ensureTestUser: typeof import("../lab-03/helpers/auth.js").ensureTestUser;
let withSession: typeof import("../lab-03/helpers/auth.js").withSession;
const sessionPools: pg.Pool[] = [];

beforeAll(async () => {
  if (!enabled) return;
  isolated = buildLab3Baseline("dashboard_perf_test");
  applyLab4Migration(isolated);
  await query(isolated.dbUrl, 'DELETE FROM "Attachment"; DELETE FROM "Ticket";');
  process.env.DATABASE_URL = isolated.dbUrlWithSchema;
  const RealPool = pg.Pool;
  const poolSpy = vi.spyOn(pg, "Pool").mockImplementation(function (options?: pg.PoolConfig) {
    const pool = new RealPool(options); sessionPools.push(pool); return pool;
  } as unknown as typeof pg.Pool);
  try { ({ app } = await import("../../src/app.js")); } finally { poolSpy.mockRestore(); }
  ({ getPrisma, disconnectPrisma } = await import("../../src/prisma.js"));
  ({ loginAs, ensureTestUser, withSession } = await import("../lab-03/helpers/auth.js"));
  const prisma = getPrisma();
  if (await prisma.ticket.count() || await prisma.actionTaken.count()) {
    throw new Error("PERF-01 requires an empty migrated database, with exactly the defined fixture population.");
  }
  for (const [name, role] of [["requester", "REQUESTER"], ["other-requester", "REQUESTER"], ["empty", "REQUESTER"], ["staff", "IT_STAFF"], ["other-staff", "IT_STAFF"], ["admin", "ADMINISTRATOR"]] as const) {
    userIds.push(await ensureTestUser({ email: `${marker}-${name}@example.com`, name, role }));
  }
  categoryId = (await prisma.category.create({ data: { name: marker } })).id;
  systemId = (await prisma.relatedSystem.create({ data: { name: marker } })).id;
  const numbers: string[] = [];
  for (let index = 0; index < 1000; index++) numbers.push(await allocateTicketNumber(2054));
  const age = (days: number) => new Date(base.getTime() - days * 86_400_000);
  await prisma.ticket.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
    ticketNumber: numbers[index], requesterId: userIds[index % 3], categoryId, relatedSystemId: systemId,
    summary, description: ticketDescription, requestedPriority: "MEDIUM" as const,
    itPriority: [null, ...priorities][Math.floor(index / 8) % 4], currentStatus: statuses[index % 8],
    ticketOwnerId: [null, ...userIds.slice(3)][Math.floor(index / 32) % 4],
    createdAt: age(60), updatedAt: age([0, 1, 6, 7, 8, 30][Math.floor(index / 128) % 6]),
    resolvedAt: index % 8 === 4 ? [null, age(1), age(8)][Math.floor(index / 8) % 3] : null,
  })) });
  ticketIds = (await prisma.ticket.findMany({ orderBy: { ticketNumber: "asc" }, select: { id: true } })).map(item => item.id);
  await prisma.actionTaken.createMany({ data: Array.from({ length: 3000 }, (_, index) => {
    const i = Math.floor(index / 3), j = index % 3;
    const terminal = ["RESOLVED", "CLOSED", "CANCELLED"].includes(statuses[i % 8]);
    const status = terminal ? (["COMPLETED", "CANCELLED", "COMPLETED"] as const)[j] : actionStatuses[j];
    return { ticketId: ticketIds[i], description, performedByUserId: userIds[3 + (i + j) % 3],
      assigneeUserId: [null, ...userIds.slice(3)][(i + j) % 4], status,
      result: status === "COMPLETED" ? "Verified" : null, createdAt: age([0, 1, 7, 8, 30][(i + j) % 5]) };
  }) });
  requester = await loginAs(`${marker}-requester@example.com`);
  staff = await loginAs(`${marker}-staff@example.com`);
  const requesterRead = dashboards.getRequesterDashboard;
  const staffRead = dashboards.getStaffDashboard;
  vi.spyOn(dashboards, "getRequesterDashboard").mockImplementation(id => requesterRead(id, base));
  vi.spyOn(dashboards, "getStaffDashboard").mockImplementation(id => staffRead(id, base));
}, 120_000);

afterAll(async () => {
  if (!enabled) return;
  if (!getPrisma) { isolated?.drop(); process.env.DATABASE_URL = originalUrl; return; }
  const prisma = getPrisma();
  if (ticketIds.length) {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
  if (systemId) await prisma.relatedSystem.delete({ where: { id: systemId } });
  await disconnectPrisma();
  vi.restoreAllMocks();
  await Promise.all(sessionPools.map(pool => pool.end()));
  if (isolated) {
    await query(isolated.adminUrl, "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [isolated.dbName]);
    isolated.drop();
  }
  process.env.DATABASE_URL = originalUrl;
});

describe("PERF-01: fixed 1,000 Ticket / 3,000 Action real database smoke", () => {
  for (const role of ["requester", "staff"] as const) {
    run(`${role}: five warmups, twenty serial samples, p95 <1s and payload <=64KiB`, async () => {
      expect(await getPrisma().ticket.count()).toBe(1000);
      expect(await getPrisma().actionTaken.count()).toBe(3000);
      const session = role === "requester" ? requester : staff;
      const read = () => withSession(request(app).get(`/api/${role}/dashboard`), session);
      for (let index = 0; index < 5; index++) expect((await read()).status).toBe(200);
      const samples: number[] = [];
      const bytes: number[] = [];
      for (let index = 0; index < 20; index++) {
        const start = performance.now();
        const response = await read();
        samples.push(performance.now() - start);
        expect(response.status).toBe(200);
        expect(Object.keys(response.body)).toEqual(["data"]);
        const data = response.body.data;
        expect(Object.keys(data).sort()).toEqual(["counts", "drillDowns", "generatedAt", "lists", "windowStart"]);
        expect(new Date(data.generatedAt).getTime() - new Date(data.windowStart).getTime()).toBe(7 * 86_400_000);
        expect(Object.keys(data.counts).sort()).toEqual((role === "requester"
          ? ["openTickets", "waitingForRequester", "recentlyUpdated", "recentlyResolved"]
          : ["unassignedTickets", "myTickets", "byStatus", "byPriority", "myPendingAssignedActions", "myRecentlyPerformedActions", "recentlyUpdatedTickets", "urgentTickets"]).sort());
        for (const items of Object.values(data.lists)) {
          expect(Array.isArray(items)).toBe(true);
          expect((items as unknown[]).length).toBeLessThanOrEqual(10);
        }
        bytes.push(Buffer.byteLength(response.text, "utf8"));
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const postgres = await getPrisma().$queryRaw<Array<{ version: string }>>`SELECT version()`;
      const measurements = { role, timestamp: new Date().toISOString(), fixtureBase: base.toISOString(), tickets: 1000, actions: 3000,
        distribution: "Exact plan fixture: 8 statuses, nullable/3 priorities, 3 requesters, 2 staff/admin, 3 valid Actions/Ticket; deterministic 6 Ticket/5 Action age buckets",
        summaryCharacters: summary.length, ticketDescriptionCharacters: ticketDescription.length, actionCharacters: description.length, node: process.version, prisma: Prisma.prismaVersion.client,
        postgres: postgres[0].version, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, ramBytes: totalmem(),
        samplesMs: samples, bytes, minMs: sorted[0], medianMs: (sorted[9] + sorted[10]) / 2, p95Ms: sorted[18], maxMs: sorted[19] };
      const evidence = resolve("../artifacts/lab-04/issue-54");
      mkdirSync(evidence, { recursive: true });
      writeFileSync(resolve(evidence, `performance-${role}.json`), JSON.stringify(measurements, null, 2));
      console.log("PERF-01", JSON.stringify(measurements));
      expect(sorted[18]).toBeLessThan(1000);
      expect(Math.max(...bytes)).toBeLessThanOrEqual(65_536);
    }, 120_000);
  }
});
