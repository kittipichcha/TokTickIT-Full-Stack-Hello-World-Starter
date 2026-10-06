import { useEffect, useRef, useState } from "react";
import { fetchTicketStatusHistory, TICKET_STATUS_HISTORY_PAGE_SIZE, type TicketStatusHistoryResponse } from "./api";
import { formatUtcDate } from "./format";
import type { ApiError } from "./api-client";

type LoadError = "sign-in" | "forbidden" | "not-found" | "unexpected";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};

export default function TicketStatusHistory({ ticketNumber, ticketVersion }: { ticketNumber: string; ticketVersion: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TicketStatusHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const requestSequence = useRef(0);
  const currentTicket = useRef(ticketNumber);
  const currentVersion = useRef(ticketVersion);

  const load = async (requestedPage: number) => {
    const sequence = ++requestSequence.current;
    const requestedTicket = ticketNumber;
    setPage(requestedPage);
    setLoading(true);
    setError(null);
    try {
      let next = await fetchTicketStatusHistory(requestedTicket, requestedPage, TICKET_STATUS_HISTORY_PAGE_SIZE);
      let actualPage = requestedPage;
      if (requestedPage > Math.max(1, next.pagination.totalPages)) {
        actualPage = 1;
        next = await fetchTicketStatusHistory(requestedTicket, actualPage, TICKET_STATUS_HISTORY_PAGE_SIZE);
      }
      if (sequence !== requestSequence.current || requestedTicket !== currentTicket.current) return;
      setResult(next);
      setPage(actualPage);
    } catch (err) {
      if (sequence !== requestSequence.current || requestedTicket !== currentTicket.current) return;
      const status = (err as ApiError).status;
      setError(status === 401 ? "sign-in" : status === 403 ? "forbidden" : status === 404 ? "not-found" : "unexpected");
    } finally {
      if (sequence === requestSequence.current && requestedTicket === currentTicket.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTicket.current === ticketNumber) return;
    requestSequence.current += 1;
    currentTicket.current = ticketNumber;
    currentVersion.current = ticketVersion;
    setOpen(false);
    setPage(1);
    setResult(null);
    setError(null);
    setLoading(false);
  }, [ticketNumber, ticketVersion]);

  useEffect(() => {
    if (currentVersion.current === ticketVersion) return;
    currentVersion.current = ticketVersion;
    requestSequence.current += 1;
    setResult(null);
    setError(null);
    if (open) void load(page);
  }, [ticketVersion]);

  useEffect(() => () => { requestSequence.current += 1; }, []);

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !result && !error) void load(1);
  };

  return (
    <section className="ticket-status-history" aria-label="Ticket status history">
      <button className="secondary-button" type="button" aria-expanded={open} onClick={toggle}>
        {open ? "Hide status history" : "View status history"}
      </button>
      {open && (
        <div className="ticket-status-history-content">
          <h2>Status history</h2>
          {loading && <p role="status">Loading status history…</p>}
          {error && (
            <div className="error-box" role="alert">
              <p>{error === "sign-in" ? "Sign in to view status history." : error === "forbidden" ? "You do not have permission to view status history." : error === "not-found" ? "Ticket not found." : "Unable to load status history."}</p>
              <button className="tertiary-button" type="button" onClick={() => void load(page)}>Retry</button>
            </div>
          )}
          {!loading && !error && result?.data.length === 0 && <p className="muted">No status history.</p>}
          {!loading && !error && result && result.data.length > 0 && (
            <>
              <ol className="ticket-status-history-list">
                {result.data.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.changedAt}>{formatUtcDate(entry.changedAt)}</time>
                    <span>{STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus} → {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}</span>
                    <span>Changed by {entry.changedBy.name}</span>
                    <span>Version {entry.versionBefore} → {entry.versionAfter}</span>
                  </li>
                ))}
              </ol>
              {result.pagination.totalPages > 1 && (
                <nav className="ticket-status-history-pagination" aria-label="Status history pages">
                  <button className="secondary-button" type="button" disabled={page === 1 || loading} onClick={() => void load(page - 1)}>Previous</button>
                  <span>Page {page} of {result.pagination.totalPages}</span>
                  <button className="secondary-button" type="button" disabled={page === result.pagination.totalPages || loading} onClick={() => void load(page + 1)}>Next</button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
