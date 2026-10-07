import { useEffect, useRef, useState } from "react";
import { fetchActionDetail, type StaffActionDto } from "./api";
import type { ApiError } from "./api-client";
import StaffActionCard from "./StaffActionCard";
export default function SelectedDashboardAction({ ticketNumber, actionId, refreshKey, onOpen }: { ticketNumber: string; actionId: number; refreshKey?: string; onOpen: (action: StaffActionDto) => void }) {
  const [action, setAction] = useState<StaffActionDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false; let focusMoved = false;
    const trackFocus = () => { focusMoved = true; };
    document.addEventListener("focusin", trackFocus);
    setAction(null); setError(null); setLoading(true);
    fetchActionDetail(ticketNumber, actionId).then(value => {
      if (cancelled) return;
      setAction(value); setLoading(false);
      if (!focusMoved) requestAnimationFrame(() => { if (!cancelled) { panel.current?.focus(); panel.current?.scrollIntoView?.({ block: "nearest" }); } });
    }).catch(reason => { if (!cancelled) { setError(reason); setLoading(false); } });
    return () => { cancelled = true; document.removeEventListener("focusin", trackFocus); };
  }, [ticketNumber, actionId, attempt, refreshKey]);
  return <section ref={panel} id="selected-dashboard-action" tabIndex={-1} aria-label="Selected Action" className="selected-dashboard-action"><h3>Selected Action {actionId}</h3>
    {loading && <p role="status">Loading selected Action…</p>}
    {error && <div role="alert"><p>{error.status === 403 ? "Access denied. You do not have permission to view this Action." : error.status === 404 ? "Action unavailable in this Ticket." : error.status === 401 ? "Your session has expired. Please sign in again." : "Unable to load selected Action. Please try again."}</p>{![401,403,404].includes(error.status ?? 0) && <button className="secondary-button" disabled={loading} onClick={() => { setLoading(true); setAttempt(n => n + 1); }}>Retry selected Action</button>}</div>}
    {action && <StaffActionCard action={action} onOpen={onOpen} />}</section>;
}
