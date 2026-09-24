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

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStaffTicketDetail,
  fetchAssignableOwners,
  setTicketOwner,
  setItPriority,
  applyStatusTransition,
  postTicketComment,
  postInternalNote,
  previewAttachmentFile,
  downloadAttachmentFile,
  type StaffTicketDetail as StaffTicketDetailData,
  type AssignableOwner,
} from "./api";
import { formatUtcDate, formatFileSize } from "./format";
import CommentThread from "./CommentThread";
import InternalNoteThread from "./InternalNoteThread";
import { allowedTransitionsFrom, type TicketStatus } from "@shared/ticket-status";
import type { ApiError } from "./api-client";

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

type DetailLoadError = "forbidden" | "not-found" | "unexpected";
type OwnerLoadState = "loading" | "loaded" | "error";

export default function StaffTicketDetail({
  ticketNumber,
  currentUserId,
  onBack,
}: StaffTicketDetailProps) {
  const [detail, setDetail] = useState<StaffTicketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: DetailLoadError; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<TicketStatus | null>(null);
  const [owners, setOwners] = useState<AssignableOwner[]>([]);
  const [ownerLoadState, setOwnerLoadState] = useState<OwnerLoadState>("loading");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>();

  // Issue #38 review fix (49-B2) — Preview/Download failures mark the
  // Attachment unavailable rather than implying the operation succeeded.
  const [unavailableAttachmentIds, setUnavailableAttachmentIds] = useState<number[]>([]);
  const [unavailableAttachmentErrors, setUnavailableAttachmentErrors] = useState<
    Record<number, string>
  >({});

  // Issue #38 review fix (49-B4) — modal focus management (ui-spec §8).
  const modalRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const transitionInFlightRef = useRef(false);
  const focusAfterTransitionRef = useRef(false);
  const backLinkRef = useRef<HTMLAnchorElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const ownerRequestSeqRef = useRef(0);

  const loadOwners = useCallback(async () => {
    const requestId = ++ownerRequestSeqRef.current;
    setOwnerLoadState("loading");
    try {
      const result = await fetchAssignableOwners();
      if (requestId === ownerRequestSeqRef.current) {
        setOwners(result);
        setOwnerLoadState("loaded");
      }
    } catch {
      if (requestId === ownerRequestSeqRef.current) {
        setOwners([]);
        setOwnerLoadState("error");
      }
    }
  }, []);

  useEffect(() => {
    void loadOwners();
    return () => {
      ownerRequestSeqRef.current += 1;
    };
  }, [loadOwners]);

  const load = useCallback(async (preserveDetail = false) => {
    if (!preserveDetail) setLoading(true);
    setError(null);
    try {
      const data = await fetchStaffTicketDetail(ticketNumber);
      setDetail(data);
    } catch (err) {
      const apiError = err as ApiError;
      const kind: DetailLoadError = apiError.status === 403
        ? "forbidden"
        : apiError.status === 404
          ? "not-found"
          : "unexpected";
      setError({
        kind,
        message: err instanceof Error ? err.message : "Failed to load ticket detail.",
      });
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAfterMutation = async (successMessage: string) => {
    try {
      const refreshed = await fetchStaffTicketDetail(ticketNumber);
      setDetail(refreshed);
    } catch (refreshErr) {
      setActionError(
        refreshErr instanceof Error
          ? `${successMessage}, but refresh failed: ${refreshErr.message}`
          : `${successMessage}, but refresh failed.`,
      );
    }
  };

  const handleClaim = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      const result = await setTicketOwner(ticketNumber, currentUserId);
      setDetail((current) => current ? { ...current, ticketOwnerId: result.ticketOwnerId } : current);
      await refreshAfterMutation("Owner updated successfully");
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
   * failure the selected owner is preserved so the staff member can correct or
   * retry the request. A failed write must not trigger a recovery GET: that
   * would obscure the original failure and is unrelated to mutation success.
   */
  const handleAssignOwner = async () => {
    if (selectedOwnerId === undefined) return;
    setIsActing(true);
    setActionError(null);
    try {
      const result = await setTicketOwner(ticketNumber, selectedOwnerId);
      setDetail((current) => current ? { ...current, ticketOwnerId: result.ticketOwnerId } : current);
      setSelectedOwnerId(undefined);
      await refreshAfterMutation("Owner updated successfully");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign the ticket.");
    } finally {
      setIsActing(false);
    }
  };

  const handlePriorityChange = async (value: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      const result = await setItPriority(ticketNumber, value);
      setDetail((current) => current ? { ...current, itPriority: result.itPriority } : current);
      await refreshAfterMutation("IT priority updated successfully");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to set IT priority.");
    } finally {
      setIsActing(false);
    }
  };

  const performTransition = async (target: TicketStatus) => {
    setIsActing(true);
    setActionError(null);
    const invokingControl = lastFocusedRef.current;
    const isConfirmedTransition = invokingControl !== null;
    transitionInFlightRef.current = isConfirmedTransition;
    setPendingTransition(null);
    try {
      const result = await applyStatusTransition(ticketNumber, target);
      if (isConfirmedTransition) {
        focusAfterTransitionRef.current = true;
      }
      setDetail((current) => current ? { ...current, currentStatus: result.currentStatus } : current);
      await refreshAfterMutation("Status updated successfully");
    } catch (err) {
      transitionInFlightRef.current = false;
      invokingControl?.focus();
      // A 409 (stale client state) is handled safely: show the message and
      // re-fetch the current status rather than corrupting local state. Other
      // mutation failures preserve the user's screen and do not make an
      // unrelated read request that could hide their actionable error.
      setActionError(err instanceof Error ? err.message : "Failed to change status.");
      if ((err as ApiError).status === 409) {
        try {
          const refreshed = await fetchStaffTicketDetail(ticketNumber);
          setDetail(refreshed);
        } catch {
          setActionError(
            "The ticket status may have changed, but the latest ticket data could not be refreshed.",
          );
        }
      }
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

  /**
   * Issue #38 review fix (49-B4) — modal focus management (ui-spec §8).
   *
   * On open: remember the invoking control and move focus into the dialog.
   * On close: restore focus to the invoking control. Opening the modal never
   * calls the status API; only Confirm does.
   */
  useEffect(() => {
    if (pendingTransition) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      cancelButtonRef.current?.focus();
    } else if (transitionInFlightRef.current) {
      // Confirmed transitions restore focus after the successful status render.
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [pendingTransition]);

  useEffect(() => {
    if (!focusAfterTransitionRef.current) return;
    focusAfterTransitionRef.current = false;
    transitionInFlightRef.current = false;
    lastFocusedRef.current = null;
    backLinkRef.current?.focus();
  }, [detail?.currentStatus]);

  /** Traps Tab/Shift+Tab inside the dialog and closes it on Escape. */
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setPendingTransition(null);
      return;
    }
    if (e.key !== "Tab") return;

    const dialog = modalRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /** Marks an Attachment unavailable after a failed Preview/Download. */
  const markAttachmentUnavailable = (attachmentId: number, message: string) => {
    setUnavailableAttachmentIds((prev) =>
      prev.includes(attachmentId) ? prev : [...prev, attachmentId],
    );
    setUnavailableAttachmentErrors((prev) => ({ ...prev, [attachmentId]: message }));
  };

  const handlePreviewAttachment = async (attachmentId: number) => {
    try {
      const { blob } = await previewAttachmentFile(attachmentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      markAttachmentUnavailable(
        attachmentId,
        err instanceof Error ? err.message : "Preview failed.",
      );
    }
  };

  const handleDownloadAttachment = async (attachmentId: number) => {
    try {
      const { blob, filename } = await downloadAttachmentFile(attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      markAttachmentUnavailable(
        attachmentId,
        err instanceof Error ? err.message : "Download failed.",
      );
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
        <div className={error?.kind === "unexpected" ? "error-box" : "empty-state"} role="alert">
          <p>
            {error?.kind === "forbidden"
              ? "You do not have permission to view this ticket."
              : error?.kind === "not-found"
                ? "Ticket not found."
                : error?.message ?? "Ticket not found."}
          </p>
          <div className="error-actions">
            <button className="secondary-button" onClick={onBack}>
              ← Back to Queue
            </button>
            {error?.kind === "unexpected" && (
              <button className="primary-button" onClick={() => void load()}>
                Retry
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const permitted = allowedTransitionsFrom(detail.currentStatus as TicketStatus);
  const isOwnedByMe = detail.ticketOwnerId === currentUserId;
  const isUnassigned = detail.ticketOwnerId === null;

  return (
    <main className="app-container staff-ticket-detail">
      <div className="ticket-detail-header">
        <a
          href="#staff-queue"
          className="back-link"
          ref={backLinkRef}
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
        <div className="ticket-info-row">
          <span className="ticket-info-label">Last Updated</span>
          <span className="ticket-info-value">{formatUtcDate(detail.updatedAt)}</span>
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
              aria-describedby={ownerLoadState === "error" ? "detail-owner-error" : undefined}
              value={selectedOwnerId === undefined ? "" : String(selectedOwnerId)}
              onChange={(e) => setSelectedOwnerId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={isActing || ownerLoadState !== "loaded"}
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
            {ownerLoadState === "error" && (
              <div id="detail-owner-error" className="field-error" role="alert">
                <span>Unable to load eligible owners. Assignment is unavailable.</span>
                <button className="tertiary-button" onClick={() => void loadOwners()}>
                  Retry
                </button>
              </div>
            )}
            <button
              className="primary-button"
              onClick={() => void handleAssignOwner()}
              disabled={isActing || ownerLoadState !== "loaded" || selectedOwnerId === undefined}
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
                  disabled={isActing || isUnassigned}
                >
                  {STATUS_LABELS[target]}
                </button>
              ))}
            </div>
          )}
          {isUnassigned && permitted.length > 0 && (
            <p className="muted">Claim or assign this ticket before changing its status.</p>
          )}
        </div>
      </section>

      <CommentThread
        comments={detail.publicComments}
        onPost={async (content) => {
          const createdComment = await postTicketComment(ticketNumber, content);
          setDetail((current) =>
            current ? { ...current, publicComments: [...current.publicComments, createdComment] } : current,
          );
          try {
            const refreshed = await fetchStaffTicketDetail(ticketNumber);
            setDetail(refreshed);
          } catch (refreshErr) {
            setActionError(
              refreshErr instanceof Error
                ? `Comment posted, but the ticket could not be refreshed: ${refreshErr.message}`
                : "Comment posted, but the ticket could not be refreshed.",
            );
          }
        }}
      />

      <InternalNoteThread
        notes={detail.internalNotes}
        onPost={async (content) => {
          const createdNote = await postInternalNote(ticketNumber, content);
          setDetail((current) =>
            current ? { ...current, internalNotes: [...current.internalNotes, createdNote] } : current,
          );
          await refreshAfterMutation("Internal note posted successfully");
        }}
      />

      {/* Issue #38 review fix (49-B2) — Existing Attachments (ui-spec §5.7).
          Read-only: Staff/Admin may view, preview, and download, but never
          upload or remove (specification.md §6). */}
      <section className="attachments-section" aria-label="Attachments">
        <h2>Attachments</h2>
        {detail.attachments.length === 0 ? (
          <p className="placeholder-text">No attachments.</p>
        ) : (
          <ul className="attachment-list">
            {detail.attachments.map((att) => {
              const isUnavailable = unavailableAttachmentIds.includes(att.id);
              return (
                <li
                  key={att.id}
                  className={`attachment-row ${att.isRemoved ? "attachment-removed" : ""} ${
                    isUnavailable ? "attachment-unavailable" : ""
                  }`}
                >
                  <span className="attachment-icon">
                    {att.mimeType.startsWith("image/") ? "🖼" : "📄"}
                  </span>
                  <span className="attachment-name">{att.originalFilename}</span>
                  <span className="attachment-size">{formatFileSize(att.fileSizeBytes)}</span>
                  <span className="attachment-date">{formatUtcDate(att.uploadedAt)}</span>
                  {att.isRemoved ? (
                    <>
                      <span className="removed-badge">Removed</span>
                      {att.removalReason && (
                        <span className="removal-reason" title={att.removalReason}>
                          {att.removalReason}
                        </span>
                      )}
                      <button className="tertiary-button" disabled aria-disabled="true">
                        Preview
                      </button>
                      <button className="tertiary-button" disabled aria-disabled="true">
                        Download
                      </button>
                    </>
                  ) : isUnavailable ? (
                    <>
                      <span className="unavailable-badge">Unavailable</span>
                      <span className="field-error">{unavailableAttachmentErrors[att.id]}</span>
                      <button className="tertiary-button" disabled aria-disabled="true">
                        Preview
                      </button>
                      <button className="tertiary-button" disabled aria-disabled="true">
                        Download
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="attachment-status-active">Active</span>
                      <button
                        className="tertiary-button"
                        onClick={() => void handlePreviewAttachment(att.id)}
                      >
                        Preview
                      </button>
                      <button
                        className="tertiary-button"
                        onClick={() => void handleDownloadAttachment(att.id)}
                      >
                        Download
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingTransition && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-transition-title"
            ref={modalRef}
            onKeyDown={handleModalKeyDown}
          >
            <h2 id="confirm-transition-title">Confirm status change</h2>
            <p>
              Change the status of {detail.ticketNumber} to{" "}
              <strong>{STATUS_LABELS[pendingTransition]}</strong>?
            </p>
            <div className="modal-actions">
              <button
                ref={cancelButtonRef}
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
