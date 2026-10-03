/**
 * Actions Taken — Ticket Detail area (Issue #52 — Lab 4, ui-spec §3).
 *
 * Two deliberately separate entry components share only internal presentation:
 *
 *   - `StaffActionsTaken`   — Staff/Admin list, pagination, create/edit entry.
 *   - `RequesterActionsTaken` — read-only restricted projection. It never
 *     invokes or renders any staff mutation behavior (create/edit form, owner
 *     lookup, status controls); the backend remains the authorization boundary.
 *
 * Keeping the Requester branch separate (rather than a `role` flag inside one
 * component) makes it much harder to leak a staff-only control or field into
 * the Requester surface (BR-09/BR-11).
 *
 * Reads use a request-generation guard so a slow response for a previously
 * selected page/Ticket can never overwrite newer state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ACTION_STATUS_LABELS,
  ACTIONS_PAGE_SIZE,
  fetchRequesterActions,
  fetchStaffActions,
  type ActionPagination,
  type RequesterActionDto,
  type StaffActionDto,
} from "./api";
import type { ApiError } from "./api-client";
import { formatUtcDate } from "./format";
import ActionForm from "./ActionForm";

/** Ticket statuses on which no new Action may be created (BR-27). */
const TERMINAL_TICKET_STATUSES = new Set(["RESOLVED", "CLOSED", "CANCELLED"]);

type LoadState = "loading" | "loaded" | "error";
type LoadErrorKind = "forbidden" | "not-found" | "unexpected";

/** A single label/value line inside an Action card. */
function ActionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="action-field">
      <span className="action-field-label">{label}</span>
      <span className="action-field-value">{children}</span>
    </div>
  );
}

