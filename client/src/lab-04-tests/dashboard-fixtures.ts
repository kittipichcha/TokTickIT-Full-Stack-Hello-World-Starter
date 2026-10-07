import type { RequesterDashboardData, StaffDashboardData } from "../dashboard-api";
export const windowStart = "2026-09-29T00:00:00.000Z";
export const requesterDashboard: RequesterDashboardData = {
 generatedAt: "2026-10-06T00:00:00.000Z", windowStart,
 counts: {openTickets: 21, waitingForRequester: 0, recentlyUpdated: 17, recentlyResolved: 2},
 lists: {attentionTickets: [{ticketNumber:"TKT-1",summary:"Own Ticket",currentStatus:"OPEN",updatedAt:windowStart,appearsResolved:true}],recentTickets:[]},
 drillDowns: {openTickets:{path:"/api/tickets",query:{scope:"open"}},waitingForRequester:{path:"/api/tickets",query:{status:"WAITING_FOR_REQUESTER"}},recentlyUpdated:{path:"/api/tickets",query:{updatedSince:windowStart}},recentlyResolved:{path:"/api/tickets",query:{status:"RESOLVED",resolvedSince:windowStart}}}
};
const statuses = ["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","RESOLVED","CLOSED","REOPENED","CANCELLED"] as const;
const priorities = ["LOW","MEDIUM","HIGH"] as const;
export const staffDashboard: StaffDashboardData = {
 generatedAt:requesterDashboard.generatedAt,windowStart,
 counts:{unassignedTickets:23,myTickets:12,byStatus:Object.fromEntries(statuses.map(s=>[s,0])) as StaffDashboardData["counts"]["byStatus"],byPriority:{LOW:0,MEDIUM:0,HIGH:3},myPendingAssignedActions:21,myRecentlyPerformedActions:5,recentlyUpdatedTickets:12,urgentTickets:3},
 lists:{unassignedTickets:[],myTickets:[],recentTickets:[],urgentTickets:[],pendingActions:[{id:21,ticketNumber:"TKT-1",description:"Action twenty one",status:"PENDING",createdAt:windowStart,destination:{path:"/api/tickets/TKT-1",anchor:"actions",actionId:21}}],recentActions:[]},
 drillDowns:{unassignedTickets:{path:"/api/staff/queue",query:{ownerScope:"unassigned"}},myTickets:{path:"/api/staff/queue",query:{ownerScope:"me"}},byStatus:Object.fromEntries(statuses.map(status=>[status,{path:"/api/staff/queue",query:{status}}])) as StaffDashboardData["drillDowns"]["byStatus"],byPriority:Object.fromEntries(priorities.map(priority=>[priority,{path:"/api/staff/queue",query:{priority}}])) as StaffDashboardData["drillDowns"]["byPriority"],recentlyUpdatedTickets:{path:"/api/staff/queue",query:{updatedSince:windowStart}},urgentTickets:{path:"/api/staff/queue",query:{priority:"HIGH",openOnly:"true"}},myPendingAssignedActions:{filter:{assignee:"me",status:"PENDING"}},myRecentlyPerformedActions:{filter:{performedBy:"me",createdAtGte:windowStart}}}
};
