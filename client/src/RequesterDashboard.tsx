import { fetchRequesterDashboard, type RequesterTicketDestination } from "./dashboard-api";
import { useDashboard, DashboardFrame, DashboardMetric, DashboardWindow, DashboardTicketList } from "./dashboard-ui";
export default function RequesterDashboard({ onOpenTickets, onOpenTicket, onCreateTicket }: { onOpenTickets: (destination: RequesterTicketDestination) => void; onOpenTicket: (number: string) => void; onCreateTicket: () => void }) {
  const state = useDashboard(fetchRequesterDashboard);
  const data = state.data;
  return <DashboardFrame title="Requester Dashboard" {...state}>{data && <>
    <DashboardWindow windowStart={data.windowStart} generatedAt={data.generatedAt} />
    <div className="dashboard-grid">{([ ["openTickets", "Open Tickets"], ["waitingForRequester", "Waiting for Requester"], ["recentlyUpdated", "Recently Updated"], ["recentlyResolved", "Recently Resolved"] ] as const).map(([key, label]) => <DashboardMetric key={key} label={label} count={data.counts[key]} onOpen={() => onOpenTickets(data.drillDowns[key])} />)}</div>
    <div className="dashboard-grid"><DashboardTicketList title="Attention Tickets" items={data.lists.attentionTickets} onOpen={onOpenTicket} emptyAction={<button className="tertiary-button" onClick={onCreateTicket}>Create Ticket</button>} /><DashboardTicketList title="Recent Tickets" items={data.lists.recentTickets} onOpen={onOpenTicket} /></div>
  </>}</DashboardFrame>;
}
