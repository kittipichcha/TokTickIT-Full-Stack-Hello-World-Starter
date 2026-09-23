/**
 * IT Staff Ticket Queue (Issue #38 — ui-spec, api-spec §15).
 *
 * Responsive: a `<table>` on desktop/tablet and a stacked card list on mobile,
 * both driven from one data source. Six distinct states: loading, loaded,
 * empty, no-results, forbidden, error.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStaffQueue,
  fetchAssignableOwners,
  type StaffQueueItem,
  type StaffQueueResponse,
  type AssignableOwner,
} from "./api";
import type { ApiError } from "./api-client";
import { formatUtcDate } from "./format";

type LoadState = "loading" | "loaded" | "error" | "forbidden" | "empty" | "no-results";

interface StaffTicketQueueProps {
  onOpenDetail: (ticketNumber: string) => void;
}

const VALID_SORTS = ["createdAt", "ticketNumber", "summary", "status", "priority"] as const;
type SortField = (typeof VALID_SORTS)[number];
type SortOrder = "asc" | "desc";

const TICKET_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_FOR_REQUESTER", label: "Waiting for Requester" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "REOPENED", label: "Reopened" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export default function StaffTicketQueue({ onOpenDetail }: StaffTicketQueueProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [priority, setPriority] = useState<string | undefined>();
  const [ownerId, setOwnerId] = useState<number | undefined>();
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tickets, setTickets] = useState<StaffQueueItem[]>([]);
  const [pagination, setPagination] = useState<StaffQueueResponse["pagination"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [owners, setOwners] = useState<AssignableOwner[]>([]);

  const requestSeqRef = useRef(0);

  // Eligible owners (active IT Staff / Administrators) for the owner filter.
  // A failure here must not break the queue itself — the filter simply stays
  // limited to "All Owners".
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

  const loadQueue = useCallback(async () => {
    const seqId = ++requestSeqRef.current;
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const trimmedSearch = search.trim();
      const result = await fetchStaffQueue({
        search: trimmedSearch || undefined,
        status,
        priority,
        ownerId,
        sort,
        order,
        page,
        pageSize,
      });

      if (seqId !== requestSeqRef.current) return;

      if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
        setPage(result.pagination.totalPages);
        return;
      }
      if (seqId !== requestSeqRef.current) return;

      setTickets(result.data);
      setPagination(result.pagination);

      if (result.pagination.unfilteredTotalItems === 0) {
        setLoadState("empty");
      } else if (result.pagination.totalItems === 0) {
        setLoadState("no-results");
      } else {
        setLoadState("loaded");
      }
    } catch (err) {
      if (seqId === requestSeqRef.current) {
        const apiError = err as ApiError;
        setLoadState(apiError.status === 403 ? "forbidden" : "error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to load the queue.");
      }
    }
  }, [search, status, priority, ownerId, sort, order, page, pageSize]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleSortToggle = (field: SortField) => {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus(undefined);
    setPriority(undefined);
    setOwnerId(undefined);
    setPage(1);
  };

  const hasActiveFilters = search.trim() || status || priority || ownerId !== undefined;

  const startItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endItem = pagination
    ? Math.min(pagination.page * pagination.pageSize, pagination.totalItems)
    : 0;

  const sortIndicator = (field: SortField): string => {
    if (sort !== field) return "";
    return order === "asc" ? " ▲" : " ▼";
  };

  const renderSortableHeader = (label: string, field: SortField, className?: string) => (
    <th
      className={className}
      role="columnheader"
      aria-sort={sort === field ? (order === "asc" ? "ascending" : "descending") : "none"}
      tabIndex={0}
      onClick={() => handleSortToggle(field)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSortToggle(field);
        }
      }}
    >
      {label}
      {sortIndicator(field)}
    </th>
  );

  return (
    <main className="app-container staff-queue">
      <h1>Ticket Queue</h1>

      <div className="my-tickets-toolbar">
        <div className="toolbar-filters">
          <div className="toolbar-search">
            <label htmlFor="queue-search">Search tickets</label>
            <input
              id="queue-search"
              type="search"
              placeholder="Search ticket number or summary..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <label htmlFor="queue-status">Filter by status</label>
          <select
            id="queue-status"
            value={status ?? ""}
            onChange={(e) => {
              setStatus(e.target.value || undefined);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label htmlFor="queue-priority">Filter by IT priority</label>
          <select
            id="queue-priority"
            value={priority ?? ""}
            onChange={(e) => {
              setPriority(e.target.value || undefined);
              setPage(1);
            }}
          >
            <option value="">All IT Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <label htmlFor="queue-owner">Filter by owner</label>
          <select
            id="queue-owner"
            value={ownerId === undefined ? "" : String(ownerId)}
            onChange={(e) => {
              setOwnerId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
          >
            <option value="">All Owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={String(owner.id)}>
                {owner.name} — {owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button className="tertiary-button" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loadState === "error" && (
        <div className="error-box" role="alert">
          <p>{errorMessage}</p>
          <div className="error-actions">
            <button className="primary-button" onClick={() => void loadQueue()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loadState === "forbidden" && (
        <div className="empty-state" role="alert">
          <p>You do not have permission to view the ticket queue.</p>
        </div>
      )}

      {loadState === "loading" && (
        <div role="status" aria-label="Loading queue">
          <div className="tickets-table-skeleton desktop-only">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
              </div>
            ))}
          </div>
          <div className="tickets-card-skeleton mobile-only">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        </div>
      )}

      {loadState === "empty" && (
        <div className="empty-state" role="status">
          <p>There are no tickets in the queue.</p>
        </div>
      )}

      {loadState === "no-results" && (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
          <button className="primary-button" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {loadState === "loaded" && pagination && (
        <>
          <div className="tickets-table-wrapper desktop-only">
            <table className="tickets-table" role="grid">
              <thead>
                <tr>
                  {renderSortableHeader("Ticket No.", "ticketNumber")}
                  {renderSortableHeader("Summary", "summary")}
                  <th className="tablet-secondary">Category</th>
                  {renderSortableHeader("Status", "status")}
                  <th className="tablet-secondary">Requested Priority</th>
                  {renderSortableHeader("IT Priority", "priority")}
                  <th>Owner</th>
                  {renderSortableHeader("Created", "createdAt", "tablet-secondary")}
                  <th className="tablet-secondary">Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <a
                        href={`#staff-ticket/${ticket.ticketNumber}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenDetail(ticket.ticketNumber);
                        }}
                      >
                        {ticket.ticketNumber}
                      </a>
                    </td>
                    <td>{ticket.summary}</td>
                    <td className="tablet-secondary">{ticket.categoryName}</td>
                    <td>
                      <span className={`status-badge status-${ticket.currentStatus.toLowerCase()}`}>
                        {ticket.currentStatus}
                      </span>
                    </td>
                    <td className="tablet-secondary">
                      <span
                        className={`priority-badge priority-${ticket.requestedPriority.toLowerCase()}`}
                      >
                        {ticket.requestedPriority}
                      </span>
                    </td>
                    <td>
                      {ticket.itPriority ? (
                        <span className={`priority-badge priority-${ticket.itPriority.toLowerCase()}`}>
                          {ticket.itPriority}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {ticket.ticketOwnerId === null ? (
                        <span className="muted">Unassigned</span>
                      ) : (
                        `User #${ticket.ticketOwnerId}`
                      )}
                    </td>
                    <td className="tablet-secondary">{formatUtcDate(ticket.createdAt)}</td>
                    <td className="tablet-secondary">{formatUtcDate(ticket.updatedAt)}</td>
                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => onOpenDetail(ticket.ticketNumber)}
                      >
                        Open Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tickets-cards mobile-only">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-card-header">
                  <a
                    href={`#staff-ticket/${ticket.ticketNumber}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenDetail(ticket.ticketNumber);
                    }}
                  >
                    {ticket.ticketNumber}
                  </a>
                  <span className={`status-badge status-${ticket.currentStatus.toLowerCase()}`}>
                    {ticket.currentStatus}
                  </span>
                </div>
                <div className="ticket-card-summary">{ticket.summary}</div>
                <div className="ticket-card-details">
                  <span>Category: {ticket.categoryName}</span>
                  <span>
                    Requested:{" "}
                    <span
                      className={`priority-badge priority-${ticket.requestedPriority.toLowerCase()}`}
                    >
                      {ticket.requestedPriority}
                    </span>
                  </span>
                  <span>
                    IT:{" "}
                    {ticket.itPriority ? (
                      <span className={`priority-badge priority-${ticket.itPriority.toLowerCase()}`}>
                        {ticket.itPriority}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                  <span>
                    Owner:{" "}
                    {ticket.ticketOwnerId === null ? "Unassigned" : `User #${ticket.ticketOwnerId}`}
                  </span>
                  <span>Created: {formatUtcDate(ticket.createdAt)}</span>
                  <span>Last Updated: {formatUtcDate(ticket.updatedAt)}</span>
                </div>
                <button className="secondary-button" onClick={() => onOpenDetail(ticket.ticketNumber)}>
                  Open Detail
                </button>
              </div>
            ))}
          </div>

          <div className="pagination-footer">
            <span className="pagination-info">
              Showing {startItem}–{endItem} of {pagination.totalItems} tickets
            </span>
            <div className="pagination-controls">
              <button
                className="secondary-button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-page active">{page}</span>
              <button
                className="secondary-button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}