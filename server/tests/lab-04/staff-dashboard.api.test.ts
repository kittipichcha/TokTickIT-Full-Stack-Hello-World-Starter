import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
let app: typeof import("../../src/app.js").app;
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";
let withSession: typeof import("../lab-03/helpers/auth.js").withSession;
import { dashboardFixture, prepareDashboardDatabase, importDashboardApp, CLOCK, CUTOFF } from "./helpers/dashboard-fixtures.js";
import { OPEN_TICKET_STATUSES } from "../../src/ticket-dashboard-filters.js";
import { TICKET_STATUSES } from "../../src/ticket-status.js";
import { PrismaClient, type Prisma } from "@prisma/client";
const db = process.env.DATABASE_URL ? it : it.skip;
let f: Awaited<ReturnType<typeof dashboardFixture>>;
let isolation: Awaited<ReturnType<typeof prepareDashboardDatabase>>;
let application: Awaited<ReturnType<typeof importDashboardApp>>;
beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  isolation = await prepareDashboardDatabase("staff_dash_test");
  application = await importDashboardApp(); app = application.app;
  ({ withSession } = await import("../lab-03/helpers/auth.js"));
  f = await dashboardFixture();
  const { seedAction } = await import("./helpers/action-fixtures.js");
  for (let i=0;i<21;i++) await seedAction({ ticketId:f.ticketId, performedByUserId:i%3 === 0 ? f.otherStaff.id : f.staff.id, assigneeUserId:i%2 ? f.staff.id : f.otherStaff.id, description:`Action ${i}`, status:i%3 === 0 ? "CANCELLED" : i%3 === 1 ? "PENDING" : "COMPLETED", result:i%3 === 2 ? "Done" : null, createdAt:new Date(CUTOFF.getTime()+[-1,0,1][i%3]!) });
}, 120000);
afterAll(async () => { vi.useRealTimers(); if (f) await f.cleanup(); if (application) await application.closeSessions(); await disconnectPrisma(); if (isolation) await isolation.cleanup(); });
const get = (path:string) => withSession(request(app).get(path),f.staff.session);
describe("API-DASH-02/03 Staff dashboard", () => {
  db("matches independent database oracle and every Queue drill-down, with exact Action destinations", async () => {
    const service = await import("../../src/dashboard-service.js");
    const actual = service.getStaffDashboard;
    const clock = vi.spyOn(service, "getStaffDashboard").mockImplementation(userId => actual(userId, CLOCK));
    const tickets=await getPrisma().ticket.findMany(), actions=await getPrisma().actionTaken.findMany();
    const r=await get("/api/staff/dashboard?userId="+f.otherStaff.id); expect(r.status).toBe(200); const d=r.body.data;
    const urgent=tickets.filter(t=>t.itPriority === "HIGH" && (OPEN_TICKET_STATUSES as readonly string[]).includes(t.currentStatus));
    expect(d.counts).toEqual({ unassignedTickets:tickets.filter(t=>t.ticketOwnerId===null).length,myTickets:tickets.filter(t=>t.ticketOwnerId===f.staff.id).length,byStatus:Object.fromEntries(TICKET_STATUSES.map(s=>[s,tickets.filter(t=>t.currentStatus===s).length])),byPriority:Object.fromEntries(["LOW","MEDIUM","HIGH"].map(p=>[p,tickets.filter(t=>t.itPriority===p).length])),myPendingAssignedActions:actions.filter(a=>a.assigneeUserId===f.staff.id && a.status==="PENDING").length,myRecentlyPerformedActions:actions.filter(a=>a.performedByUserId===f.staff.id && a.createdAt>=CUTOFF).length,recentlyUpdatedTickets:tickets.filter(t=>t.updatedAt>=CUTOFF).length,urgentTickets:urgent.length });
    const ticketCases:[string,any][]=[
      ["unassignedTickets",d.drillDowns.unassignedTickets],
      ["myTickets",d.drillDowns.myTickets],
      ["recentlyUpdatedTickets",d.drillDowns.recentlyUpdatedTickets],
      ["urgentTickets",d.drillDowns.urgentTickets],
      ...Object.entries(d.drillDowns.byStatus).map(([name,link])=>[`status:${name}`,link] as [string,any]),
      ...Object.entries(d.drillDowns.byPriority).map(([name,link])=>[`priority:${name}`,link] as [string,any]),
    ];
    const oracleFor=(name:string)=>{
      if(name==="unassignedTickets")return tickets.filter(t=>t.ticketOwnerId===null);
      if(name==="myTickets")return tickets.filter(t=>t.ticketOwnerId===f.staff.id);
      if(name==="recentlyUpdatedTickets")return tickets.filter(t=>t.updatedAt>=CUTOFF);
      if(name==="urgentTickets")return urgent;
      if(name.startsWith("status:"))return tickets.filter(t=>t.currentStatus===name.slice(7));
      return tickets.filter(t=>t.itPriority===name.slice(9));
    };
    for(const [name,link] of ticketCases){
      const expected=oracleFor(name).map(t=>t.ticketNumber).sort();
      const query=new URLSearchParams(Object.entries(link.query).map(([key,value])=>[key,String(value)]));
      query.set("pageSize","50");
      let page=1; let actual:string[]=[]; let totalItems=-1; let totalPages=0;
      do{
        query.set("page",String(page));
        const res=await get(`${link.path}?${query}`);
        expect(res.status).toBe(200);
        totalItems=res.body.pagination.totalItems;
        totalPages=res.body.pagination.totalPages;
        actual.push(...res.body.data.map((ticket:{ticketNumber:string})=>ticket.ticketNumber));
        page++;
      }while(page<=totalPages);
      expect(totalItems).toBe(expected.length);
      expect(actual.sort()).toEqual(expected);
    }
    expect(d.drillDowns.myPendingAssignedActions).toEqual({filter:{assignee:"me",status:"PENDING"}});
    expect(d.drillDowns.myRecentlyPerformedActions).toEqual({filter:{performedBy:"me",createdAtGte:CUTOFF.toISOString()}});
    for (const key of ["pendingActions","recentActions"]) {
      const expected=actions.filter(a=>key==="pendingActions" ? a.assigneeUserId===f.staff.id && a.status==="PENDING" : a.performedByUserId===f.staff.id && a.createdAt>=CUTOFF).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.id-a.id).slice(0,10);
      expect(d.lists[key].map((a:any)=>a.id)).toEqual(expected.map(a=>a.id));
      for (const row of d.lists[key]) { expect(Object.keys(row).sort()).toEqual(["createdAt","description","destination","id","status","ticketNumber"]); expect(row.destination).toEqual({path:`/api/tickets/${row.ticketNumber}`,anchor:"actions",actionId:row.id}); const target=await get(`${row.destination.path}/actions/${row.id}`); expect(target.status).toBe(200); expect(target.body.data.id).toBe(row.id); }
    }
    for (const key of ["unassignedTickets","myTickets","recentTickets","urgentTickets"]) {
      const expected = oracleFor(key === "recentTickets" ? "recentlyUpdatedTickets" : key)
        .sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.ticketNumber.localeCompare(a.ticketNumber))
        .slice(0,10);
      expect(d.lists[key].map((ticket: {ticketNumber:string}) => ticket.ticketNumber)).toEqual(expected.map(ticket => ticket.ticketNumber));
      expect(d.lists[key].length).toBeLessThanOrEqual(10);
      for(const row of d.lists[key]) expect(Object.keys(row).sort()).toEqual(["currentStatus","itPriority","summary","ticketNumber","updatedAt"]);
    }
    clock.mockRestore();
  });
  db("enforces role gates, Admin session mine, safe failures and legacy fallback",async()=>{
    expect((await request(app).get("/api/staff/dashboard")).status).toBe(401);
    expect((await withSession(request(app).get("/api/staff/dashboard"),f.requester.session)).status).toBe(403);
    const admin=await withSession(request(app).get("/api/staff/dashboard"),f.admin.session); expect(admin.status).toBe(200); expect(admin.body.data.counts.myTickets).toBe(await getPrisma().ticket.count({where:{ticketOwnerId:f.admin.id}}));
    expect((await get("/api/staff/queue?ownerId=bad&status=bad")).status).toBe(200);
    const spy=vi.spyOn(getPrisma(),"$transaction").mockRejectedValueOnce(new Error("private-secret")); try { const res=await get("/api/staff/dashboard"); expect(res.status).toBe(500); expect(res.body).toEqual({error:{code:"INTERNAL_ERROR",message:"An unexpected error occurred."}}); } finally { spy.mockRestore(); }
  });
  db.each(["ownerScope=bad","ownerScope=","ownerScope[bad]=me","ownerScope=me&ownerId=bad","openOnly=1","openOnly=","updatedSince=bad"])("rejects extension %s",async query=>{const r=await get("/api/staff/queue?"+query);expect(r.status).toBe(400);expect(r.body.error.code).toBe("VALIDATION_ERROR");});
  db("preserves first duplicate semantics, false openOnly and combined legacy predicates",async()=>{
    const first=await get("/api/staff/queue?openOnly=true&openOnly=false&ownerScope=me&priority=HIGH&updatedSince="+CUTOFF.toISOString());expect(first.status).toBe(200);
    const expected=f.tickets.filter(t=>t.ticketOwnerId===f.staff.id&&t.itPriority==="HIGH"&&(OPEN_TICKET_STATUSES as readonly string[]).includes(t.currentStatus)&&t.updatedAt>=CUTOFF);
    expect(first.body.pagination.totalItems).toBe(expected.length);
    const all=await get("/api/staff/queue?openOnly=false");expect(all.body.pagination.totalItems).toBe(await getPrisma().ticket.count());
  });
  db("keeps count and summary in one repeatable-read snapshot during a concurrent writer", async () => {
    const prisma=getPrisma(); const target=f.tickets.find(t=>t.ticketOwnerId===null)!;
    const writer=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL}}});
    const actual=prisma.$transaction.bind(prisma); let changed=false;
    const spy=vi.spyOn(prisma,"$transaction").mockImplementation((async (callback: (tx: Prisma.TransactionClient)=>Promise<unknown>, options: unknown) => actual(async tx=>{
      const count=tx.ticket.count.bind(tx.ticket);
      const proxy=new Proxy(tx,{get(object,key){if(key!=="ticket") return Reflect.get(object,key);return new Proxy(tx.ticket,{get(delegate,method){if(method!=="count")return Reflect.get(delegate,method);return async (args: Parameters<typeof count>[0])=>{const result=await count(args);if(!changed){changed=true;await writer.ticket.update({where:{id:target.id},data:{ticketOwnerId:f.staff.id}});}return result;};}});}});
      return callback(proxy);
    },options as Parameters<typeof actual>[1])) as typeof prisma.$transaction);
    try {
      const r=await get("/api/staff/dashboard"); expect(r.status).toBe(200); expect(changed).toBe(true);
      expect(r.body.data.counts.unassignedTickets).toBe(f.tickets.filter(t=>t.ticketOwnerId===null).length);
      expect(r.body.data.lists.unassignedTickets.some((t:any)=>t.ticketNumber===target.ticketNumber)).toBe(true);
      expect((await writer.ticket.findUniqueOrThrow({where:{id:target.id}})).ticketOwnerId).toBe(f.staff.id);
    } finally { spy.mockRestore(); await writer.ticket.update({where:{id:target.id},data:{ticketOwnerId:target.ticketOwnerId,updatedAt:target.updatedAt}});await writer.$disconnect(); }
  });
  db("returns complete zero schema from a truly empty isolated staff database", async () => {
    const ids=[f.ticketId,...f.tickets.map(t=>t.id)];
    await getPrisma().actionTaken.deleteMany({where:{ticketId:{in:ids}}});
    await getPrisma().ticket.deleteMany({where:{id:{in:ids}}});
    expect(await getPrisma().ticket.count()).toBe(0);
    const r=await get("/api/staff/dashboard"); expect(r.status).toBe(200);
    expect(r.body.data.counts).toEqual({unassignedTickets:0,myTickets:0,byStatus:Object.fromEntries(TICKET_STATUSES.map(s=>[s,0])),byPriority:{LOW:0,MEDIUM:0,HIGH:0},myPendingAssignedActions:0,myRecentlyPerformedActions:0,recentlyUpdatedTickets:0,urgentTickets:0});
    expect(r.body.data.lists).toEqual({unassignedTickets:[],myTickets:[],pendingActions:[],recentActions:[],recentTickets:[],urgentTickets:[]});
    expect(Object.keys(r.body.data.drillDowns.byStatus)).toEqual(TICKET_STATUSES);
  });
});