/** Textual status chip — colour is never the only indicator (ui-spec §1). */
function ActionStatusChip({ status }: { status: keyof typeof ACTION_STATUS_LABELS }) {
  return (
    <span className={`action-status-badge action-status-${status.toLowerCase()}`}>
      {ACTION_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Fixed-size paging controls (ui-spec §3).
 *
 * `Page X of Y` appears for every nonempty result; Previous/Next appear only
 * when there is more than one page, and are disabled at the boundaries. There
 * is no page-size selector by contract.
 */
function ActionPagination({
  pagination,
  disabled,
  onPageChange,
}: {
  pagination: ActionPagination;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalItems === 0) return null;

  const { page, totalPages } = pagination;
  const hasManyPages = totalPages > 1;

  return (
    <nav className="action-pagination" aria-label="Actions pages">
      {hasManyPages && (
        <button
          type="button"
          className="secondary-button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
      )}
      <span className="action-page-status" role="status">
        Page {page} of {totalPages}
      </span>
      {hasManyPages && (
        <button
          type="button"
          className="secondary-button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      )}
    </nav>
  );
}

/** Distinguishes forbidden / not-found / safe-retry read failures (ui-spec §1). */
function ActionReadError({
  kind,
  message,
  onRetry,
}: {
  kind: LoadErrorKind;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={kind === "unexpected" ? "error-box" : "empty-state"} role="alert">
      <p>
        {kind === "forbidden"
          ? "You do not have permission to view Actions for this Ticket."
          : kind === "not-found"
            ? "Actions not found."
            : message}
      </p>
      {kind === "unexpected" && (
        <div className="error-actions">
          <button type="button" className="secondary-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

/** Shared empty/loading scaffolding for both role surfaces. */
function ActionsSkeleton() {
  return (
    <div role="status" aria-label="Loading Actions">
      <div className="skeleton-select" />
      <div className="skeleton-select" />
    </div>
  );
}

interface StaffActionsTakenProps {
  ticketNumber: string;
  /** The Ticket's workflow status; drives the BR-27 create gate. */
  ticketStatus: string;
}

/**
 * Staff/Admin Actions Taken area.
 *
 * Owns the Action list, fixed pagination, and the entry point into
 * `ActionForm` for create/edit. Mutation success and list refresh are handled
 * separately: a failed refresh never retracts an already-committed write.
 */
export function StaffActionsTaken({ ticketNumber, ticketStatus }: StaffActionsTakenProps) {
  const [items, setItems] = useState<StaffActionDto[]>([]);
  const [pagination, setPagination] = useState<ActionPagination>({
    page: 1,
    pageSize: ACTIONS_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<{ kind: LoadErrorKind; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingAction, setEditingAction] = useState<StaffActionDto | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const generationRef = useRef(0);
  const ticketRef = useRef(ticketNumber);
  ticketRef.current = ticketNumber;

  /**
   * Reads one page. Throws on failure so callers can tell a *read* failure
   * (rendered as the section's error state) apart from a *post-mutation
   * refresh* failure (rendered as a warning that keeps the committed value).
   */
  const load = useCallback(
    async (targetPage: number) => {
      const generation = ++generationRef.current;
      const requestedTicket = ticketNumber;
      const requestedPage = targetPage;
      setLoadState("loading");
      setLoadError(null);
      try {
        const result = await fetchStaffActions(requestedTicket, requestedPage, ACTIONS_PAGE_SIZE);
        if (generation !== generationRef.current || requestedTicket !== ticketRef.current) return;
        // A page that is now beyond the new total falls back to page 1 (ui-spec §3).
        if (result.data.length === 0 && requestedPage > 1 && result.pagination.totalPages > 0) {
          setPage(1);
          return;
        }
        setItems(result.data);
        setPagination(result.pagination);
        setLoadState("loaded");
      } catch (err) {
        if (generation !== generationRef.current || requestedTicket !== ticketRef.current) return;
        const apiError = err as ApiError;
        const kind: LoadErrorKind =
          apiError.status === 403 ? "forbidden" : apiError.status === 404 ? "not-found" : "unexpected";
        setItems([]);
        setLoadError({ kind, message: apiError.message || "Unable to load Actions." });
        setLoadState("error");
        throw err;
      }
    },
    [ticketNumber],
  );

  // Reset paging whenever the Ticket changes.
  useEffect(() => {
    setPage(1);
    setMode("list");
    setEditingAction(null);
    setRefreshWarning(null);
  }, [ticketNumber]);

  useEffect(() => {
    void load(page).catch(() => {
      /* already rendered as the section error state */
    });
  }, [load, page, reloadTick]);

  /**
   * Re-reads after a successful mutation. A failure here is a *refresh*
   * problem only: the committed Action stays visible, the read state is left
   * alone, and the user gets a warning with an explicit Retry (FR-18/FR-19).
   */
  const refreshAfterMutation = useCallback(
    async (targetPage: number) => {
      // B2 — a post-mutation refresh acquires its OWN generation. Snapshotting
      // the current one (the old behaviour) let an older ordinary read that was
      // already in flight keep authority and overwrite the fresh result.
      const generation = ++generationRef.current;
      const requestedTicket = ticketNumber;
      const requestedPage = targetPage;
      // Every state update below is guarded by BOTH the generation and the
      // Ticket, so a stale response can never land after a newer request.
      const isCurrent = () =>
        generation === generationRef.current && requestedTicket === ticketRef.current;
      try {
        const result = await fetchStaffActions(requestedTicket, requestedPage, ACTIONS_PAGE_SIZE);
        if (!isCurrent()) return;
        // A page that is now beyond the new total falls back to page 1 (ui-spec §3).
        if (result.data.length === 0 && requestedPage > 1 && result.pagination.totalPages > 0) {
          setPage(1);
          setRefreshWarning(null);
          return;
        }
        setItems(result.data);
        setPagination(result.pagination);
        setLoadState("loaded");
        setLoadError(null);
        setRefreshWarning(null);
      } catch {
        if (!isCurrent()) return;
        // The write already committed: keep the cached list and pagination,
        // leave the section usable (never stuck on "Updating Actions…"), and
        // report a refresh warning instead of a failed mutation (FR-18/FR-19).
        setLoadState("loaded");
        setRefreshWarning("The Action was saved, but the list could not be refreshed.");
      }
    },
    [ticketNumber],
  );

  const reload = useCallback(
    async (targetPage: number) => {
      await refreshAfterMutation(targetPage);
    },
    [refreshAfterMutation],
  );

  /**
   * Called after a commit. The write already succeeded using the server's
   * returned Action, so a failed list refresh only produces a warning and is
   * never reported as a failed mutation (FR-18/FR-19) — the committed value
   * stays on screen and the read state is left untouched.
   */
  const handleSaved = useCallback(
    async (saved: StaffActionDto) => {
      setItems((current) =>
        current.some((action) => action.id === saved.id)
          ? current.map((action) => (action.id === saved.id ? saved : action))
          : current,
      );
      await refreshAfterMutation(page);
    },
    [refreshAfterMutation, page],
  );

  const isTerminalTicket = TERMINAL_TICKET_STATUSES.has(ticketStatus);

  if (loadState === "loading" && items.length === 0 && loadError === null) {
    return (
      <section className="actions-taken" aria-label="Actions Taken">
        <h2>Actions Taken</h2>
        <ActionsSkeleton />
      </section>
    );
  }

  if (loadState === "error" && loadError) {
    return (
      <section className="actions-taken" aria-label="Actions Taken">
        <h2>Actions Taken</h2>
        <ActionReadError
          kind={loadError.kind}
          message={loadError.message}
          onRetry={() => setReloadTick((tick) => tick + 1)}
        />
      </section>
    );
  }

  return (
    <section className="actions-taken" aria-label="Actions Taken">
      <h2>Actions Taken</h2>

      <div className="actions-toolbar">
        {isTerminalTicket ? (
          <p className="action-reopen-guidance" role="note">
            This Ticket is {ticketStatus.toLowerCase()}. Reopen it before recording new Actions.
          </p>
        ) : mode === "list" ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => setMode("create")}
          >
            Add Action
          </button>
        ) : null}
      </div>

      {refreshWarning && (
        <div className="error-box" role="alert">
          <p>{refreshWarning}</p>
          <div className="error-actions">
            <button type="button" className="secondary-button" onClick={() => void reload(page)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {(mode === "create" || mode === "edit") &&
        (mode === "create" ? !isTerminalTicket : editingAction !== null) && (
          <ActionForm
            key={mode === "edit" && editingAction ? `edit-${editingAction.id}` : "create"}
            ticketNumber={ticketNumber}
            action={mode === "edit" ? editingAction : null}
            onSaved={handleSaved}
            onCancel={() => {
              setMode("list");
              setEditingAction(null);
            }}
            onEditClosed={() => {
              setMode("list");
              setEditingAction(null);
            }}
          />
        )}

      {loadState === "loading" && (
        <p className="placeholder-text" role="status">
          Updating Actions…
        </p>
      )}

      {items.length === 0 ? (
        <p className="placeholder-text">No Actions recorded for this Ticket.</p>
      ) : (
        <ul className="action-list">
          {items.map((action) => {
            const isPending = action.status === "PENDING";
            return (
              <li className="action-card" key={action.id}>
                <div className="action-card-header">
                  <ActionStatusChip status={action.status} />
                  <span className="action-card-date">{formatUtcDate(action.createdAt)}</span>
                </div>
                <p className="action-card-description">{action.description}</p>
                <div className="action-card-fields">
                  <ActionField label="Result">
                    {action.result === null ? (
                      <span className="muted">—</span>
                    ) : (
                      action.result
                    )}
                  </ActionField>
                  <ActionField label="Follow-up Required">
                    {action.followUpRequired ? "Yes" : "No"}
                  </ActionField>
                  {action.followUpRequired && action.followUpNote !== null && (
                    <ActionField label="Follow-up Note">{action.followUpNote}</ActionField>
                  )}
                  <ActionField label="Attachment Notes">
                    {action.attachmentNotes === null ? (
                      <span className="muted">—</span>
                    ) : (
                      action.attachmentNotes
                    )}
                  </ActionField>
                  <ActionField label="Performed by">{action.performedBy.name}</ActionField>
                  <ActionField label="Assignee">
                    {action.assignee === null ? (
                      <span className="muted">Unassigned</span>
                    ) : (
                      action.assignee.name
                    )}
                  </ActionField>
                  <ActionField label="Last Updated">{formatUtcDate(action.updatedAt)}</ActionField>
                </div>
                <div className="action-card-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingAction(action);
                      setMode("edit");
                    }}
                  >
                    {/* Terminal Actions open a read-only View surface; only
                        Pending Actions expose an edit path (BR-04/AC-06). */}
                    {isPending ? "Edit Action" : "View Action"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ActionPagination
        pagination={pagination}
        disabled={loadState === "loading"}
        onPageChange={(next) => {
          if (next !== page) setPage(next);
        }}
      />
    </section>
  );
}

interface RequesterActionsTakenProps {
  ticketNumber: string;
}

/**
 * Read-only Actions Taken area for the owning Requester.
 *
 * Uses the restricted `RequesterActionDto` projection and renders no create,
 * edit, assign, complete or cancel control of any kind. Staff-only metadata
 * (IDs, assignee role, `version`, revisions, Internal Notes) is neither
 * fetched nor rendered (BR-09/BR-11).
 */
export function RequesterActionsTaken({ ticketNumber }: RequesterActionsTakenProps) {
  const [items, setItems] = useState<RequesterActionDto[]>([]);
  const [pagination, setPagination] = useState<ActionPagination>({
    page: 1,
    pageSize: ACTIONS_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<{ kind: LoadErrorKind; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const generationRef = useRef(0);
  const ticketRef = useRef(ticketNumber);
  ticketRef.current = ticketNumber;

  const load = useCallback(
    async (targetPage: number) => {
      const generation = ++generationRef.current;
      const requestedTicket = ticketNumber;
      setLoadState("loading");
      setLoadError(null);
      try {
        const result = await fetchRequesterActions(requestedTicket, targetPage, ACTIONS_PAGE_SIZE);
        if (generation !== generationRef.current || requestedTicket !== ticketRef.current) return;
        if (result.data.length === 0 && targetPage > 1 && result.pagination.totalPages > 0) {
          setPage(1);
          return;
        }
        setItems(result.data);
        setPagination(result.pagination);
        setLoadState("loaded");
      } catch (err) {
        if (generation !== generationRef.current || requestedTicket !== ticketRef.current) return;
        const apiError = err as ApiError;
        const kind: LoadErrorKind =
          apiError.status === 403 ? "forbidden" : apiError.status === 404 ? "not-found" : "unexpected";
        setItems([]);
        setLoadError({ kind, message: apiError.message || "Unable to load Actions." });
        setLoadState("error");
      }
    },
    [ticketNumber],
  );

  useEffect(() => {
    setPage(1);
  }, [ticketNumber]);

  useEffect(() => {
    void load(page);
  }, [load, page, reloadTick]);

  if (loadState === "loading" && items.length === 0 && loadError === null) {
    return (
      <section className="actions-taken requester-actions-taken" aria-label="Actions Taken">
        <h2>Actions Taken</h2>
        <ActionsSkeleton />
      </section>
    );
  }

  if (loadState === "error" && loadError) {
    return (
      <section className="actions-taken requester-actions-taken" aria-label="Actions Taken">
        <h2>Actions Taken</h2>
        <ActionReadError
          kind={loadError.kind}
          message={loadError.message}
          onRetry={() => setReloadTick((tick) => tick + 1)}
        />
      </section>
    );
  }

  return (
    <section className="actions-taken requester-actions-taken" aria-label="Actions Taken">
      <h2>Actions Taken</h2>

      {items.length === 0 ? (
        <p className="placeholder-text">No Actions recorded for this Ticket.</p>
      ) : (
        <ul className="action-list">
          {items.map((action) => (
            <li className="action-card action-card-readonly" key={action.id}>
              <div className="action-card-header">
                <ActionStatusChip status={action.status} />
                <span className="action-card-date">{formatUtcDate(action.createdAt)}</span>
              </div>
              <p className="action-card-description">{action.description}</p>
              <div className="action-card-fields">
                <ActionField label="Result">
                  {action.result === null ? <span className="muted">—</span> : action.result}
                </ActionField>
                <ActionField label="Follow-up Required">
                  {action.followUpRequired ? "Yes" : "No"}
                </ActionField>
                {action.followUpRequired && action.followUpNote !== null && (
                  <ActionField label="Follow-up Note">{action.followUpNote}</ActionField>
                )}
                <ActionField label="Attachment Notes">
                  {action.attachmentNotes === null ? (
                    <span className="muted">—</span>
                  ) : (
                    action.attachmentNotes
                  )}
                </ActionField>
                <ActionField label="Performed by">{action.performedBy.name}</ActionField>
                <ActionField label="Assignee">
                  {action.assignee === null ? (
                    <span className="muted">Unassigned</span>
                  ) : (
                    action.assignee.name
                  )}
                </ActionField>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionPagination
        pagination={pagination}
        disabled={loadState === "loading"}
        onPageChange={(next) => {
          if (next !== page) setPage(next);
        }}
      />
    </section>
  );
}

export default StaffActionsTaken;
