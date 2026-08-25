import { useState, useEffect } from "react";
import {
  fetchCategories,
  fetchRelatedSystems,
  createTicket,
  type Category,
  type RelatedSystem,
  type DevRequester,
} from "./api";
import { formatUtcDate } from "./format";

type FormState = "editing" | "submitting" | "success" | "error";

interface CreateTicketProps {
  requester: DevRequester;
  onViewTicket: (ticketNumber: string) => void;
  onCreateAnother: () => void;
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

  const handleSubmit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormState("submitting");
    setErrorMessage(null);

    try {
      const ticket = await createTicket(requester.id, {
        categoryId: categoryId!,
        relatedSystemId: relatedSystemId!,
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      });
      setCreatedTicketNumber(ticket.ticketNumber);
      setCreatedTicketDate(formatUtcDate(ticket.createdAt));
      setFormState("success");
    } catch (err) {
      const e = err as Error & { code?: string; fields?: Record<string, string> };
      setErrorMessage(e.message || "Failed to create ticket.");
      if (e.fields) setFieldErrors(e.fields);
      setFormState("error");
    }
  };

  const handleCancel = () => {
    // Reset form
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