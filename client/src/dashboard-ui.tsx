import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ApiError } from "./api-client";
import type { DashboardTicket } from "./dashboard-api";
import { formatUtcDate } from "./format";
export function useDashboard<T>(read: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setData(null); setError(null);
    read().then(value => { if (!cancelled) { setData(value); setLoading(false); } })
      .catch(reason => { if (!cancelled) { setError(reason); setLoading(false); } });
    return () => { cancelled = true; };
  }, [read, attempt]);
  return { data, error, loading, retry: () => { if (!loading) { setLoading(true); setAttempt(n => n + 1); } } };
}
export function DashboardFrame({ title, loading, error, retry, children }: { title: string; loading: boolean; error: ApiError | null; retry: () => void; children: ReactNode }) {
  return <main className="app-container dashboard"><h1>{title}</h1>
    {loading && <p role="status">Loading dashboard…</p>}
    {error && <div className="error-box" role="alert"><p>{error.status === 403 ? "Access denied. You do not have permission to view this dashboard." : error.status === 401 ? "Your session has expired. Please sign in again." : "Unable to load dashboard. Please try again."}</p>{error.status !== 403 && error.status !== 401 && <button className="secondary-button" disabled={loading} onClick={retry}>Retry</button>}</div>}
    {!loading && !error && children}</main>;
}
export function DashboardMetric({ label, count, onOpen, emptyCopy = "No matching Tickets" }: { label: string; count: number; onOpen?: () => void; emptyCopy?: string }) {
  const content = <><span>{label}{count === 0 && <small className="d-block muted">{emptyCopy}</small>}</span><strong>{count}</strong></>;
  return onOpen ? <button className="dashboard-metric" aria-label={`${label}: ${count}`} onClick={onOpen}>{content}</button> : <div className="dashboard-metric">{content}</div>;
}
export function DashboardWindow({ windowStart, generatedAt }: { windowStart: string; generatedAt: string }) {
  return <p className="dashboard-window">Recent activity covers the last seven days, from {new Date(windowStart).toLocaleString()} to {new Date(generatedAt).toLocaleString()} (shown in your local time).</p>;
}
export function DashboardTicketList({ title, items, onOpen, emptyAction }: { title: string; items: (DashboardTicket & { itPriority?: string | null; appearsResolved?: boolean })[]; onOpen: (number: string) => void; emptyAction?: ReactNode }) {
  return <section className="dashboard-list" aria-label={title}><h2>{title}</h2><p className="muted">Latest matching Tickets, up to 10.</p>{!items.length ? <p>No matching Tickets. {emptyAction}</p> : <ul>{items.map(ticket => <li key={ticket.ticketNumber}><a href={`#ticket-${encodeURIComponent(ticket.ticketNumber)}`} onClick={e => { e.preventDefault(); onOpen(ticket.ticketNumber); }}>{ticket.ticketNumber} — {ticket.summary}</a><p>{ticket.currentStatus.replaceAll("_", " ")}{"itPriority" in ticket && ` · IT Priority: ${ticket.itPriority ?? "Not yet triaged"}`}{ticket.appearsResolved && " · Problem appears resolved"} · {formatUtcDate(ticket.updatedAt)}</p></li>)}</ul>}</section>;
}
