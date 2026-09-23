/**
 * Frozen Test-DD file: `client/src/lab-03-tests/StaffTicketQueue.test.tsx`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - UI-QUE-01  Staff Ticket Queue (AC-10)
 *   - UI-QUE-02  Staff Queue zero-result search/filter (AC-10)
 *
 * Supplementary (never a tests.md row): owner filter, combined filters, and the
 * ui-spec §5.6 required queue information (Category, Last Updated) on both the
 * desktop table and the mobile card representation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketQueue from "../StaffTicketQueue";
import * as api from "../api";

vi.mock("../api");

const TICKET = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Printer not working",
  categoryName: "Hardware",
  currentStatus: "NEW",
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  ticketOwnerId: null,
  requesterId: 7,
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-12T00:00:00Z",
};

const OWNERS = [
  { id: 5, name: "Alice", role: "IT_STAFF" },
  { id: 6, name: "Carol", role: "ADMINISTRATOR" },
];

function queueResponse(data = [TICKET], unfilteredTotalItems = data.length) {
  return {
    data,
    pagination: {
      page: 1,
      pageSize: 10,
      totalItems: data.length,
      totalPages: data.length === 0 ? 0 : 1,
      unfilteredTotalItems,
    },
  };
}

describe("UI-QUE-01 — Staff Ticket Queue (AC-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  });
  afterEach(() => cleanup());

  it("renders the required columns and the Open Detail action", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Printer not working").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NEW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Open Detail/i }).length).toBeGreaterThan(0);
  });

  it("invokes onOpenDetail when the Open Detail action is used", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    const onOpenDetail = vi.fn();
    render(<StaffTicketQueue onOpenDetail={onOpenDetail} />);

    const buttons = await screen.findAllByRole("button", { name: /Open Detail/i });
    await userEvent.click(buttons[0]!);
    expect(onOpenDetail).toHaveBeenCalledWith("TKT-2026-000001");
  });

  it("passes the search term to the API", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenCalled());
    const input = screen.getByLabelText("Search tickets");
    await userEvent.type(input, "printer");

    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "printer" }),
      ),
    );
  });

  it("passes the status and priority filters to the API", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "OPEN");
    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "OPEN" }),
      ),
    );

    await userEvent.selectOptions(screen.getByLabelText("Filter by IT priority"), "HIGH");
    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: "HIGH" }),
      ),
    );
  });

  it("associates every Queue filter with an explicit label", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    const { container } = render(<StaffTicketQueue onOpenDetail={() => {}} />);
    await screen.findAllByText("TKT-2026-000001");

    for (const controlId of ["queue-search", "queue-status", "queue-priority", "queue-owner"]) {
      const control = container.querySelector(`#${controlId}`);
      expect(control).toBeTruthy();
      expect(container.querySelector(`label[for="${controlId}"]`)).toBeTruthy();
    }
  });

  it("loads the next page when pagination is used", async () => {
    vi.mocked(api.fetchStaffQueue)
      .mockResolvedValueOnce({ ...queueResponse(), pagination: { ...queueResponse().pagination, totalPages: 2 } })
      .mockResolvedValue({
        ...queueResponse(),
        pagination: { ...queueResponse().pagination, page: 2, totalPages: 2 },
      });
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    await screen.findAllByText("TKT-2026-000001");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("changes sort order and resets pagination", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    await screen.findAllByText("TKT-2026-000001");

    await userEvent.click(within(screen.getByRole("columnheader", { name: /Summary/ })).getByText(/Summary/));
    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "summary", order: "desc", page: 1 }),
      ),
    );
  });

  it("shows the loading state while the Queue request is pending", async () => {
    let resolveQueue: ((value: ReturnType<typeof queueResponse>) => void) | undefined;
    vi.mocked(api.fetchStaffQueue).mockImplementation(
      () => new Promise((resolve) => { resolveQueue = resolve; }),
    );
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    expect(screen.getByRole("status", { name: "Loading queue" })).toBeTruthy();
    resolveQueue?.(queueResponse());
    await screen.findAllByText("TKT-2026-000001");
  });

  it("shows the empty state when there are no tickets at all", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse([], 0));
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    expect(await screen.findByText(/no tickets in the queue/i)).toBeTruthy();
  });

  it("shows the failure state with a Retry action", async () => {
    vi.mocked(api.fetchStaffQueue).mockRejectedValue(new Error("Network error"));
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Network error");
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("shows a distinct forbidden state without Retry for a 403", async () => {
    const forbidden = new Error("Forbidden") as api.ApiError;
    forbidden.status = 403;
    vi.mocked(api.fetchStaffQueue).mockRejectedValue(forbidden);
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    expect(await screen.findByText(/do not have permission to view the ticket queue/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retry/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Supplementary — owner filter (ui-spec §5.6, FR-16)
// ---------------------------------------------------------------------------

describe("Owner filter (ui-spec §5.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  });
  afterEach(() => cleanup());

  it("renders the owner filter with only eligible owners", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    const select = await screen.findByLabelText("Filter by owner");
    expect(select).toBeTruthy();
    expect(screen.getByRole("option", { name: "All Owners" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Alice — IT Staff/ })).toBeTruthy(),
    );
    expect(screen.getByRole("option", { name: /Carol — Administrator/ })).toBeTruthy();
  });

  it("passes ownerId to the API and resets to page 1", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenCalled());
    await userEvent.selectOptions(await screen.findByLabelText("Filter by owner"), "5");

    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ ownerId: 5, page: 1 }),
      ),
    );
  });

  it("combines search, status, IT priority, and owner in one request", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenCalled());
    await userEvent.type(screen.getByLabelText("Search tickets"), "printer");
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "OPEN");
    await userEvent.selectOptions(screen.getByLabelText("Filter by IT priority"), "HIGH");
    await userEvent.selectOptions(await screen.findByLabelText("Filter by owner"), "5");

    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "printer",
          status: "OPEN",
          priority: "HIGH",
          ownerId: 5,
        }),
      ),
    );
  });

  it("Clear Filters removes the owner selection and resets to page 1", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(api.fetchStaffQueue).toHaveBeenCalled());
    await userEvent.selectOptions(await screen.findByLabelText("Filter by owner"), "5");
    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ ownerId: 5 }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));

    await waitFor(() => {
      const lastCall = vi.mocked(api.fetchStaffQueue).mock.calls.at(-1)![0];
      expect(lastCall?.ownerId).toBeUndefined();
      expect(lastCall?.page).toBe(1);
    });
    expect((screen.getByLabelText("Filter by owner") as HTMLSelectElement).value).toBe("");
  });

  it("keeps the queue usable when the eligible-owner lookup fails", async () => {
    vi.mocked(api.fetchAssignableOwners).mockRejectedValue(new Error("boom"));
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() =>
      expect(screen.getAllByText("Printer not working").length).toBeGreaterThan(0),
    );
    expect(screen.getByLabelText("Filter by owner")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Supplementary — required queue information (ui-spec §5.6)
// ---------------------------------------------------------------------------

describe("Required queue information (ui-spec §5.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  });
  afterEach(() => cleanup());

  it("exposes every required field for a ticket", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0));

    // Ticket No., Summary, Category, Requested Priority, IT Priority, Status,
    // Owner, Created, Last Updated, Open Detail.
    expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Printer not working").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hardware").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MEDIUM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NEW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Last Updated/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Open Detail/i }).length).toBeGreaterThan(0);
  });

  it("renders the mobile card with the same required information", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    const { container } = render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0));

    const card = container.querySelector(".ticket-card");
    expect(card).toBeTruthy();
    const text = card!.textContent ?? "";
    expect(text).toContain("TKT-2026-000001");
    expect(text).toContain("Printer not working");
    expect(text).toContain("Hardware");
    expect(text).toContain("MEDIUM");
    expect(text).toContain("HIGH");
    expect(text).toContain("Unassigned");
    expect(text).toContain("Last Updated");
    expect(card!.querySelector("button")?.textContent).toMatch(/Open Detail/i);
  });

  it("keeps tablet header and body column visibility aligned", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse());
    const { container } = render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await waitFor(() => expect(container.querySelector(".tickets-table")).toBeTruthy());

    const table = container.querySelector(".tickets-table")!;
    const headers = Array.from(table.querySelectorAll("thead th"));
    const cells = Array.from(table.querySelectorAll("tbody tr:first-child td"));
    const headerIndex = (label: string) =>
      headers.findIndex((header) => header.textContent?.trim().startsWith(label));

    const statusIndex = headerIndex("Status");
    const requestedPriorityIndex = headerIndex("Requested Priority");
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(requestedPriorityIndex).toBeGreaterThanOrEqual(0);
    expect(headers[statusIndex]!.classList.contains("tablet-secondary")).toBe(false);
    expect(cells[statusIndex]!.classList.contains("tablet-secondary")).toBe(false);
    expect(headers[requestedPriorityIndex]!.classList.contains("tablet-secondary")).toBe(true);
    expect(cells[requestedPriorityIndex]!.classList.contains("tablet-secondary")).toBe(true);

    expect(table.querySelectorAll("thead .tablet-secondary").length).toBe(
      table.querySelectorAll("tbody tr:first-child .tablet-secondary").length,
    );
  });
});

describe("UI-QUE-02 — Staff Queue zero-result search/filter (AC-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("shows the no-results message (not an error) when filters match nothing", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse([], 5));
    render(<StaffTicketQueue onOpenDetail={() => {}} />);
    expect(await screen.findByText(/no tickets match your filters/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears filters from the no-results state", async () => {
    vi.mocked(api.fetchStaffQueue).mockResolvedValue(queueResponse([], 5));
    render(<StaffTicketQueue onOpenDetail={() => {}} />);

    await screen.findByText(/no tickets match your filters/i);
    await userEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));

    await waitFor(() =>
      expect(api.fetchStaffQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined, status: undefined, priority: undefined }),
      ),
    );
  });
});