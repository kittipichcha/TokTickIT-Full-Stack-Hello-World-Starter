import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
let app: typeof import("../../src/app.js").app;
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
let withSession: typeof import("../lab-03/helpers/auth.js").withSession;
import { dashboardFixture, prepareDashboardDatabase, importDashboardApp, CLOCK, CUTOFF } from "./helpers/dashboard-fixtures.js";
import { OPEN_TICKET_STATUSES, parseRequesterDashboardFilters } from "../../src/ticket-dashboard-filters.js";

const db = process.env.DATABASE_URL ? it : it.skip;
let f: Awaited<ReturnType<typeof dashboardFixture>>;
let isolation: Awaited<ReturnType<typeof prepareDashboardDatabase>>;
let application: Awaited<ReturnType<typeof importDashboardApp>>;
beforeAll(async () => { if (!process.env.DATABASE_URL) return; isolation = await prepareDashboardDatabase("requester_dash_test"); application = await importDashboardApp(); app = application.app; ({ withSession } = await import("../lab-03/helpers/auth.js")); f = await dashboardFixture(); }, 120000);
afterAll(async () => { vi.useRealTimers(); if (f) await f.cleanup(); if (application) await application.closeSessions(); await disconnectPrisma(); if (isolation) await isolation.cleanup(); });
const get = (path: string) => withSession(request(app).get(path), f.requester.session);


