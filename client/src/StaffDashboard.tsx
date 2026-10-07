import { fetchStaffDashboard, type StaffTicketDestination, type DashboardAction } from "./dashboard-api";
import { useDashboard, DashboardFrame, DashboardMetric, DashboardWindow, DashboardTicketList } from "./dashboard-ui";
import { formatUtcDate } from "./format";
import type { TicketStatus } from "@shared/ticket-status";
function ActionList({ title, items, onOpen }: { title: string; items: DashboardAction[]; onOpen: (ticketNumber: string, actionId: number) => void }) {
  return <section className="dashboard-list" aria-label={title}><h2>{title}</h2><p className="muted">Latest matching Actions, up to 10.</p>{!items.length ? <p>No matching Actions. Individual Actions appear here when work matches this metric.</p> : <ul>{items.map(action => <li key={action.id}><a href={`#actions-${action.id}`} aria-label={`Action ${action.id} on ${action.ticketNumber}: ${action.description}`} onClick={e => { e.preventDefault(); if (action.destination.path === `/api/tickets/${action.ticketNumber}` && action.destination.anchor === "actions" && action.destination.actionId === action.id) onOpen(action.ticketNumber, action.id); }}>{action.ticketNumber} — {action.description}</a><p>{action.status} · {formatUtcDate(action.createdAt)}</p></li>)}</ul>}</section>;
}
export default function StaffDashboard({ onOpenQueue, onOpenTicket, onOpenAction }: { onOpenQueue: (destination: StaffTicketDestination) => void; onOpenTicket: (number: string) => void; onOpenAction: (number: string, actionId: number) => void }) {
  const state = useDashboard(fetchStaffDashboard); const data = state.data;
  return <DashboardFrame title="Staff Dashboard" {...state}>{data && <>
    <DashboardWindow windowStart={data.windowStart} generatedAt={data.generatedAt} />
    <div className="dashboard-grid">
      {([ ["unassignedTickets", "Unassigned"], ["myTickets", "My Tickets"], ["recentlyUpdatedTickets", "Recently Updated"], ["urgentTickets", "Urgent"] ] as const).map(([key, label]) => <DashboardMetric key={key} label={label} count={data.counts[key]} onOpen={() => onOpenQueue(data.drillDowns[key])} />)}
      {Object.entries(data.counts.byStatus).map(([key, count]) => <DashboardMetric key={key} label={`Status: ${key.replaceAll("_", " ")}`} count={count} onOpen={() => onOpenQueue(data.drillDowns.byStatus[key as TicketStatus])} />)}
      {Object.entries(data.counts.byPriority).map(([key, count]) => <DashboardMetric key={key} label={`IT Priority: ${key}`} count={count} onOpen={() => onOpenQueue(data.drillDowns.byPriority[key as "LOW" | "MEDIUM" | "HIGH"])} />)}
      <DashboardMetric label="My Pending Assigned Actions" count={data.counts.myPendingAssignedActions} emptyCopy="No matching Actions" /><DashboardMetric label="My Recently Performed Actions" count={data.counts.myRecentlyPerformedActions} emptyCopy="No matching Actions" />
    </div>
    <div className="dashboard-grid">{([ ["unassignedTickets", "Unassigned Tickets"], ["myTickets", "My Tickets"], ["recentTickets", "Recent Tickets"], ["urgentTickets", "Urgent Tickets"] ] as const).map(([key, title]) => <DashboardTicketList key={key} title={title} items={data.lists[key]} onOpen={onOpenTicket} />)}<ActionList title="Pending Assigned Actions" items={data.lists.pendingActions} onOpen={onOpenAction} /><ActionList title="Recently Performed Actions" items={data.lists.recentActions} onOpen={onOpenAction} /></div>
  </>}</DashboardFrame>;
}
