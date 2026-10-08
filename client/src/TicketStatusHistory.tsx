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
  const requestedPage = useRef(1);
  const pendingRead = useRef(false);
  const invokingControl = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const pageStatus = useRef<HTMLSpanElement>(null);
  const retryControl = useRef<HTMLButtonElement>(null);
  const historyToggle = useRef<HTMLButtonElement>(null);

  const load = async (nextPage: number, control?: HTMLElement) => {
    if (pendingRead.current && control) return;
    pendingRead.current = true;
    requestedPage.current = nextPage;
    invokingControl.current = control ?? null;
    restoreFocus.current = false;
    const sequence = ++requestSequence.current;
    const requestedTicket = ticketNumber;
    setLoading(true);
    try {
      let next = await fetchTicketStatusHistory(requestedTicket, nextPage, TICKET_STATUS_HISTORY_PAGE_SIZE);
      let actualPage = nextPage;
      if (nextPage > Math.max(1, next.pagination.totalPages)) {
        actualPage = 1;
        next = await fetchTicketStatusHistory(requestedTicket, actualPage, TICKET_STATUS_HISTORY_PAGE_SIZE);
      }
      if (sequence !== requestSequence.current || requestedTicket !== currentTicket.current) return;
      setError(null);
      setResult(next);
      setPage(actualPage);
    } catch (err) {
      if (sequence !== requestSequence.current || requestedTicket !== currentTicket.current) return;
      const status = (err as ApiError).status;
      setError(status === 401 ? "sign-in" : status === 403 ? "forbidden" : status === 404 ? "not-found" : "unexpected");
    } finally {
      if (sequence === requestSequence.current && requestedTicket === currentTicket.current) {
        pendingRead.current = false;
        // Disabling a boundary button can blur it during the completion render.
        restoreFocus.current = document.activeElement === invokingControl.current;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (loading) return;
    const control = invokingControl.current;
    invokingControl.current = null;
    const shouldRestoreFocus = restoreFocus.current;
    restoreFocus.current = false;
    if (control && shouldRestoreFocus) {
      if (error) retryControl.current?.focus();
      else if (!control.isConnected || (control instanceof HTMLButtonElement && control.disabled)) (pageStatus.current ?? historyToggle.current)?.focus();
    }
  }, [loading, error]);

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
    pendingRead.current = false;
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
      <button ref={historyToggle} className="secondary-button" type="button" aria-expanded={open} onClick={toggle}>
        {open ? "Hide status history" : "View status history"}
      </button>
      {open && (
        <div className="ticket-status-history-content" aria-busy={loading}>
          <h2>Status history</h2>
          {loading && <p role="status">Loading status history…</p>}
          {error && (
            <div className="error-box" role="alert">
              <p>{error === "sign-in" ? "Sign in to view status history." : error === "forbidden" ? "You do not have permission to view status history." : error === "not-found" ? "Ticket not found." : "Unable to load status history."}</p>
              <button ref={retryControl} className="tertiary-button" type="button" aria-disabled={loading} onClick={(event) => void load(requestedPage.current, event.currentTarget)}>Retry</button>
            </div>
          )}
          {!loading && !error && result?.data.length === 0 && <p className="muted">No status history.</p>}
          {result && result.data.length > 0 && (
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
                  <button className="secondary-button" type="button" disabled={page === 1} aria-disabled={loading || page === 1} onClick={(event) => void load(page - 1, event.currentTarget)}>Previous</button>
                  <span ref={pageStatus} role="status" aria-label="Status history page" tabIndex={-1}>Page {page} of {result.pagination.totalPages}</span>
                  <button className="secondary-button" type="button" disabled={page === result.pagination.totalPages} aria-disabled={loading || page === result.pagination.totalPages} onClick={(event) => void load(page + 1, event.currentTarget)}>Next</button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
