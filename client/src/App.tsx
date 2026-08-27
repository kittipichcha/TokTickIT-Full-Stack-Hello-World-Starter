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

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    void loadRequesters();
  };

  const handleViewTicket = (ticketNumber: string) => {
    setDetailTicketNumber(ticketNumber);
    setView("ticket-detail");
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

  if (!activeRequester) {
    return (
      <main className="app-container selector-screen">
        <p className="eyebrow">TokTickIT</p>
        <h1>Choose a Development Requester</h1>
        <p className="testing-note">For Lab 2 testing only, not a login screen.</p>
        {message && <p className="notice" role="status">{message}</p>}
        {selectorState === "loading" && (
          <div className="selector-form" role="status" aria-label="Loading active requesters">
            <label htmlFor="requester">Development Requester</label>
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
            <label htmlFor="requester">Development Requester</label>
            <select
              id="requester"
              value={selectedId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedId(value ? Number(value) : null);
              }}
            >
              <option value="">Select a requester</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name}
                </option>
              ))}
            </select>
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
                {ticketDetail.attachments.length === 0 && !isAddingAttachment ? (
                  <p className="placeholder-text">No attachments.</p>
                ) : (
                  <ul className="attachment-list">
                    {ticketDetail.attachments.map((att) => (
                      <li
                        key={att.id}
                        className={`attachment-row ${att.isRemoved ? "attachment-removed" : ""}`}
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
                        ) : (
                          <>
                            <span className="attachment-status-active">Active</span>
                            <button
                              className="tertiary-button"
                              onClick={async () => {
                                try {
                                  const { blob, mimeType } = await previewAttachmentFile(att.id, activeRequester!.id);
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, "_blank");
                                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                                } catch (err) {
                                  setAddAttachmentError(err instanceof Error ? err.message : "Preview failed.");
                                }
                              }}
                            >
                              Preview
                            </button>
                            <button
                              className="tertiary-button"
                              onClick={async () => {
                                try {
                                  const { blob, filename } = await downloadAttachmentFile(att.id, activeRequester!.id);
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                } catch (err) {
                                  setAddAttachmentError(err instanceof Error ? err.message : "Download failed.");
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
                        await uploadAttachment(activeRequester.id, detailTicketNumber, file);
                        // Refresh ticket detail to show new attachment
                        const data = await fetchTicketDetail(activeRequester.id, detailTicketNumber);
                        setTicketDetail(data);
                      } catch (err) {
                        setAddAttachmentError(err instanceof Error ? err.message : "Upload failed.");
                      } finally {
                        setIsAddingAttachment(false);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAddingAttachment}
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
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Remove attachment">
              <div className="modal-content">
                <h2>Remove Attachment</h2>
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
                        await removeAttachment(
                          activeRequester.id,
                          removeDialogAttachment.id,
                          removeReason.trim() || undefined,
                        );
                        // Refresh ticket detail
                        const data = await fetchTicketDetail(activeRequester.id, detailTicketNumber!);
                        setTicketDetail(data);
                        setRemoveDialogAttachment(null);
                        setRemoveReason("");
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
