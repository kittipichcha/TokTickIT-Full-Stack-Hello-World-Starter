/**
 * IT Staff Ticket Detail (Issue #38 — ui-spec §5.7).
 *
 * Renders only the transitions permitted by the shared transition module
 * (`@shared/ticket-status`) — the SAME source the server validates with. There
 * is no local matrix copy. A `409` from the server (stale client state) is
 * handled safely: no crash, a clear message, and a status re-fetch.
 *
 * Status changes to Resolved/Closed/Cancelled show a confirmation modal before
 * the request is sent (ui-spec §5.7).
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchStaffTicketDetail,
  fetchAssignableOwners,
  setTicketOwner,
  setItPriority,
  applyStatusTransition,
  postTicketComment,
  postInternalNote,
  type StaffTicketDetail as StaffTicketDetailData,
  type AssignableOwner,
} from "./api";
import { formatUtcDate } from "./format";
import CommentThread from "./CommentThread";
import InternalNoteThread from "./InternalNoteThread";
import { allowedTransitionsFrom, type TicketStatus } from "@shared/ticket-status";

interface StaffTicketDetailProps {
  ticketNumber: string;
  /** The authenticated staff user's id (for the claim control). */
  currentUserId: number;
  onBack: () => void;
}

/** Transitions that require a confirmation modal (ui-spec §5.7). */
const CONFIRMATION_TARGETS: readonly TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

