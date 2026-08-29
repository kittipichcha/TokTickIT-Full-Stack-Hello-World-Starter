import { useEffect, useState, useRef } from "react";
import "./App.css";
import {
  clearStoredRequesterId,
  fetchDevRequesters,
  fetchRequesterContext,
  fetchTicketDetail,
  getStoredRequesterId,
  setStoredRequesterId,
  uploadAttachment,
  removeAttachment,
  previewAttachmentFile,
  downloadAttachmentFile,
  isAllowedAttachmentType,
  isWithinSizeLimit,
  type DevRequester,
  type TicketDetailResponse,
  type AttachmentItem,
} from "./api";
import CreateTicket from "./CreateTicket";
import MyTickets from "./MyTickets";
import { formatUtcDate, formatFileSize } from "./format";

type SelectorState = "loading" | "ready" | "empty" | "error";
type AppView = "home" | "create-ticket" | "ticket-detail";

interface FailedAttachment {
  id: string;
  fileName: string;
  file: File;
  requesterId: number;
  ticketNumber: string;
  error: string;
}

export default function App() {
  const [requesters, setRequesters] = useState<DevRequester[]>([]);
  const [selectorState, setSelectorState] = useState<SelectorState>("loading");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeRequester, setActiveRequester] = useState<DevRequester | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [detailTicketNumber, setDetailTicketNumber] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetailResponse["data"] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetryCounter, setDetailRetryCounter] = useState(0);
  const [myTicketsResetKey, setMyTicketsResetKey] = useState(0);

  // Attachment dialog state
  const [removeDialogAttachment, setRemoveDialogAttachment] = useState<AttachmentItem | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [addAttachmentError, setAddAttachmentError] = useState<string | null>(null);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Unavailable attachment state (Preview/Download failures)
  const [unavailableAttachmentIds, setUnavailableAttachmentIds] = useState<number[]>([]);
  const [unavailableAttachmentErrors, setUnavailableAttachmentErrors] = useState<Record<number, string>>({});

  // Failed Add Attachment upload in Ticket Detail — scoped to requester + ticket
  const [failedAddAttachment, setFailedAddAttachment] = useState<{
    id: string;
    fileName: string;
    file: File;
    requesterId: number;
    ticketNumber: string;
    error: string;
  } | null>(null);

  // Failed attachment retry state (from Create Ticket partial upload)
  const [failedAttachments, setFailedAttachments] = useState<FailedAttachment[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadRequesters = async () => {
    setSelectorState("loading");
    setMessage(null);
    try {
      const data = await fetchDevRequesters();
      setRequesters(data);
      const storedId = getStoredRequesterId();
      const storedRequester = data.find((requester) => requester.id === storedId);
      if (storedId !== null && !storedRequester) {
        clearStoredRequesterId();
        setMessage("Your saved requester is no longer active. Please select an active requester.");
      }
      if (storedRequester) {
        setActiveRequester(storedRequester);
        setSelectedId(storedRequester.id);
      }
      setSelectorState(data.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setSelectorState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load requesters.");
    }
  };

  useEffect(() => {
    void loadRequesters();
  }, []);

  const continueToApp = async () => {
    const requester = requesters.find((candidate) => candidate.id === selectedId);
    if (!requester) return;

    try {
      await fetchRequesterContext(requester.id);
      setStoredRequesterId(requester.id);
      setActiveRequester(requester);
      setMessage(null);
      setError(null);
    } catch {
      clearStoredRequesterId();
      setActiveRequester(null);
      setSelectedId(null);
      setMessage("Selected requester is no longer active. Please select an active requester.");
      setError(null);
      setSelectorState("ready");
    }
  };

  const changeRequester = () => {
    clearStoredRequesterId();
    setActiveRequester(null);
    setSelectedId(null);
    setError(null);
    setView("home");
    setMyTicketsResetKey((k) => k + 1);
    // Clear all attachment failure/retry state — it is scoped to the previous requester.
    setFailedAttachments([]);
    setFailedAddAttachment(null);
    setUnavailableAttachmentIds([]);
    setUnavailableAttachmentErrors({});
    setAddAttachmentError(null);
    void loadRequesters();
  };

  const handleViewTicket = (ticketNumber: string, failedFiles?: Array<{ file: File; fileName: string; id: string; error: string }>) => {
    setDetailTicketNumber(ticketNumber);
    setView("ticket-detail");
    if (failedFiles && failedFiles.length > 0 && activeRequester) {
      // Scope each failed attachment to the requester + ticket that produced it.
      setFailedAttachments(failedFiles.map((f) => ({ ...f, requesterId: activeRequester.id, ticketNumber })));
    }
  };

  // Handle retry of a failed attachment from Create Ticket flow.
  // The retry ALWAYS targets the failed attachment's own requester + ticket
  // identity — never the currently displayed detail ticket.
  const handleRetryFailedAttachment = async (failedAtt: FailedAttachment) => {
    if (!activeRequester) return;
    setRetryingId(failedAtt.id);
    try {
      // Phase 1: the mutation itself. A successful retry upload is terminal —
      // the failed row is removed permanently and must never be restored
      // merely because the subsequent refresh failed.
      await uploadAttachment(failedAtt.requesterId, failedAtt.ticketNumber, failedAtt.file);
      // Mutation succeeded — remove from failed list permanently.
      setFailedAttachments((prev) => prev.filter((f) => f.id !== failedAtt.id));
      // Phase 2: refresh. A refresh failure is a detail error only, NOT a
      // mutation failure, so it must not restore the failed row.
      setUnavailableAttachmentIds([]);
      setUnavailableAttachmentErrors({});
      try {
        const data = await fetchTicketDetail(failedAtt.requesterId, failedAtt.ticketNumber);
        setTicketDetail(data);
      } catch (refreshErr) {
        setDetailError(refreshErr instanceof Error ? refreshErr.message : "Failed to refresh ticket detail.");
      }
    } catch (err) {
      setAddAttachmentError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  // Load ticket detail when entering the ticket-detail view
  useEffect(() => {
    if (view !== "ticket-detail" || !detailTicketNumber || !activeRequester) return;

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setTicketDetail(null);

    fetchTicketDetail(activeRequester.id, detailTicketNumber)
      .then((data) => {
        if (!cancelled) {
          setTicketDetail(data);
          setDetailLoading(false);
        }
      })
      .catch((err: Error & { code?: string }) => {
        if (!cancelled) {
          if (err.code === "NOT_FOUND") {
            setDetailError("Ticket not found.");
          } else {
            setDetailError(err.message || "Failed to load ticket detail.");
          }
          setDetailLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [view, detailTicketNumber, activeRequester, detailRetryCounter]);

  const handleCreateAnother = () => {
    setView("create-ticket");
  };

  // Focus management for removal dialog
  useEffect(() => {
    if (removeDialogAttachment) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      // Focus the Cancel button (first interactive control in the dialog)
      const cancelBtn = dialogRef.current?.querySelector('.secondary-button') as HTMLElement | null;
      if (cancelBtn) {
        cancelBtn.focus();
      }
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [removeDialogAttachment]);

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setRemoveDialogAttachment(null);
      setRemoveReason('');
      return;
    }
    if (e.key === 'Tab') {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  if (!activeRequester) {
    return (
      <main className="app-container selector-screen">
        <p className="eyebrow">TokTickIT</p>
        <h1>Choose a Development Requester</h1>
        <p className="testing-note">For Lab 2 testing only, not a login screen.</p>
        {message && <p className="notice" role="status">{message}</p>}
        {selectorState === "loading" && (
          <div className="selector-form" role="status" aria-label="Loading active requesters">
            <span className="requester-label">Development Requester</span>
            <div className="skeleton-select" aria-hidden="true" />
            <button className="primary-button" disabled>Continue</button>
          </div>
        )}
        {selectorState === "error" && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button className="secondary-button" onClick={() => void loadRequesters()}>Retry</button>
          </div>
        )}
        {selectorState === "empty" && <p className="empty-state">No active development requesters are available.</p>}
        {selectorState === "ready" && (
          <div className="selector-form">
            <span className="requester-label" id="requester-label">Development Requester</span>
            <div className="requester-options" role="radiogroup" aria-labelledby="requester-label">
              {requesters.map((requester) => {
                const isSelected = selectedId === requester.id;
                return (
                  <button
                    key={requester.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select ${requester.name}`}
                    className={`requester-option ${isSelected ? "requester-option-selected" : ""}`}
                    onClick={() => setSelectedId(requester.id)}
                  >
                    <span className="requester-option-name">{requester.name}</span>
                    <span className="requester-option-email">{requester.email}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="primary-button"
              disabled={selectedId === null || !requesters.some((r) => r.id === selectedId)}
              onClick={() => void continueToApp()}
            >
              Continue
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <strong>TokTickIT</strong>
        <nav aria-label="Primary">
          <a
            href="#my-tickets"
            className={view === "home" ? "nav-active" : ""}
            onClick={(e) => { e.preventDefault(); setView("home"); }}
          >
            My Tickets
          </a>
          <a
            href="#create-ticket"
            className={view === "create-ticket" ? "nav-active" : ""}
            onClick={(e) => { e.preventDefault(); setView("create-ticket"); }}
          >
            Create Ticket
          </a>
        </nav>
        <div className="identity">{activeRequester.name}<button className="header-button" onClick={changeRequester}>Change Requester</button></div>
      </header>
      {view === "home" && (
        <MyTickets
          requester={activeRequester}
          onViewTicket={handleViewTicket}
          onCreateTicket={() => setView("create-ticket")}
          resetKey={myTicketsResetKey}
        />
      )}
      {view === "create-ticket" && (
        <CreateTicket
          requester={activeRequester}
          onViewTicket={handleViewTicket}
          onCreateAnother={handleCreateAnother}
        />
      )}
      {view === "ticket-detail" && (
        <main className="app-container">
          {detailLoading && (
            <div role="status" aria-label="Loading ticket detail">
              <div className="skeleton-select" />
              <div className="skeleton-select" />
              <div className="skeleton-select" />
              <div className="skeleton-select" />
            </div>
          )}
          {detailError && !detailLoading && (
            <div className="error-box" role="alert">
              <p>{detailError}</p>
              <div className="error-actions">
                <button className="secondary-button" onClick={() => setView("home")}>← Back to My Tickets</button>
                <button className="primary-button" onClick={() => setDetailRetryCounter((c) => c + 1)}>Retry</button>
              </div>
            </div>
          )}
          {ticketDetail && (
            <div className="ticket-detail">
              {/* Header row: Ticket Number + Status badge + Back link */}
              <div className="ticket-detail-header">
                <a
                  href="#my-tickets"
                  className="back-link"
                  onClick={(e) => { e.preventDefault(); setView("home"); }}
                >
                  ← Back to My Tickets
                </a>
                <h1>
                  {ticketDetail.ticketNumber}
                  <span className={`status-badge status-${ticketDetail.currentStatus.toLowerCase()}`}>
                    {ticketDetail.currentStatus}
                  </span>
                </h1>
              </div>

              {/* Read-only info grid */}
              <div className="ticket-info">
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Ticket Date</span>
                  <span className="ticket-info-value">{formatUtcDate(ticketDetail.createdAt)}</span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Category</span>
                  <span className="ticket-info-value">{ticketDetail.categoryName}</span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Related System</span>
                  <span className="ticket-info-value">{ticketDetail.relatedSystemName}</span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Requester</span>
                  <span className="ticket-info-value">{ticketDetail.requesterName}</span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Requested Priority</span>
                  <span className="ticket-info-value">
                    <span className={`priority-badge priority-${ticketDetail.requestedPriority.toLowerCase()}`}>
                      {ticketDetail.requestedPriority}
                    </span>
                  </span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">IT Priority</span>
                  <span className="ticket-info-value">
                    {ticketDetail.itPriority ? (
                      <span className={`priority-badge priority-${ticketDetail.itPriority.toLowerCase()}`}>
                        {ticketDetail.itPriority}
                      </span>
                    ) : (
                      <span className="placeholder-text">Not yet triaged</span>
                    )}
                  </span>
                </div>
                <div className="ticket-info-row">
                  <span className="ticket-info-label">Ticket Owner</span>
                  <span className="ticket-info-value">
                    {ticketDetail.ticketOwnerId ? (
                      ticketDetail.ticketOwnerId
                    ) : (
                      <span className="placeholder-text">Unassigned</span>
                    )}
                  </span>
                </div>
                <div className="ticket-info-row ticket-info-full">
                  <span className="ticket-info-label">Summary</span>
                  <span className="ticket-info-value">{ticketDetail.summary}</span>
                </div>
                <div className="ticket-info-row ticket-info-full">
                  <span className="ticket-info-label">Description</span>
                  <span className="ticket-info-value ticket-description">{ticketDetail.description}</span>
                </div>
              </div>

              {/* Attachments section */}
              <section className="attachments-section" aria-label="Attachments">
                <h2>Attachments</h2>
                {ticketDetail.attachments.length === 0 && failedAttachments.length === 0 && !isAddingAttachment && !failedAddAttachment ? (
                  <p className="placeholder-text">No attachments.</p>
                ) : (
                  <ul className="attachment-list">
                    {ticketDetail.attachments.map((att) => (
                      <li
                        key={att.id}
                        className={`attachment-row ${att.isRemoved ? "attachment-removed" : ""} ${unavailableAttachmentIds.includes(att.id) ? "attachment-unavailable" : ""}`}
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
                            <button
                              className="tertiary-button"
                              disabled
                              aria-disabled="true"
                            >
                              Preview
                            </button>
                            <button
                              className="tertiary-button"
                              disabled
                              aria-disabled="true"
                            >
                              Download
                            </button>
                          </>
                        ) : unavailableAttachmentIds.includes(att.id) ? (
                          <>
                            <span className="unavailable-badge">Unavailable</span>
                            <span className="field-error">{unavailableAttachmentErrors[att.id]}</span>
                            <button
                              className="tertiary-button"
                              disabled
                              aria-disabled="true"
                            >
                              Preview
                            </button>
                            <button
                              className="tertiary-button"
                              disabled
                              aria-disabled="true"
                            >
                              Download
                            </button>
                            <button
                              className="destructive-button"
                              onClick={() => setRemoveDialogAttachment(att)}
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="attachment-status-active">Active</span>
                            <button
                              className="tertiary-button"
                              onClick={async () => {
                                try {
                                  const { blob } = await previewAttachmentFile(activeRequester!.id, att.id);
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, "_blank");
                                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : "Preview failed.";
                                  setUnavailableAttachmentIds(prev => prev.includes(att.id) ? prev : [...prev, att.id]);
                                  setUnavailableAttachmentErrors(prev => ({ ...prev, [att.id]: msg }));
                                }
                              }}
                            >
                              Preview
                            </button>
                            <button
                              className="tertiary-button"
                              onClick={async () => {
                                try {
                                  const { blob, filename } = await downloadAttachmentFile(activeRequester!.id, att.id);
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : "Download failed.";
                                  setUnavailableAttachmentIds(prev => prev.includes(att.id) ? prev : [...prev, att.id]);
                                  setUnavailableAttachmentErrors(prev => ({ ...prev, [att.id]: msg }));
                                }
                              }}
                            >
                              Download
                            </button>
                            <button
                              className="destructive-button"
                              onClick={() => setRemoveDialogAttachment(att)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                    {/* Failed attachments with retry — only those scoped to the
                        current requester AND the currently displayed ticket */}
                    {failedAttachments
                      .filter((fAtt) => fAtt.requesterId === activeRequester!.id && fAtt.ticketNumber === detailTicketNumber)
                      .map((fAtt) => (
                      <li key={fAtt.id} className="attachment-row attachment-failed">
                        <span className="attachment-icon">{"📄"}</span>
                        <span className="attachment-name">{fAtt.fileName}</span>
                        <span className="attachment-size">{formatFileSize(fAtt.file.size)}</span>
                        <span className="attachment-date">—</span>
                        <span className="failed-badge">
                          Failed — {fAtt.error}
                        </span>
                        <button
                          className="tertiary-button"
                          onClick={() => void handleRetryFailedAttachment(fAtt)}
                          disabled={retryingId === fAtt.id}
                        >
                          {retryingId === fAtt.id ? "Retrying…" : "Retry"}
                        </button>
                      </li>
                    ))}
                    {/* Failed Add Attachment upload — only when scoped to current requester + ticket */}
                    {failedAddAttachment &&
                      failedAddAttachment.requesterId === activeRequester!.id &&
                      failedAddAttachment.ticketNumber === detailTicketNumber && (
                      <li key={failedAddAttachment.id} className="attachment-row attachment-unavailable">
                        <span className="attachment-icon">{"📄"}</span>
                        <span className="attachment-name">{failedAddAttachment.fileName}</span>
                        <span className="attachment-size">{formatFileSize(failedAddAttachment.file.size)}</span>
                        <span className="attachment-date">—</span>
                        <span className="unavailable-badge">Unavailable</span>
                        <span className="field-error">{failedAddAttachment.error}</span>
                        <button
                          className="tertiary-button"
                          onClick={async () => {
                            if (!activeRequester) return;
                            setFailedAddAttachment(null);
                            setIsAddingAttachment(true);
                            try {
                              // Phase 1: the mutation itself. A successful retry
                              // upload is terminal — the failed row is cleared
                              // permanently and must never be restored merely
                              // because the subsequent refresh failed.
                              await uploadAttachment(failedAddAttachment.requesterId, failedAddAttachment.ticketNumber, failedAddAttachment.file);
                              // Mutation succeeded — the failed row stays cleared.
                              setUnavailableAttachmentIds([]);
                              setUnavailableAttachmentErrors({});
                              // Phase 2: refresh. A refresh failure is a detail
                              // error only, NOT a mutation failure, so it must
                              // not restore the retry row.
                              try {
                                const data = await fetchTicketDetail(failedAddAttachment.requesterId, failedAddAttachment.ticketNumber);
                                setTicketDetail(data);
                              } catch (refreshErr) {
                                setDetailError(refreshErr instanceof Error ? refreshErr.message : "Failed to refresh ticket detail.");
                              }
                            } catch (err) {
                              setFailedAddAttachment({
                                ...failedAddAttachment,
                                error: err instanceof Error ? err.message : "Retry failed.",
                              });
                            } finally {
                              setIsAddingAttachment(false);
                            }
                          }}
                          disabled={isAddingAttachment}
                        >
                          {isAddingAttachment ? "Retrying…" : "Retry"}
                        </button>
                      </li>
                    )}
                  </ul>
                )}

                {/* Add Attachment control */}
                <div className="add-attachment-control">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeRequester || !detailTicketNumber) return;
                      e.target.value = "";

                      // Enforce the five-active-attachment capacity client-side.
                      const activeCount = ticketDetail.attachments.filter((a) => !a.isRemoved).length;
                      if (activeCount >= 5) {
                        setAddAttachmentError("The ticket already has the maximum number of active attachments.");
                        return;
                      }

                      // Validate
                      if (!isAllowedAttachmentType(file.name)) {
                        setAddAttachmentError(`File type "${file.name.split(".").pop()}" is not supported. Allowed: JPG, PNG, WEBP, PDF.`);
                        return;
                      }
                      if (!isWithinSizeLimit(file.size)) {
                        setAddAttachmentError("File exceeds the 5 MB size limit.");
                        return;
                      }

                      setAddAttachmentError(null);
                      setIsAddingAttachment(true);

                      try {
                        // Phase 1: the mutation itself. A successful upload is
                        // terminal — it must never enter the retry state merely
                        // because the subsequent refresh failed.
                        await uploadAttachment(activeRequester.id, detailTicketNumber, file);
                        // Mutation succeeded — clear any prior failed state.
                        setFailedAddAttachment(null);
                        // Phase 2: refresh. A refresh failure is a detail error
                        // only, NOT a mutation failure.
                        setUnavailableAttachmentIds([]);
                        setUnavailableAttachmentErrors({});
                        try {
                          const data = await fetchTicketDetail(activeRequester.id, detailTicketNumber);
                          setTicketDetail(data);
                        } catch (refreshErr) {
                          setDetailError(refreshErr instanceof Error ? refreshErr.message : "Failed to refresh ticket detail.");
                        }
                      } catch (err) {
                        setFailedAddAttachment({
                          id: `failed-upload-${Date.now()}`,
                          fileName: file.name,
                          file,
                          requesterId: activeRequester.id,
                          ticketNumber: detailTicketNumber,
                          error: err instanceof Error ? err.message : "Upload failed.",
                        });
                      } finally {
                        setIsAddingAttachment(false);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAddingAttachment || ticketDetail.attachments.filter((a) => !a.isRemoved).length >= 5}
                  >
                    {isAddingAttachment ? "Uploading…" : "+ Add Attachment"}
                  </button>
                  {addAttachmentError && (
                    <p className="field-error" role="alert">{addAttachmentError}</p>
                  )}
                </div>
              </section>

              <div className="ticket-detail-actions">
                <button className="secondary-button" onClick={() => setView("home")}>← Back to My Tickets</button>
                <button className="primary-button" onClick={() => setView("create-ticket")}>Create Another</button>
              </div>
            </div>
          )}

          {/* Removal confirmation dialog */}
          {removeDialogAttachment && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Remove attachment"
              ref={dialogRef}
              onKeyDown={handleDialogKeyDown}
            >
              <div className="modal-content">
                <h2 tabIndex={-1}>Remove Attachment</h2>
                <p>Are you sure you want to remove <strong>{removeDialogAttachment.originalFilename}</strong>?</p>
                <div className="form-field">
                  <label htmlFor="removalReason">Reason (optional)</label>
                  <textarea
                    id="removalReason"
                    value={removeReason}
                    onChange={(e) => setRemoveReason(e.target.value)}
                    rows={3}
                    placeholder="Optional reason for removal"
                    maxLength={200}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setRemoveDialogAttachment(null);
                      setRemoveReason("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="destructive-button"
                    disabled={isRemoving}
                    onClick={async () => {
                      if (!activeRequester) return;
                      setIsRemoving(true);
                      try {
                        // Phase 1: the mutation. A successful removal is terminal.
                        await removeAttachment(
                          activeRequester.id,
                          removeDialogAttachment.id,
                          removeReason.trim() || undefined,
                        );
                        // Mutation succeeded — close the dialog regardless of refresh outcome.
                        setRemoveDialogAttachment(null);
                        setRemoveReason("");
                        // Phase 2: refresh. A refresh failure is a detail error only.
                        setUnavailableAttachmentIds([]);
                        setUnavailableAttachmentErrors({});
                        try {
                          const data = await fetchTicketDetail(activeRequester.id, detailTicketNumber!);
                          setTicketDetail(data);
                        } catch (refreshErr) {
                          setDetailError(refreshErr instanceof Error ? refreshErr.message : "Failed to refresh ticket detail.");
                        }
                      } catch (err) {
                        setAddAttachmentError(err instanceof Error ? err.message : "Failed to remove attachment.");
                      } finally {
                        setIsRemoving(false);
                      }
                    }}
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
