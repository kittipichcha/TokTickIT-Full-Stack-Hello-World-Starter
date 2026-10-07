import { Prisma, type Priority } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { OPEN_TICKET_STATUSES } from "./ticket-dashboard-filters.js";
import { TICKET_STATUSES } from "./ticket-status.js";

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const ticketOrder = [{ updatedAt: "desc" }, { ticketNumber: "desc" }] as const;
const ticketSelect = { ticketNumber: true, summary: true, currentStatus: true, updatedAt: true } as const;
const actionSelect = { id: true, description: true, status: true, createdAt: true, ticket: { select: { ticketNumber: true } } } as const;
const open = { currentStatus: { in: [...OPEN_TICKET_STATUSES] } };
const queueLink = (query: Record<string, string>) => ({ path: "/api/staff/queue", query });

/** A single clock and repeatable-read snapshot make counts and summaries coherent. */
export async function getRequesterDashboard(requesterId: number, now = new Date()) {
  const generatedAt = new Date(now);
  const cutoff = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowStart = cutoff.toISOString();
  return getPrisma().$transaction(async (tx) => {
    const own = { requesterId };
    const attention = { ...own, ...open };
    const recent = { ...own, updatedAt: { gte: cutoff } };
    const [openTickets, waitingForRequester, recentlyUpdated, recentlyResolved, attentionTickets, recentTickets] = await Promise.all([
      tx.ticket.count({ where: attention }),
      tx.ticket.count({ where: { ...own, currentStatus: "WAITING_FOR_REQUESTER" } }),
      tx.ticket.count({ where: recent }),
      tx.ticket.count({ where: { ...own, currentStatus: "RESOLVED", resolvedAt: { gte: cutoff } } }),
      tx.ticket.findMany({ where: attention, select: { ...ticketSelect, appearsResolved: true }, orderBy: [...ticketOrder], take: 10 }),
      tx.ticket.findMany({ where: recent, select: { ...ticketSelect, appearsResolved: true }, orderBy: [...ticketOrder], take: 10 }),
    ]);
    return {
      generatedAt: generatedAt.toISOString(), windowStart,
      counts: { openTickets, waitingForRequester, recentlyUpdated, recentlyResolved },
      lists: { attentionTickets, recentTickets },
      drillDowns: {
        openTickets: { path: "/api/tickets", query: { scope: "open" } },
        waitingForRequester: { path: "/api/tickets", query: { status: "WAITING_FOR_REQUESTER" } },
        recentlyUpdated: { path: "/api/tickets", query: { updatedSince: windowStart } },
        recentlyResolved: { path: "/api/tickets", query: { status: "RESOLVED", resolvedSince: windowStart } },
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getStaffDashboard(actorId: number, now = new Date()) {
  const generatedAt = new Date(now);
  const cutoff = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowStart = cutoff.toISOString();
  return getPrisma().$transaction(async (tx) => {
    const unassigned = { ticketOwnerId: null };
    const mine = { ticketOwnerId: actorId };
    const recent = { updatedAt: { gte: cutoff } };
    const urgent = { ...open, itPriority: "HIGH" as const };
    const pendingActions = { assigneeUserId: actorId, status: "PENDING" as const };
    const recentActions = { performedByUserId: actorId, createdAt: { gte: cutoff } };
    const summary = (where: Prisma.TicketWhereInput) => tx.ticket.findMany({ where, select: { ...ticketSelect, itPriority: true }, orderBy: [...ticketOrder], take: 10 });
    const actions = (where: Prisma.ActionTakenWhereInput) => tx.actionTaken.findMany({ where, select: actionSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 });
    const [unassignedTickets, myTickets, statusGroups, priorityGroups, myPendingAssignedActions, myRecentlyPerformedActions, recentlyUpdatedTickets, urgentTickets, unassignedList, mineList, pendingList, actionList, recentList, urgentList] = await Promise.all([
      tx.ticket.count({ where: unassigned }), tx.ticket.count({ where: mine }),
      tx.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      tx.ticket.groupBy({ by: ["itPriority"], _count: { _all: true } }),
      tx.actionTaken.count({ where: pendingActions }), tx.actionTaken.count({ where: recentActions }),
      tx.ticket.count({ where: recent }), tx.ticket.count({ where: urgent }),
      summary(unassigned), summary(mine), actions(pendingActions), actions(recentActions), summary(recent), summary(urgent),
    ]);
    const mapActions = (rows: typeof pendingList) => rows.map(({ ticket, ...row }) => ({ ...row, ticketNumber: ticket.ticketNumber, destination: { path: `/api/tickets/${ticket.ticketNumber}`, anchor: "actions", actionId: row.id } }));
    return {
      generatedAt: generatedAt.toISOString(), windowStart,
      counts: {
        unassignedTickets, myTickets,
        byStatus: Object.fromEntries(TICKET_STATUSES.map(status => [status, statusGroups.find(row => row.currentStatus === status)?._count._all ?? 0])),
        byPriority: Object.fromEntries(priorities.map(priority => [priority, priorityGroups.find(row => row.itPriority === priority)?._count._all ?? 0])),
        myPendingAssignedActions, myRecentlyPerformedActions, recentlyUpdatedTickets, urgentTickets,
      },
      lists: { unassignedTickets: unassignedList, myTickets: mineList, pendingActions: mapActions(pendingList), recentActions: mapActions(actionList), recentTickets: recentList, urgentTickets: urgentList },
      drillDowns: {
        unassignedTickets: queueLink({ ownerScope: "unassigned" }), myTickets: queueLink({ ownerScope: "me" }),
        byStatus: Object.fromEntries(TICKET_STATUSES.map(status => [status, queueLink({ status })])),
        byPriority: Object.fromEntries(priorities.map(priority => [priority, queueLink({ priority })])),
        myPendingAssignedActions: { filter: { assignee: "me", status: "PENDING" } },
        myRecentlyPerformedActions: { filter: { performedBy: "me", createdAtGte: windowStart } },
        recentlyUpdatedTickets: queueLink({ updatedSince: windowStart }), urgentTickets: queueLink({ priority: "HIGH", openOnly: "true" }),
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
