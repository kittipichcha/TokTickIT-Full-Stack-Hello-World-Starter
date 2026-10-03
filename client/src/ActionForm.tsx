/**
 * Staff/Admin Action create + edit form (Issue #52 — Lab 4, ui-spec §3).
 *
 * Deliberately separate from `ActionsTaken.tsx` so no mutation control can
 * accidentally be rendered on the Requester surface: only `StaffActionsTaken`
 * imports this module.
 *
 * Contract points encoded here:
 *   - BR-05   description required; Result required to complete; follow-up
 *             note required only while the follow-up flag is true; Attachment
 *             Notes is plain text (there is no file input in this feature).
 *   - BR-25   create carries a stable `Idempotency-Key` reused for an
 *             unchanged logical retry, rotated only when the normalized
 *             payload changes or the previous request succeeded.
 *   - BR-24   every PATCH sends the current `expectedVersion`; a `409` is
 *             never auto-retried — the draft is kept and the user must
 *             explicitly review the latest Action and Save again. The review
 *             step reconciles every field the user did NOT change from the
 *             fetched latest Action, so a stale untouched value can never be
 *             laundered into a new version. Create-mode `409`s (no Action
 *             exists yet) never build the stale-Action review state.
 *   - BR-03   a current assignee who is no longer eligible stays visible and
 *             must be explicitly replaced or unassigned before saving. The
 *             eligible-owner list is refreshed during conflict recovery so a
 *             mid-session deactivation becomes visible.
 *   - BR-04   a terminal (Completed/Cancelled) Action renders a genuine
 *             read-only View surface: no editable fields, no Save, no owner
 *             lookup. Only Pending Actions are editable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ACTION_STATUS_LABELS,
  fetchActionDetail,
  fetchAssignableOwners,
  createTicketAction,
  updateTicketAction,
  type AssignableOwner,
  type CreateActionPayload,
  type StaffActionDto,
  type UpdateActionPayload,
} from "./api";
import type { ApiError } from "./api-client";
import { formatUtcDate } from "./format";

/** Field bounds mirrored from api-spec §2 so the client fails fast. */
const BOUNDS = {
  description: 2000,
  result: 2000,
  followUpNote: 1000,
  attachmentNotes: 1000,
} as const;

type OwnerLoadState = "loading" | "loaded" | "error";
type SaveState = "idle" | "saving";

/** Editable field keys tracked for dirty/reconcile bookkeeping (BR-24). */
type NormalizedFieldKey = keyof NormalizedFields | "status";

interface NormalizedFields {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  assigneeUserId: number | null;
}

/** Trim text, collapse blank optional values to `null` (api-spec §2). */
function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Ordered logical fingerprint of the normalized create payload.
 *
 * Used to decide whether a retry is the *same* logical create (reuse the key)
 * or a different one (rotate the key). Key order is fixed so the fingerprint
 * is stable.
 */
