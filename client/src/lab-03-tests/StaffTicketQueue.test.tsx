/**
 * Frozen Test-DD file: `client/src/lab-03-tests/StaffTicketQueue.test.tsx`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - UI-QUE-01  Staff Ticket Queue (AC-10)
 *   - UI-QUE-02  Staff Queue zero-result search/filter (AC-10)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketQueue from "../StaffTicketQueue";
import * as api from "../api";

vi.mock("../api");

const TICKET = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Printer not working",
  currentStatus: "NEW",
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  ticketOwnerId: null,
  requesterId: 7,
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-10T00:00:00Z",
};

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