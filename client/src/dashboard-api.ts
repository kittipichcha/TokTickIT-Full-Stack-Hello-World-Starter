import { apiJson } from "./api-client";
import type { MyTicketsParams, StaffQueueParams, ActionStatus } from "./api";
import type { TicketStatus } from "@shared/ticket-status";
export type RequesterTicketDestination = { path: "/api/tickets"; query: MyTicketsParams };
export type StaffTicketDestination = { path: "/api/staff/queue"; query: StaffQueueParams };
export interface ActionDestination { path: string; anchor: "actions"; actionId: number }
export interface DashboardTicket { ticketNumber: string; summary: string; currentStatus: TicketStatus; updatedAt: string }
export interface RequesterDashboardData {
  generatedAt: string; windowStart: string;
  counts: { openTickets: number; waitingForRequester: number; recentlyUpdated: number; recentlyResolved: number };
  lists: { attentionTickets: (DashboardTicket & { appearsResolved: boolean })[]; recentTickets: (DashboardTicket & { appearsResolved: boolean })[] };
  drillDowns: Record<keyof RequesterDashboardData["counts"], RequesterTicketDestination>;
}
export interface DashboardAction { id: number; ticketNumber: string; description: string; status: ActionStatus; createdAt: string; destination: ActionDestination }
export interface StaffDashboardData {
  generatedAt: string; windowStart: string;
  counts: { unassignedTickets: number; myTickets: number; byStatus: Record<TicketStatus, number>; byPriority: Record<"LOW" | "MEDIUM" | "HIGH", number>; myPendingAssignedActions: number; myRecentlyPerformedActions: number; recentlyUpdatedTickets: number; urgentTickets: number };
  lists: { unassignedTickets: (DashboardTicket & { itPriority: "LOW" | "MEDIUM" | "HIGH" | null })[]; myTickets: (DashboardTicket & { itPriority: "LOW" | "MEDIUM" | "HIGH" | null })[]; recentTickets: (DashboardTicket & { itPriority: "LOW" | "MEDIUM" | "HIGH" | null })[]; urgentTickets: (DashboardTicket & { itPriority: "LOW" | "MEDIUM" | "HIGH" | null })[]; pendingActions: DashboardAction[]; recentActions: DashboardAction[] };
  drillDowns: { unassignedTickets: StaffTicketDestination; myTickets: StaffTicketDestination; byStatus: Record<TicketStatus, StaffTicketDestination>; byPriority: Record<"LOW" | "MEDIUM" | "HIGH", StaffTicketDestination>; recentlyUpdatedTickets: StaffTicketDestination; urgentTickets: StaffTicketDestination; myPendingAssignedActions: { filter: { assignee: "me"; status: "PENDING" } }; myRecentlyPerformedActions: { filter: { performedBy: "me"; createdAtGte: string } } };
}
export async function fetchRequesterDashboard(): Promise<RequesterDashboardData> {
  return (await apiJson<{ data: RequesterDashboardData }>("/api/requester/dashboard", { fallbackError: "Unable to load dashboard. Please try again." })).data;
}
export async function fetchStaffDashboard(): Promise<StaffDashboardData> {
  return (await apiJson<{ data: StaffDashboardData }>("/api/staff/dashboard", { fallbackError: "Unable to load dashboard. Please try again." })).data;
}