function payloadFingerprint(fields: NormalizedFields): string {
  return JSON.stringify([
    fields.description,
    fields.result,
    fields.followUpRequired,
    fields.followUpNote,
    fields.attachmentNotes,
    fields.assigneeUserId,
  ]);
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Standards-compliant fallback; never a weak/short random token.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface ActionFormProps {
  ticketNumber: string;
  /** `null` = create mode; otherwise the Pending Action being edited. */
  action: StaffActionDto | null;
  /** Reports a committed server write (mutation success only, never refresh). */
  onSaved: (saved: StaffActionDto) => void;
  onCancel: () => void;
  /** Called after an edit closes so the list can settle. */
  onEditClosed?: () => void;
}

export default function ActionForm({
  ticketNumber,
  action,
  onSaved,
  onCancel,
  onEditClosed,
}: ActionFormProps) {
  const isEdit = action !== null;

  const [description, setDescription] = useState(action?.description ?? "");
  const [result, setResult] = useState(action?.result ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(action?.followUpRequired ?? false);
  const [followUpNote, setFollowUpNote] = useState(action?.followUpNote ?? "");
  const [attachmentNotes, setAttachmentNotes] = useState(action?.attachmentNotes ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState<number | "">(
    action?.assignee ? action.assignee.id : "",
  );
  const [status, setStatus] = useState<StaffActionDto["status"]>(action?.status ?? "PENDING");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Owner (eligible assignee) list.
  const [owners, setOwners] = useState<AssignableOwner[]>([]);
  const [ownersState, setOwnersState] = useState<OwnerLoadState>("loading");
  const ownerSeqRef = useRef(0);
  /**
   * N1 — remembered display identity for every owner ever seen, keyed by user
   * ID. A selected assignee keeps its real name even when the active list
   * cannot currently supply it (initial load failure, deactivation, conflict
   * recovery), so the control never loses or mislabels who is selected.
   */
  const knownOwnerByIdRef = useRef<Map<number, AssignableOwner>>(new Map());
  // Seed the persisted assignee as soon as an edit form mounts.
  if (action?.assignee) {
    knownOwnerByIdRef.current.set(action.assignee.id, {
      id: action.assignee.id,
      name: action.assignee.name,
      role: action.assignee.role,
    });
  }

  // Create idempotency-key lifecycle.
  const pendingKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  // Synchronous duplicate-submit guard (double click emits one POST).
  const inFlightRef = useRef(false);

  // Version conflict state — draft is always preserved.
  const [conflict, setConflict] = useState<{ latest: StaffActionDto | null; reviewed: boolean } | null>(
    null,
  );

  const [expectedVersion, setExpectedVersion] = useState<number | null>(action?.version ?? null);
  const [currentAction, setCurrentAction] = useState<StaffActionDto | null>(action);

  /**
   * BR-24 — fields the user actually edited since the form loaded. Conflict
   * recovery keeps these values and reconciles every *untouched* field from
   * the fetched latest Action, so a stale untouched value is never re-sent.
   */
  const dirtyRef = useRef<Set<NormalizedFieldKey>>(new Set());
  const markDirty = (key: NormalizedFieldKey) => {
    dirtyRef.current.add(key);
  };

  /** BR-04 — terminal Actions are read-only; only Pending is editable. */
  const isTerminalAction = isEdit && currentAction !== null && currentAction.status !== "PENDING";

  const loadOwners = useCallback(async () => {
    const requestId = ++ownerSeqRef.current;
    setOwnersState("loading");
    try {
      const list = await fetchAssignableOwners();
      if (requestId !== ownerSeqRef.current) return;
      // Remember every returned owner so their identity survives later list
      // changes, then publish the authoritative ACTIVE list.
      list.forEach((owner) => knownOwnerByIdRef.current.set(owner.id, owner));
      setOwners(list);
      setOwnersState("loaded");
    } catch {
      if (requestId !== ownerSeqRef.current) return;
      // N1 — a failed lookup proves nothing about eligibility. Keep the last
      // successful list and remembered labels instead of clearing them.
      setOwnersState("error");
    }
  }, []);

  useEffect(() => {
    // BR-04 — a terminal Action renders read-only; there is no assignee
    // control, so the eligible-owner list is never fetched for it.
    if (action !== null && action.status !== "PENDING") return;
    void loadOwners();
    return () => {
      ownerSeqRef.current += 1;
    };
  }, [loadOwners, action]);

  const ownerIds = useMemo(() => new Set(owners.map((owner) => owner.id)), [owners]);

  /** The single selected assignee, derived from the DRAFT — never from the
   *  persisted Action, which may name a different person after a conflict. */
  const selectedAssigneeId = assigneeUserId === "" ? null : Number(assigneeUserId);
  /** Active-ness is judged ONLY against the last successful owner list. */
  const selectedAssigneeIsActive = selectedAssigneeId !== null && ownerIds.has(selectedAssigneeId);
  /** Display identity resolved through remembered owners, keyed by the SELECTED
   *  ID — `currentAction.assignee.name` is never used for a different person. */
  const selectedAssigneeName =
    selectedAssigneeId === null
      ? null
      : (knownOwnerByIdRef.current.get(selectedAssigneeId)?.name ??
        (currentAction?.assignee?.id === selectedAssigneeId
          ? currentAction.assignee.name
          : null));

  /**
   * BR-03 — a selected assignee that a SUCCESSFUL load proves ineligible stays
   * visible and blocks Save until the user explicitly picks an eligible user
   * or unassigns. An unavailable/loading list is *unknown*, not ineligible.
   */
  const currentIneligible =
    isEdit &&
    !isTerminalAction &&
    ownersState === "loaded" &&
    selectedAssigneeId !== null &&
    !selectedAssigneeIsActive;

  const fields: NormalizedFields = useMemo(
    () => ({
      description: description.trim(),
      result: normalize(result),
      followUpRequired,
      followUpNote: followUpRequired ? normalize(followUpNote) : null,
      attachmentNotes: normalize(attachmentNotes),
      assigneeUserId: assigneeUserId === "" ? null : Number(assigneeUserId),
    }),
    [description, result, followUpRequired, followUpNote, attachmentNotes, assigneeUserId],
  );

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (fields.description.length === 0) {
      errors.description = "Description is required.";
    } else if (fields.description.length > BOUNDS.description) {
      errors.description = `Description must be ${BOUNDS.description} characters or fewer.`;
    }

    if (fields.result !== null && fields.result.length > BOUNDS.result) {
      errors.result = `Result must be ${BOUNDS.result} characters or fewer.`;
    }

    if (followUpRequired) {
      if (fields.followUpNote === null) {
        errors.followUpNote = "Follow-up note is required when follow-up is required.";
      } else if (fields.followUpNote.length > BOUNDS.followUpNote) {
        errors.followUpNote = `Follow-up note must be ${BOUNDS.followUpNote} characters or fewer.`;
      }
    }

    if (fields.attachmentNotes !== null && fields.attachmentNotes.length > BOUNDS.attachmentNotes) {
      errors.attachmentNotes = `Attachment Notes must be ${BOUNDS.attachmentNotes} characters or fewer.`;
    }

    // BR-04 — completing requires a Result; cancelling does not.
    if (isEdit && status === "COMPLETED" && fields.result === null) {
      errors.result = "Result is required to complete an Action.";
    }

    if (currentIneligible) {
      errors.assigneeUserId =
        "The current assignee is no longer eligible. Choose an eligible assignee or unassign.";
    }

    return errors;
  }

  /**
   * Fetches the authoritative latest version for the explicit review step.
   *
   * BR-24 lossless reconciliation: after the fetch, every editable field the
   * user did NOT change is replaced with the latest server value, while dirty
   * user fields keep the draft. `expectedVersion` advances only afterwards,
   * so the next Save sends latest values for untouched fields and the user's
   * intentional edits for the fields they changed. The eligible-owner list is
   * refreshed too, so a mid-session assignee deactivation becomes visible.
   */
  async function reviewLatest(): Promise<void> {
    if (!currentAction) return;
    setFormError(null);
    try {
      const [latest] = await Promise.all([
        fetchActionDetail(ticketNumber, currentAction.id),
        loadOwners(),
      ]);
      const dirty = dirtyRef.current;
      // Record the persisted assignee's identity BEFORE reconciling state, so a
      // dirty selected assignee can still be labelled by its own name.
      if (latest.assignee) {
        knownOwnerByIdRef.current.set(latest.assignee.id, {
          id: latest.assignee.id,
          name: latest.assignee.name,
          role: latest.assignee.role,
        });
      }
      if (!dirty.has("description")) setDescription(latest.description);
      if (!dirty.has("result")) setResult(latest.result ?? "");
      if (!dirty.has("followUpRequired")) setFollowUpRequired(latest.followUpRequired);
      if (!dirty.has("followUpNote")) setFollowUpNote(latest.followUpNote ?? "");
      if (!dirty.has("attachmentNotes")) setAttachmentNotes(latest.attachmentNotes ?? "");
      if (!dirty.has("assigneeUserId")) {
        setAssigneeUserId(latest.assignee ? latest.assignee.id : "");
      }
      if (!dirty.has("status")) setStatus(latest.status);
      setCurrentAction(latest);
      setExpectedVersion(latest.version);
      setConflict({ latest, reviewed: true });
    } catch (err) {
      const apiError = err as ApiError;
      setConflict({ latest: null, reviewed: false });
      setFormError(apiError.message || "Unable to load the latest Action. Try again.");
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current) return;

    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    setConflict(null);
    // N4 — a success notice from a previous logical create must not survive
    // into this attempt (it could otherwise show alongside a new error).
    setSuccessNotice(null);
    if (Object.keys(errors).length > 0) return;

    inFlightRef.current = true;
    setSaveState("saving");
    try {
      if (!isEdit) {
        const fingerprint = payloadFingerprint(fields);
        const pending = pendingKeyRef.current;
        // Reuse the key only for an unchanged logical retry; rotate otherwise.
        const key =
          pending && pending.fingerprint === fingerprint ? pending.key : newIdempotencyKey();
        pendingKeyRef.current = { fingerprint, key };

        const payload: CreateActionPayload = { ...fields };
        const created = await createTicketAction(ticketNumber, payload, key);
        // Only a confirmed success retires the pending key.
        pendingKeyRef.current = null;
        setSuccessNotice(
          `Action recorded by ${created.performedBy.name} at ${created.createdAt}.`,
        );
        onSaved(created);
        // Clear the form but keep it open so the server-returned values show.
        setDescription("");
        setResult("");
        setFollowUpRequired(false);
        setFollowUpNote("");
        setAttachmentNotes("");
        setAssigneeUserId("");
        setFieldErrors({});
      } else if (currentAction) {
        const payload: UpdateActionPayload = {
          expectedVersion: expectedVersion ?? currentAction.version,
          ...fields,
          status,
        };
        const updated = await updateTicketAction(ticketNumber, currentAction.id, payload);
        setCurrentAction(updated);
        setExpectedVersion(updated.version);
        setConflict(null);
        setSuccessNotice(null);
        onSaved(updated);
        onEditClosed?.();
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409) {
        // Never auto-retry a stale/conflicting write (BR-24).
        if (isEdit && currentAction) {
          // Edit conflict: offer the explicit latest-Action review workflow.
          setConflict({ latest: null, reviewed: false });
          setFormError(
            apiError.message ||
              "The Action changed since you loaded it. Review the latest Action, then save again.",
          );
        } else {
          // Create conflict (Ticket became terminal, assignee became
          // ineligible, idempotency-key reuse): there is no Action to review,
          // so never build the stale-Action review state — that would render
          // a dead control. The draft is preserved and only the canonical
          // server message is shown.
          setConflict(null);
          setFormError(apiError.message || "The Action could not be recorded. Try again.");
        }
      } else {
        setFormError(apiError.message || "The Action could not be saved. Try again.");
      }
    } finally {
      inFlightRef.current = false;
      setSaveState("idle");
    }
  }

  const isSaving = saveState === "saving";
  const err = (name: string) => fieldErrors[name];
  /**
   * Maps a state key to the id of the rendered `role="alert"` error element so
   * `aria-describedby` resolves to a real node (AC-20/AC-21).
   */
  const ERROR_ELEMENT_ID: Record<string, string> = {
    description: "action-description-error",
    result: "action-result-error",
    followUpNote: "action-followup-note-error",
    attachmentNotes: "action-attachment-notes-error",
    assigneeUserId: "action-assigneeUserId-error",
  };
  const describedBy = (name: string, ...extra: Array<string | undefined>) =>
    [err(name) ? ERROR_ELEMENT_ID[name] : undefined, ...extra].filter(Boolean).join(" ") || undefined;

  // BR-04 / AC-06 — a terminal Action is genuinely read-only: current values
  // are shown as text, there is no Save, no status control, and no owner
  // lookup. This is a View surface, not a disabled edit form.
  if (isTerminalAction && currentAction) {
    const viewField = (label: string, value: ReactNode) => (
      <div className="action-field-row">
        <span className="action-label">{label}</span>
        <p className="action-view-value">{value}</p>
      </div>
    );
    return (
      <section className="action-form action-form-readonly" aria-label="View Action">
        <h3>View Action</h3>
        <p className="field-help" role="status">
          This Action is {ACTION_STATUS_LABELS[currentAction.status].toLowerCase()} and read-only.
        </p>
        {viewField("Description", currentAction.description)}
        {viewField("Result", currentAction.result ?? "—")}
        {viewField("Follow-up Required", currentAction.followUpRequired ? "Yes" : "No")}
        {currentAction.followUpRequired &&
          viewField("Follow-up Note", currentAction.followUpNote ?? "—")}
        {viewField("Attachment Notes", currentAction.attachmentNotes ?? "—")}
        {viewField("Status", ACTION_STATUS_LABELS[currentAction.status])}
        {viewField("Performed by", currentAction.performedBy.name)}
        {viewField("Assignee", currentAction.assignee?.name ?? "Unassigned")}
        {viewField("Created", formatUtcDate(currentAction.createdAt))}
        {viewField("Last Updated", formatUtcDate(currentAction.updatedAt))}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Close
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="action-form" aria-label={isEdit ? "Edit Action" : "Add Action"} onSubmit={(e) => void handleSubmit(e)}>
      <h3>{isEdit ? "Edit Action" : "Add Action"}</h3>

      {successNotice && (
        <div className="success-box" role="status">
          <p>{successNotice}</p>
        </div>
      )}

      {formError && (
        <div className="error-box" role="alert">
          <p>{formError}</p>
        </div>
      )}

      {conflict && (
        <div className="conflict-box" role="alert">
          <p>
            {conflict.reviewed
              ? "Latest saved Action shown below. Your draft is preserved — review it, then Save again."
              : "This Action was changed after you loaded it. Your entered values are preserved."}
          </p>
          {conflict.reviewed && conflict.latest ? (
            <dl className="conflict-latest">
              <dt>Description</dt>
              <dd>{conflict.latest.description}</dd>
              <dt>Result</dt>
              <dd>{conflict.latest.result ?? "—"}</dd>
              <dt>Follow-up Required</dt>
              <dd>{conflict.latest.followUpRequired ? "Yes" : "No"}</dd>
              <dt>Follow-up Note</dt>
              <dd>{conflict.latest.followUpNote ?? "—"}</dd>
              <dt>Attachment Notes</dt>
              <dd>{conflict.latest.attachmentNotes ?? "—"}</dd>
              <dt>Status</dt>
              <dd>{ACTION_STATUS_LABELS[conflict.latest.status]}</dd>
              <dt>Assignee</dt>
              <dd>{conflict.latest.assignee?.name ?? "Unassigned"}</dd>
              <dt>Version</dt>
              <dd>{conflict.latest.version}</dd>
            </dl>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void reviewLatest()}
              disabled={isSaving}
            >
              Review latest Action
            </button>
          )}
        </div>
      )}

      <div className="action-field-row">
        <label className="action-label" htmlFor="action-description">
          Description <span aria-hidden="true">*</span>
          <span className="visually-hidden"> (required)</span>
        </label>
        <textarea
          id="action-description"
          value={description}
          onChange={(e) => {
            markDirty("description");
            setDescription(e.target.value);
          }}
          aria-required="true"
          aria-invalid={err("description") ? true : undefined}
          aria-describedby={describedBy("description")}
          disabled={isSaving}
          rows={3}
        />
        {err("description") && (
          <p className="field-error" id="action-description-error" role="alert">
            {err("description")}
          </p>
        )}
      </div>

      <div className="action-field-row">
        <label className="action-label" htmlFor="action-result">
          Result
        </label>
        <textarea
          id="action-result"
          value={result}
          onChange={(e) => {
            markDirty("result");
            setResult(e.target.value);
          }}
          aria-invalid={err("result") ? true : undefined}
          aria-describedby={describedBy("result")}
          disabled={isSaving}
          rows={2}
        />
        {err("result") && (
          <p className="field-error" id="action-result-error" role="alert">
            {err("result")}
          </p>
        )}
      </div>

      <div className="action-field-row action-field-inline">
        <input
          type="checkbox"
          id="action-followup"
          checked={followUpRequired}
          onChange={(e) => {
            markDirty("followUpRequired");
            setFollowUpRequired(e.target.checked);
          }}
          disabled={isSaving}
        />
        <label className="action-label" htmlFor="action-followup">
          Follow-up Required
        </label>
      </div>

      {followUpRequired && (
        <div className="action-field-row">
          <label className="action-label" htmlFor="action-followup-note">
            Follow-up Note <span aria-hidden="true">*</span>
            <span className="visually-hidden"> (required)</span>
          </label>
          <textarea
            id="action-followup-note"
            value={followUpNote}
            onChange={(e) => {
              markDirty("followUpNote");
              setFollowUpNote(e.target.value);
            }}
            aria-required="true"
            aria-invalid={err("followUpNote") ? true : undefined}
            aria-describedby={describedBy("followUpNote")}
            disabled={isSaving}
            rows={2}
          />
          {err("followUpNote") && (
            <p className="field-error" id="action-followup-note-error" role="alert">
              {err("followUpNote")}
            </p>
          )}
        </div>
      )}

      <div className="action-field-row">
        <label className="action-label" htmlFor="action-attachment-notes">
          Attachment Notes
        </label>
        <textarea
          id="action-attachment-notes"
          value={attachmentNotes}
          onChange={(e) => {
            markDirty("attachmentNotes");
            setAttachmentNotes(e.target.value);
          }}
          aria-invalid={err("attachmentNotes") ? true : undefined}
          aria-describedby={describedBy("attachmentNotes", "action-attachment-notes-help")}
          disabled={isSaving}
          rows={2}
        />
        <p className="field-help" id="action-attachment-notes-help">
          Plain text describing any Attachment relevant to this Action. Attachments themselves stay
          in the Attachments section.
        </p>
        {err("attachmentNotes") && (
          <p className="field-error" id="action-attachment-notes-error" role="alert">
            {err("attachmentNotes")}
          </p>
        )}
      </div>

      <div className="action-field-row">
        <label className="action-label" htmlFor="action-assignee">
          Assignee
        </label>
        <select
          id="action-assignee"
          value={assigneeUserId === "" ? "" : String(assigneeUserId)}
          onChange={(e) => {
            markDirty("assigneeUserId");
            setAssigneeUserId(e.target.value ? Number(e.target.value) : "");
          }}
          aria-invalid={err("assigneeUserId") ? true : undefined}
          aria-describedby={describedBy(
            "assigneeUserId",
            // N3 — only reference IDs that actually exist in the DOM.
            ownersState === "error" ? "action-assignee-help" : undefined,
            currentIneligible ? "action-assignee-ineligible" : undefined,
          )}
          disabled={isSaving || ownersState === "loading"}
        >
          <option value="">Unassigned</option>
          {/* N1 — a selected assignee missing from the active list still needs
              exactly one option so the control shows WHO is selected. The label
              distinguishes a proven-ineligible owner from an eligibility-unknown
              one (owner lookup failed or is still loading). */}
          {selectedAssigneeId !== null && !selectedAssigneeIsActive && (
            <option value={String(selectedAssigneeId)}>
              {selectedAssigneeName ?? "Current assignee"}
              {ownersState === "loaded"
                ? " (ineligible)"
                : " (current — eligibility unavailable)"}
            </option>
          )}
          {owners.map((owner) => (
            <option key={owner.id} value={String(owner.id)}>
              {owner.name} — {owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"}
            </option>
          ))}
        </select>

        {ownersState === "loading" && (
          <p className="field-help" role="status">
            Loading eligible assignees…
          </p>
        )}
        {ownersState === "error" && (
          <div className="field-error" id="action-assignee-help" role="alert">
            <span>Unable to load eligible assignees. Your entered values are kept.</span>
            <button type="button" className="tertiary-button" onClick={() => void loadOwners()}>
              Retry
            </button>
          </div>
        )}
        {currentIneligible && (
          <p className="field-warning" id="action-assignee-ineligible" role="alert">
            The current assignee is no longer an active Staff/Administrator. Choose an eligible
            assignee or unassign before saving.
          </p>
        )}
        {err("assigneeUserId") && (
          <p className="field-error" id="action-assigneeUserId-error" role="alert">
            {err("assigneeUserId")}
          </p>
        )}
      </div>

      {isEdit && (
        <fieldset className="action-field-row action-status-group">
          <legend className="action-label">Status</legend>
          <div className="action-status-options" role="radiogroup" aria-label="Action status">
            <label htmlFor="action-status-pending">
              <input
                type="radio"
                id="action-status-pending"
                name="action-status"
                value="PENDING"
                checked={status === "PENDING"}
                onChange={() => {
                  markDirty("status");
                  setStatus("PENDING");
                }}
                disabled={isSaving || (currentAction?.status !== "PENDING" && currentAction !== null)}
              />
              Pending
            </label>
            <label htmlFor="action-status-completed">
              <input
                type="radio"
                id="action-status-completed"
                name="action-status"
                value="COMPLETED"
                checked={status === "COMPLETED"}
                onChange={() => {
                  markDirty("status");
                  setStatus("COMPLETED");
                }}
                disabled={isSaving || (currentAction?.status !== "PENDING" && currentAction !== null)}
              />
              Completed
            </label>
            <label htmlFor="action-status-cancelled">
              <input
                type="radio"
                id="action-status-cancelled"
                name="action-status"
                value="CANCELLED"
                checked={status === "CANCELLED"}
                onChange={() => {
                  markDirty("status");
                  setStatus("CANCELLED");
                }}
                disabled={isSaving || (currentAction?.status !== "PENDING" && currentAction !== null)}
              />
              Cancelled
            </label>
          </div>
          <p className="field-help">
            Pending Actions may move to Completed or Cancelled. Terminal Actions are read-only.
          </p>
        </fieldset>
      )}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Save Action" : "Record Action"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