describe("API-DASH-01/03 Requester dashboard", () => {
  db("calculates owned exact boundaries, projects bounded sorted rows and preserves database state", async () => {
    const service = await import("../../src/dashboard-service.js");
    const actual = service.getRequesterDashboard;
    const clock = vi.spyOn(service, "getRequesterDashboard").mockImplementation(userId => actual(userId, CLOCK));
    const before = await getPrisma().ticket.findMany({ where: { requesterId: f.requester.id } });
    const res = await get("/api/requester/dashboard?requesterId=" + f.otherRequester.id);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(Object.keys(d).sort()).toEqual(["counts", "drillDowns", "generatedAt", "lists", "windowStart"]);
    expect(d.generatedAt).toBe(CLOCK.toISOString()); expect(d.windowStart).toBe(CUTOFF.toISOString());
    const open = before.filter(t => (OPEN_TICKET_STATUSES as readonly string[]).includes(t.currentStatus));
    const recent = before.filter(t => t.updatedAt >= CUTOFF);
    expect(d.counts).toEqual({ openTickets: open.length, waitingForRequester: before.filter(t => t.currentStatus === "WAITING_FOR_REQUESTER").length, recentlyUpdated: recent.length, recentlyResolved: before.filter(t => t.currentStatus === "RESOLVED" && t.resolvedAt && t.resolvedAt >= CUTOFF).length });
    const sorted = (rows: typeof before) => rows.sort((a,b) => b.updatedAt.getTime()-a.updatedAt.getTime() || b.ticketNumber.localeCompare(a.ticketNumber)).slice(0,10).map(t => t.ticketNumber);
    expect(d.lists.attentionTickets.map((t: any) => t.ticketNumber)).toEqual(sorted(open));
    expect(d.lists.recentTickets.map((t: any) => t.ticketNumber)).toEqual(sorted(recent));
    for (const rows of Object.values(d.lists) as any[][]) for (const row of rows) expect(Object.keys(row).sort()).toEqual(["appearsResolved","currentStatus","summary","ticketNumber","updatedAt"]);
    for (const [name, link] of Object.entries(d.drillDowns) as [string, any][]) {
      const list = await get(link.path + "?" + new URLSearchParams({ ...link.query, pageSize: "50" }));
      expect(list.status).toBe(200); expect(list.body.pagination.totalItems).toBe(d.counts[name]);
      expect(list.body.data).toHaveLength(d.counts[name]);
      const expected = name === "openTickets" ? open : name === "waitingForRequester" ? before.filter(t=>t.currentStatus==="WAITING_FOR_REQUESTER") : name === "recentlyUpdated" ? recent : before.filter(t=>t.currentStatus==="RESOLVED" && t.resolvedAt && t.resolvedAt>=CUTOFF);
      expect(list.body.data.map((t:any)=>t.ticketNumber).sort()).toEqual(expected.map(t=>t.ticketNumber).sort());
      const page1=await get(link.path+"?"+new URLSearchParams({...link.query,pageSize:"10"}));
      if(expected.length>10) { const page2=await get(link.path+"?"+new URLSearchParams({...link.query,pageSize:"10",page:"2"})); expect(new Set([...page1.body.data,...page2.body.data].map((t:any)=>t.ticketNumber)).size).toBe(expected.length); }
    }
    expect(await getPrisma().ticket.findMany({ where: { requesterId: f.requester.id } })).toEqual(before);
    clock.mockRestore();
  });
  db("requires real session and exact Requester role without leaking data", async () => {
    expect((await request(app).get("/api/requester/dashboard")).status).toBe(401);
    for (const session of [f.staff.session, f.admin.session]) { const r = await withSession(request(app).get("/api/requester/dashboard"), session); expect(r.status).toBe(403); expect(r.body.data).toBeUndefined(); }
    const { ensureAndLogin } = await import("../lab-03/helpers/auth.js");
    const empty = await ensureAndLogin({ email: `empty-${f.suffix}@example.com`, name: "Empty", role: "REQUESTER" });
    try { const res = await withSession(request(app).get("/api/requester/dashboard"),empty);expect(res.status).toBe(200); const d=res.body.data;expect(d.counts).toEqual({ openTickets:0,waitingForRequester:0,recentlyUpdated:0,recentlyResolved:0 }); expect(d.lists).toEqual({ attentionTickets:[],recentTickets:[] }); expect(Object.keys(d.drillDowns)).toHaveLength(4); } finally { await getPrisma().user.delete({ where: { id: empty.userId } }); }
  });
  db("combines extensions with old filters using AND and preserves no-extension population", async () => {
    const own=await getPrisma().ticket.findMany({where:{requesterId:f.requester.id}});
    const all=await get("/api/tickets?pageSize=50");expect(all.status).toBe(200);expect(all.body.pagination.totalItems).toBe(own.length);
    const r=await get("/api/tickets?scope=open&updatedSince="+CUTOFF.toISOString()+"&search=Dashboard&requestedPriority=MEDIUM");
    const expected=own.filter(t=>(OPEN_TICKET_STATUSES as readonly string[]).includes(t.currentStatus)&&t.updatedAt>=CUTOFF&&t.summary.includes("Dashboard")&&t.requestedPriority==="MEDIUM");
    expect(r.status).toBe(200);expect(r.body.pagination.totalItems).toBe(expected.length);
  });
  db("honors password, inactive, and logged-out live sessions", async () => {
    const { loginAs }=await import("../lab-03/helpers/auth.js");
    await getPrisma().user.update({where:{id:f.otherRequester.id},data:{mustChangePassword:true}});
    try { const r=await withSession(request(app).get("/api/requester/dashboard"),f.otherRequester.session); expect(r.status).toBe(401);expect(r.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED"); } finally {await getPrisma().user.update({where:{id:f.otherRequester.id},data:{mustChangePassword:false}});}
    const live=await loginAs(f.otherRequester.email);
    await getPrisma().user.update({where:{id:f.otherRequester.id},data:{isActive:false}});
    try {expect((await withSession(request(app).get("/api/requester/dashboard"),live)).status).toBe(401);}finally {await getPrisma().user.update({where:{id:f.otherRequester.id},data:{isActive:true}});}
    const logout=await loginAs(f.otherRequester.email);expect((await withSession(request(app).post("/api/auth/logout"),logout,{csrf:true})).status).toBe(200);expect((await withSession(request(app).get("/api/requester/dashboard"),logout)).status).toBe(401);
  });
  db.each(["scope=closed","scope=","scope[bad]=open","scope=open&status=NEW","updatedSince=","updatedSince=2026-02-30T00:00:00Z","updatedSince=2026-09-29T12:00:00%2B01:00","resolvedSince=bad"])("rejects extension %s safely", async query => { const r=await get("/api/tickets?"+query); expect(r.status).toBe(400); expect(r.body.error.code).toBe("VALIDATION_ERROR"); expect(r.body.data).toBeUndefined(); });
  db("retains first duplicate scalar semantics and accepts zero-offset UTC", async () => {
    const r=await get("/api/tickets?scope=open&scope=bad&updatedSince=2026-09-29T12:00:00%2B00:00");expect(r.status).toBe(200);
    const z=await get("/api/tickets?scope=open&updatedSince=2026-09-29T12:00:00Z");expect(r.body).toEqual(z.body);
  });
  it("accepts leap-day UTC but rejects nonexistent dates and non-scalar timestamps", () => {
    expect(parseRequesterDashboardFilters({ updatedSince: "2024-02-29T00:00:00Z" }).updatedSince?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    for (const raw of ["2023-02-29T00:00:00Z",[],{},"2026-01-01T24:00:00Z"]) expect(() => parseRequesterDashboardFilters({ updatedSince:raw })).toThrow();
    expect(parseRequesterDashboardFilters({updatedSince:"2026-01-01T00:00:00.123456+00:00"}).updatedSince?.toISOString()).toBe("2026-01-01T00:00:00.123Z");
  });
});