export default function StaffTicketDetail({
  ticketNumber,
  currentUserId,
  onBack,
}: StaffTicketDetailProps) {
  const [detail, setDetail] = useState<StaffTicketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<TicketStatus | null>(null);
  const [owners, setOwners] = useState<AssignableOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>();

  // Eligible owners (active IT Staff / Administrators) for the ownership control.
  // A failure here must not break the detail screen — the claim-to-me action and
  // every other operation remain available.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchAssignableOwners();
        if (!cancelled) setOwners(result);
      } catch {
        if (!cancelled) setOwners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStaffTicketDetail(ticketNumber);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket detail.");
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClaim = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await setTicketOwner(ticketNumber, currentUserId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to claim the ticket.");
    } finally {
      setIsActing(false);
    }
  };

  /**
   * Assigns/reassigns the Ticket to the owner chosen in the selector.
   *
   * Uses the existing CSRF-protected ownership endpoint (api-spec §17). On
   * failure the local selection is cleared and the detail is re-fetched so the
   * UI never displays an owner that was not actually persisted.
   */
  const handleAssignOwner = async () => {
    if (selectedOwnerId === undefined) return;
    setIsActing(true);
    setActionError(null);
    try {
      await setTicketOwner(ticketNumber, selectedOwnerId);
      setSelectedOwnerId(undefined);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign the ticket.");
      setSelectedOwnerId(undefined);
      await load();
    } finally {
      setIsActing(false);
    }
  };

  const handlePriorityChange = async (value: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await setItPriority(ticketNumber, value);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to set IT priority.");
    } finally {
      setIsActing(false);
    }
  };

  const performTransition = async (target: TicketStatus) => {
    setIsActing(true);
    setActionError(null);
    try {
      await applyStatusTransition(ticketNumber, target);
      await load();
    } catch (err) {
      // A 409 (stale client state) is handled safely: show the message and
      // re-fetch the current status rather than corrupting local state.
      setActionError(err instanceof Error ? err.message : "Failed to change status.");
      await load();
    } finally {
      setIsActing(false);
      setPendingTransition(null);
    }
  };

  const handleTransitionClick = (target: TicketStatus) => {
    if (CONFIRMATION_TARGETS.includes(target)) {
      setPendingTransition(target);
    } else {
      void performTransition(target);
    }
  };

  if (loading) {
    return (
      <main className="app-container">
        <div role="status" aria-label="Loading ticket detail">
          <div className="skeleton-select" />
          <div className="skeleton-select" />
          <div className="skeleton-select" />
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="app-container">
        <div className="error-box" role="alert">
          <p>{error ?? "Ticket not found."}</p>
          <div className="error-actions">
            <button className="secondary-button" onClick={onBack}>
              ← Back to Queue
            </button>
            <button className="primary-button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const permitted = allowedTransitionsFrom(detail.currentStatus as TicketStatus);
  const isOwnedByMe = detail.ticketOwnerId === currentUserId;

  return (
    <main className="app-container staff-ticket-detail">
      <div className="ticket-detail-header">
        <a
          href="#staff-queue"
          className="back-link"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          ← Back to Queue
        </a>
        <h1>
          {detail.ticketNumber}
          <span className={`status-badge status-${detail.currentStatus.toLowerCase()}`}>
            {detail.currentStatus}
          </span>
        </h1>
      </div>

      {actionError && (
        <div className="error-box" role="alert">
          <p>{actionError}</p>
        </div>
      )}

      <div className="ticket-info">
        <div className="ticket-info-row">
          <span className="ticket-info-label">Summary</span>
          <span className="ticket-info-value">{detail.summary}</span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Description</span>
          <span className="ticket-info-value">{detail.description}</span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Requester</span>
          <span className="ticket-info-value">
            {detail.requesterName}
            {!detail.requesterIsActive && " (inactive)"}
          </span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Category</span>
          <span className="ticket-info-value">{detail.categoryName}</span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Related System</span>
          <span className="ticket-info-value">{detail.relatedSystemName}</span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Requested Priority</span>
          <span className="ticket-info-value">
            <span className={`priority-badge priority-${detail.requestedPriority.toLowerCase()}`}>
              {detail.requestedPriority}
            </span>
          </span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">IT Priority</span>
          <span className="ticket-info-value">
            {detail.itPriority ? (
              <span className={`priority-badge priority-${detail.itPriority.toLowerCase()}`}>
                {detail.itPriority}
              </span>
            ) : (
              <span className="muted">—</span>
            )}
          </span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Owner</span>
          <span className="ticket-info-value">
            {detail.ticketOwnerId === null ? "Unassigned" : `User #${detail.ticketOwnerId}`}
          </span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Problem Appears Resolved</span>
          <span className="ticket-info-value">{detail.appearsResolved ? "Yes" : "No"}</span>
        </div>
        <div className="ticket-info-row">
          <span className="ticket-info-label">Created</span>
          <span className="ticket-info-value">{formatUtcDate(detail.createdAt)}</span>
        </div>
      </div>

      <section className="staff-actions" aria-label="Ticket actions">
        <h2>Actions</h2>

        <div className="action-group">
          <span className="action-label">Ownership</span>
          <div className="owner-controls">
            <label className="action-label" htmlFor="owner-select">
              Ticket Owner
            </label>
            <select
              id="owner-select"
              value={selectedOwnerId === undefined ? "" : String(selectedOwnerId)}
              onChange={(e) => setSelectedOwnerId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={isActing}
            >
              <option value="">
                {detail.ticketOwnerId === null ? "Select owner" : "Select a new owner"}
              </option>
              {owners.map((owner) => (
                <option key={owner.id} value={String(owner.id)}>
                  {owner.name} — {owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              onClick={() => void handleAssignOwner()}
              disabled={isActing || selectedOwnerId === undefined}
            >
              {detail.ticketOwnerId === null ? "Assign" : "Reassign"}
            </button>
          </div>
          <button
            className="secondary-button"
            onClick={() => void handleClaim()}
            disabled={isActing || isOwnedByMe}
          >
            {isOwnedByMe ? "Claimed by you" : "Claim / Reassign to me"}
          </button>
        </div>

        <div className="action-group">
          <label className="action-label" htmlFor="it-priority-select">
            IT Priority
          </label>
          <select
            id="it-priority-select"
            value={detail.itPriority ?? ""}
            onChange={(e) => void handlePriorityChange(e.target.value)}
            disabled={isActing}
          >
            <option value="" disabled>
              Select…
            </option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div className="action-group">
          <span className="action-label">Status transitions</span>
          {permitted.length === 0 ? (
            <p className="muted">No permitted transitions from {detail.currentStatus}.</p>
          ) : (
            <div className="transition-buttons">
              {permitted.map((target) => (
                <button
                  key={target}
                  className="secondary-button"
                  onClick={() => handleTransitionClick(target)}
                  disabled={isActing}
                >
                  {STATUS_LABELS[target]}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <CommentThread
        comments={detail.publicComments}
        onPost={async (content) => {
          await postTicketComment(ticketNumber, content);
          await load();
        }}
      />

      <InternalNoteThread
        notes={detail.internalNotes}
        onPost={async (content) => {
          await postInternalNote(ticketNumber, content);
          await load();
        }}
      />

      {pendingTransition && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-transition-title"
          >
            <h2 id="confirm-transition-title">Confirm status change</h2>
            <p>
              Change the status of {detail.ticketNumber} to{" "}
              <strong>{STATUS_LABELS[pendingTransition]}</strong>?
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setPendingTransition(null)}
                disabled={isActing}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => void performTransition(pendingTransition)}
                disabled={isActing}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}