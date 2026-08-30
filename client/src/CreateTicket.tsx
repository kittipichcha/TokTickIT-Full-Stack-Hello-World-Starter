import { useState, useEffect, useRef } from "react";
import {
  fetchCategories,
  fetchRelatedSystems,
  createTicket,
  uploadAttachment,
  isAllowedAttachmentType,
  isWithinSizeLimit,
  type Category,
  type RelatedSystem,
  type DevRequester,
} from "./api";
import { formatUtcDate, formatFileSize } from "./format";

type FormState = "editing" | "submitting" | "success" | "error" | "case-b";

interface SelectedFile {
  file: File;
  id: string;
  error?: string;
}

interface UploadResult {
  id: string;
  fileName: string;
  status: "uploading" | "success" | "failed";
  error?: string;
}

interface CreateTicketProps {
  requester: DevRequester;
  onViewTicket: (ticketNumber: string, failedFiles?: Array<{ file: File; fileName: string; id: string; error: string }>) => void;
  onCreateAnother: () => void;
}

let fileIdCounter = 0;
function nextFileId(): string {
  fileIdCounter++;
  return `file-${fileIdCounter}-${Date.now()}`;
}

export default function CreateTicket({ requester, onViewTicket, onCreateAnother }: CreateTicketProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [refsError, setRefsError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [relatedSystemId, setRelatedSystemId] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("MEDIUM");

  const [formState, setFormState] = useState<FormState>("editing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(null);
  const [createdTicketDate, setCreatedTicketDate] = useState<string | null>(null);

  // Attachment state
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingRefs(true);
      setRefsError(null);
      try {
        const [cats, systems] = await Promise.all([
          fetchCategories(),
          fetchRelatedSystems(),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setRelatedSystems(systems);
        }
      } catch (err) {
        if (!cancelled) {
          setRefsError(err instanceof Error ? err.message : "Failed to load reference data.");
        }
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (categoryId === null) errors.categoryId = "Category is required.";
    if (relatedSystemId === null) errors.relatedSystemId = "Related system is required.";

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) errors.summary = "Summary is required.";
    else if (trimmedSummary.length < 5) errors.summary = "Summary must be at least 5 characters.";
    else if (trimmedSummary.length > 120) errors.summary = "Summary must be at most 120 characters.";

    const trimmedDesc = description.trim();
    if (!trimmedDesc) errors.description = "Description is required.";
    else if (trimmedDesc.length < 10) errors.description = "Description must be at least 10 characters.";
    else if (trimmedDesc.length > 2000) errors.description = "Description must be at most 2000 characters.";

    return errors;
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;

    // Enforce the five-active-attachment capacity. Only valid pending files
    // occupy a slot; invalid files are excluded from the upload set but still
    // shown with their validation error.
    const currentValidCount = selectedFiles.filter((f) => !f.error).length;
    const remainingSlots = 5 - currentValidCount;

    const newFiles: SelectedFile[] = [];
    let validAdded = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let error: string | undefined;

      if (!isAllowedAttachmentType(file.name)) {
        error = `File type "${file.name.split(".").pop()}" is not supported. Allowed: JPG, PNG, WEBP, PDF.`;
      } else if (!isWithinSizeLimit(file.size)) {
        error = `File exceeds the 5 MB size limit.`;
      }

      if (!error) {
        // This is a valid file — it consumes a slot. If no slots remain, reject it.
        if (validAdded >= remainingSlots) {
          error = "The ticket already has the maximum number of active attachments.";
        } else {
          validAdded++;
        }
      }

      newFiles.push({ file, id: nextFileId(), error });
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAddFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validFiles = selectedFiles.filter((f) => !f.error);
  const invalidFiles = selectedFiles.filter((f) => f.error);
  // activeFileCount tracks only files yet to be uploaded; already-uploaded files are
  // no longer in selectedFiles, so this is simply the count of valid pending files.
  const activeFileCount = validFiles.length;

  const handleSubmit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormState("submitting");
    setErrorMessage(null);
    setIsUploading(true);

    try {
      // Step 1: Create the ticket (Case A — if this fails, preserve form values)
      const ticket = await createTicket(requester.id, {
        categoryId: categoryId!,
        relatedSystemId: relatedSystemId!,
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      });
      setCreatedTicketNumber(ticket.ticketNumber);
      setCreatedTicketDate(formatUtcDate(ticket.createdAt));

      // Step 2: Upload valid files sequentially (Case B — partial success)
      if (validFiles.length === 0) {
        setFormState("success");
        setIsUploading(false);
        return;
      }

      const results: UploadResult[] = [];
      for (const sf of validFiles) {
        const result: UploadResult = {
          id: sf.id,
          fileName: sf.file.name,
          status: "uploading",
        };
        results.push(result);
        setUploadResults([...results]);

        try {
          await uploadAttachment(requester.id, ticket.ticketNumber, sf.file);
          result.status = "success";
        } catch (err) {
          result.status = "failed";
          result.error = err instanceof Error ? err.message : "Upload failed.";
        }

        const idx = results.indexOf(result);
        results[idx] = result;
        setUploadResults([...results]);
      }

      setIsUploading(false);

      const allSucceeded = results.every((r) => r.status === "success");
      if (allSucceeded) {
        setFormState("success");
      } else {
        setFormState("case-b");
      }
    } catch (err) {
      // Case A: Ticket creation failed
      const e = err as Error & { code?: string; fields?: Record<string, string> };
      setErrorMessage(e.message || "Failed to create ticket.");
      if (e.fields) setFieldErrors(e.fields);
      setFormState("error");
      setIsUploading(false);
    }
  };

  const getFailedFiles = (): Array<{ file: File; fileName: string; id: string; error: string }> => {
    return uploadResults
      .filter((r) => r.status === "failed")
      .map((r) => {
        const fileEntry = selectedFiles.find((f) => f.id === r.id);
        return {
          file: fileEntry?.file ?? new File([], r.fileName),
          fileName: r.fileName,
          id: r.id,
          error: r.error || "Upload failed.",
        };
      });
  };

  const handleCancel = () => {
    setCategoryId(null);
    setRelatedSystemId(null);
    setSummary("");
    setDescription("");
    setRequestedPriority("MEDIUM");
    setFormState("editing");
    setErrorMessage(null);
    setFieldErrors({});
    setCreatedTicketNumber(null);
    setCreatedTicketDate(null);
    setSelectedFiles([]);
    setUploadResults([]);
    setIsUploading(false);
  };

  if (loadingRefs) {
    return (
      <main className="app-container">
        <h1>Create Ticket</h1>
        <div role="status" aria-label="Loading reference data">
          <div className="skeleton-select" />
          <div className="skeleton-select" />
          <div className="skeleton-select" />
        </div>
      </main>
    );
  }

  if (refsError) {
    return (
      <main className="app-container">
        <h1>Create Ticket</h1>
        <div className="error-box" role="alert">
          <p>{refsError}</p>
          <button className="secondary-button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    );
  }

  // Case B: Ticket created, attachment(s) failed
  if (formState === "case-b" && createdTicketNumber) {
    return (
      <main className="app-container">
        <div className="success-panel">
          <h1>Ticket Created</h1>
          <p className="success-message">Your ticket has been created successfully.</p>
          <div className="ticket-info">
            <div className="ticket-info-row">
              <span className="ticket-info-label">Ticket Number</span>
              <span className="ticket-info-value">{createdTicketNumber}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Ticket Date</span>
              <span className="ticket-info-value">{createdTicketDate}</span>
            </div>
          </div>

          <div className="attachment-results" role="alert">
            <h2>Attachment Upload Results</h2>
            <ul className="upload-result-list">
              {uploadResults.map((r) => (
                <li key={r.id} className={`upload-result-item upload-${r.status}`}>
                  <span className="upload-filename">{r.fileName}</span>
                  {r.status === "uploading" && <span className="upload-spinner" aria-label="Uploading">⏳</span>}
                  {r.status === "success" && <span className="upload-success">✓ Uploaded</span>}
                  {r.status === "failed" && (
                    <span className="upload-failed">
                      ✗ {r.error || "Upload failed."}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <p className="case-b-note">
            The ticket was saved, but some attachments could not be uploaded. You can retry failed attachments from Ticket Detail.
          </p>

          <div className="success-actions">
            <button className="primary-button" onClick={() => onViewTicket(createdTicketNumber, getFailedFiles())}>View Ticket</button>
            <button className="secondary-button" onClick={() => { handleCancel(); onCreateAnother(); }}>Create Another</button>
          </div>
        </div>
      </main>
    );
  }

  // Success state
  if (formState === "success" && createdTicketNumber) {
    return (
      <main className="app-container">
        <div className="success-panel">
          <h1>Ticket Created</h1>
          <p className="success-message">Your ticket has been created successfully.</p>
          <div className="ticket-info">
            <div className="ticket-info-row">
              <span className="ticket-info-label">Ticket Number</span>
              <span className="ticket-info-value">{createdTicketNumber}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Ticket Date</span>
              <span className="ticket-info-value">{createdTicketDate}</span>
            </div>
          </div>
          <div className="success-actions">
            <button className="primary-button" onClick={() => onViewTicket(createdTicketNumber)}>View Ticket</button>
            <button className="secondary-button" onClick={() => { handleCancel(); onCreateAnother(); }}>Create Another</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-container">
      <h1>Create Ticket</h1>

      {errorMessage && formState === "error" && (
        <div className="error-box" role="alert">
          <p>{errorMessage}</p>
        </div>
      )}

      <form
        className="ticket-form"
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
        noValidate
      >
        {/* Read-only fields */}
        <div className="form-row read-only-row">
          <div className="form-field">
            <label>Ticket Number</label>
            <div className="readonly-value">assigned after submit</div>
          </div>
          <div className="form-field">
            <label>Ticket Date</label>
            <div className="readonly-value">now</div>
          </div>
          <div className="form-field">
            <label>Requester</label>
            <div className="readonly-value">{requester.name}</div>
          </div>
        </div>

        {/* Classification row */}
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="categoryId">Category <span className="required-asterisk">*</span></label>
            <select
              id="categoryId"
              value={categoryId ?? ""}
              onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : null); setFieldErrors((prev) => { const next = { ...prev }; delete next.categoryId; return next; }); }}
              className={fieldErrors.categoryId ? "field-invalid" : ""}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="field-error" role="alert">{fieldErrors.categoryId}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="relatedSystemId">Related System <span className="required-asterisk">*</span></label>
            <select
              id="relatedSystemId"
              value={relatedSystemId ?? ""}
              onChange={(e) => { setRelatedSystemId(e.target.value ? Number(e.target.value) : null); setFieldErrors((prev) => { const next = { ...prev }; delete next.relatedSystemId; return next; }); }}
              className={fieldErrors.relatedSystemId ? "field-invalid" : ""}
            >
              <option value="">Select a related system</option>
              {relatedSystems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {fieldErrors.relatedSystemId && <p className="field-error" role="alert">{fieldErrors.relatedSystemId}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="requestedPriority">Requested Priority <span className="required-asterisk">*</span></label>
            <select
              id="requestedPriority"
              value={requestedPriority}
              onChange={(e) => setRequestedPriority(e.target.value)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="form-field">
          <label htmlFor="summary">Summary <span className="required-asterisk">*</span></label>
          <input
            id="summary"
            type="text"
            value={summary}
            onChange={(e) => { setSummary(e.target.value); setFieldErrors((prev) => { const next = { ...prev }; delete next.summary; return next; }); }}
            className={fieldErrors.summary ? "field-invalid" : ""}
            maxLength={200}
            placeholder="Brief summary of the issue"
          />
          {fieldErrors.summary && <p className="field-error" role="alert">{fieldErrors.summary}</p>}
        </div>

        {/* Description */}
        <div className="form-field">
          <label htmlFor="description">Description <span className="required-asterisk">*</span></label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setFieldErrors((prev) => { const next = { ...prev }; delete next.description; return next; }); }}
            className={fieldErrors.description ? "field-invalid" : ""}
            rows={6}
            placeholder="Describe the issue in detail"
          />
          {fieldErrors.description && <p className="field-error" role="alert">{fieldErrors.description}</p>}
        </div>

        {/* Attachments panel */}
        <div className="form-field attachments-panel">
          <label>Attachments <span className="attachment-count">({activeFileCount}/5)</span></label>
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <p>Drag and drop files here, or <button type="button" className="link-button" onClick={() => fileInputRef.current?.click()}>browse files</button></p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <ul className="selected-files-list">
              {selectedFiles.map((sf) => (
                <li key={sf.id} className={`selected-file-row ${sf.error ? "file-invalid" : ""}`}>
                  <span className="file-icon">{sf.file.type.startsWith("image/") ? "🖼" : "📄"}</span>
                  <span className="file-name">{sf.file.name}</span>
                  <span className="file-size">{formatFileSize(sf.file.size)}</span>
                  {sf.error ? (
                    <span className="file-error-message" role="alert">{sf.error}</span>
                  ) : (
                    <span className="file-valid-indicator">✓</span>
                  )}
                  <button
                    type="button"
                    className="file-remove-button"
                    onClick={() => handleRemoveFile(sf.id)}
                    aria-label={`Remove ${sf.file.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Upload progress during submission */}
          {isUploading && uploadResults.length > 0 && (
            <div className="upload-progress" role="status" aria-label="Uploading attachments">
              <p>Uploading attachments…</p>
              <ul className="upload-result-list">
                {uploadResults.map((r) => (
                  <li key={r.id} className={`upload-result-item upload-${r.status}`}>
                    <span className="upload-filename">{r.fileName}</span>
                    {r.status === "uploading" && <span className="upload-spinner">⏳</span>}
                    {r.status === "success" && <span className="upload-success">✓ Uploaded</span>}
                    {r.status === "failed" && (
                      <span className="upload-failed">✗ {r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={handleCancel} disabled={formState === "submitting"}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={formState === "submitting"}>
            {formState === "submitting" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </main>
  );
}