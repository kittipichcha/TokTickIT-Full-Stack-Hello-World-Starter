import { useState, useEffect, useCallback } from "react";
import {
  fetchMyTickets,
  fetchCategories,
  type DevRequester,
  type MyTicketItem,
  type MyTicketsResponse,
  type Category,
} from "./api";
import { formatUtcDate } from "./format";

type LoadState = "loading" | "loaded" | "error" | "empty" | "no-results";

interface MyTicketsProps {
  requester: DevRequester;
  onViewTicket: (ticketNumber: string) => void;
  onCreateTicket: () => void;
  resetKey: number;
}

const VALID_SORTS = ["createdAt", "ticketNumber", "summary", "requestedPriority"] as const;
type SortField = (typeof VALID_SORTS)[number];
type SortOrder = "asc" | "desc";

export default function MyTickets({ requester, onViewTicket, onCreateTicket, resetKey }: MyTicketsProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  // Filter state
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [requestedPriority, setRequestedPriority] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  // Sort state
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data state
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tickets, setTickets] = useState<MyTicketItem[]>([]);
  const [pagination, setPagination] = useState<MyTicketsResponse["pagination"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load categories for filter dropdown
  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        // Categories are non-critical for the list; filter just won't show options
      });
    return () => { cancelled = true; };
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const result = await fetchMyTickets(requester.id, {
        search: search || undefined,
        categoryId,
        requestedPriority,
        status,
        sort,
        order,
        page,
        pageSize,
      });

      // Handle out-of-range page: navigate to last valid page
      if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
        setPage(result.pagination.totalPages);
        return; // Will re-trigger via page state change
      }

      setTickets(result.data);
      setPagination(result.pagination);

      // Determine state based on unfilteredTotalItems
      if (result.pagination.unfilteredTotalItems === 0) {
        setLoadState("empty");
      } else if (result.pagination.totalItems === 0) {
        setLoadState("no-results");
      } else {
        setLoadState("loaded");
      }
    } catch (err) {
      setLoadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load tickets.");
    }
  }, [requester.id, search, categoryId, requestedPriority, status, sort, order, page, pageSize]);

  // Reload when filters, sort, page, or resetKey change
  useEffect(() => {
    void loadTickets();
  }, [loadTickets, resetKey]);

  // Reset filters when requester changes (resetKey changes)
  useEffect(() => {
    setSearch("");
    setCategoryId(undefined);
    setRequestedPriority(undefined);
    setStatus(undefined);
    setSort("createdAt");
    setOrder("desc");
    setPage(1);
  }, [resetKey]);

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
    setCategoryId(undefined);
    setRequestedPriority(undefined);
    setStatus(undefined);
    setPage(1);
  };

  const hasActiveFilters = search || categoryId !== undefined || requestedPriority || status;

  // Pagination helpers
  const startItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endItem = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.totalItems) : 0;

  const sortIndicator = (field: SortField): string => {
    if (sort !== field) return "";
    return order === "asc" ? " ▲" : " ▼";
  };

  const renderSortableHeader = (label: string, field: SortField) => (
    <th
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
      {label}{sortIndicator(field)}
    </th>
  );

  return (
    <main className="app-container my-tickets">
      {/* Toolbar */}
      <div className="my-tickets-toolbar">
        <div className="toolbar-filters">
          <div className="toolbar-search">
            <input
              type="search"
              placeholder="Search ticket number or summary..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Search tickets"
            />
          </div>
          <select
            value={categoryId ?? ""}
            onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={requestedPriority ?? ""}
            onChange={(e) => { setRequestedPriority(e.target.value || undefined); setPage(1); }}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <select
            value={status ?? ""}
            onChange={(e) => { setStatus(e.target.value || undefined); setPage(1); }}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
          </select>
          {hasActiveFilters && (
            <button className="tertiary-button" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>
        <button className="primary-button" onClick={onCreateTicket}>
          Create Ticket
        </button>
      </div>

      {/* Error state */}
      {loadState === "error" && (
        <div className="error-box" role="alert">
          <p>{errorMessage}</p>
          <div className="error-actions">
            <button className="primary-button" onClick={() => void loadTickets()}>Retry</button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadState === "loading" && (
        <div role="status" aria-label="Loading tickets">
          {/* Desktop skeleton table */}
          <div className="tickets-table-skeleton desktop-only">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell" />
              </div>
            ))}
          </div>
          {/* Mobile skeleton cards */}
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

      {/* Empty state */}
      {loadState === "empty" && (
        <div className="empty-state my-tickets-empty" role="status">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
            style={{ marginBottom: "12px" }}
          >
            <rect x="8" y="12" width="48" height="40" rx="4" stroke="var(--border-light)" strokeWidth="2" fill="var(--pale)" />
            <line x1="16" y1="24" x2="48" y2="24" stroke="var(--border-light)" strokeWidth="2" />
            <line x1="16" y1="32" x2="40" y2="32" stroke="var(--border-light)" strokeWidth="2" />
            <line x1="16" y1="40" x2="44" y2="40" stroke="var(--border-light)" strokeWidth="2" />
            <circle cx="48" cy="44" r="10" fill="var(--primary)" />
            <line x1="48" y1="40" x2="48" y2="48" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="44" y1="44" x2="52" y2="44" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>You haven't created any tickets yet.</p>
          <button className="primary-button" onClick={onCreateTicket}>Create Ticket</button>
        </div>
      )}

      {/* No-results state */}
      {loadState === "no-results" && (
        <div className="empty-state my-tickets-no-results">
          <p>No tickets match your filters.</p>
          <button className="primary-button" onClick={handleClearFilters}>Clear Filters</button>
        </div>
      )}

      {/* Loaded state */}
      {loadState === "loaded" && pagination && (
        <>
          {/* Desktop table */}
          <div className="tickets-table-wrapper desktop-only">
            <table className="tickets-table" role="grid">
              <thead>
                <tr>
                  {renderSortableHeader("Ticket No.", "ticketNumber")}
                  {renderSortableHeader("Created Date", "createdAt")}
                  {renderSortableHeader("Summary", "summary")}
                  <th>Category</th>
                  {renderSortableHeader("Requested Priority", "requestedPriority")}
                  <th>Current Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <a
                        href={`#ticket/${ticket.ticketNumber}`}
                        onClick={(e) => { e.preventDefault(); onViewTicket(ticket.ticketNumber); }}
                      >
                        {ticket.ticketNumber}
                      </a>
                    </td>
                    <td>{formatUtcDate(ticket.createdAt)}</td>
                    <td>{ticket.summary}</td>
                    <td>{ticket.categoryName}</td>
                    <td>
                      <span className={`priority-badge priority-${ticket.requestedPriority.toLowerCase()}`}>
                        {ticket.requestedPriority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${ticket.currentStatus.toLowerCase()}`}>
                        {ticket.currentStatus}
                      </span>
                    </td>
                    <td>{formatUtcDate(ticket.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="tickets-cards mobile-only">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-card-header">
                  <a
                    href={`#ticket/${ticket.ticketNumber}`}
                    onClick={(e) => { e.preventDefault(); onViewTicket(ticket.ticketNumber); }}
                  >
                    {ticket.ticketNumber}
                  </a>
                  <span className={`status-badge status-${ticket.currentStatus.toLowerCase()}`}>
                    {ticket.currentStatus}
                  </span>
                </div>
                <div className="ticket-card-summary">{ticket.summary}</div>
                <div className="ticket-card-details">
                  <span>{ticket.categoryName}</span>
                  <span className={`priority-badge priority-${ticket.requestedPriority.toLowerCase()}`}>
                    {ticket.requestedPriority}
                  </span>
                  <span>{formatUtcDate(ticket.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
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
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={p === page ? "pagination-page active" : "pagination-page"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
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