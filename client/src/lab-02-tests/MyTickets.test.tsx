import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import * as api from "../api";

vi.mock("../api");

const requesters = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];

const requesterSetA = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];

const requesterSetB = [
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
  { id: 3, name: "Alan Turing", email: "alan@example.com" },
];

function makeTicket(id: number, overrides: Partial<{
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  categoryName: string;
  summary: string;
  requestedPriority: string;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    id,
    ticketNumber: overrides.ticketNumber ?? `TKT-2026-${String(id).padStart(6, "0")}`,
    requesterId: overrides.requesterId ?? 1,
    categoryId: overrides.categoryId ?? 1,
    categoryName: overrides.categoryName ?? "Hardware",
    summary: overrides.summary ?? `Ticket ${id} summary`,
    requestedPriority: overrides.requestedPriority ?? "MEDIUM",
    currentStatus: overrides.currentStatus ?? "NEW",
    createdAt: overrides.createdAt ?? "2026-08-21T09:14:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-21T09:14:00.000Z",
  };
}

function makeResult(
  tickets: ReturnType<typeof makeTicket>[],
  overrides: Partial<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  }> = {},
) {
  return {
    data: tickets,
    pagination: {
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 10,
      totalItems: overrides.totalItems ?? tickets.length,
      totalPages: overrides.totalPages ?? Math.ceil((overrides.totalItems ?? tickets.length) / (overrides.pageSize ?? 10)),
      unfilteredTotalItems: overrides.unfilteredTotalItems ?? tickets.length,
    },
  };
}

async function setupAuthenticatedApp() {
  vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
  vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  vi.mocked(api.fetchCategories).mockImplementation(async () => [{ id: 1, name: "Hardware" }, { id: 2, name: "Software" }]);

  render(<App />);

  const selects = await screen.findAllByLabelText("Development Requester");
  await userEvent.selectOptions(selects[0], "1");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Wait for app shell to appear (StrictMode may double-render)
  await screen.findAllByText(/Ada Lovelace/);
}

describe("UI-MY-01: Empty state when unfilteredTotalItems=0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () =>
      makeResult([], { totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when requester has no tickets", async () => {
    await setupAuthenticatedApp();
    expect(await screen.findByText("You haven't created any tickets yet.")).toBeTruthy();
    const createButtons = screen.getAllByRole("button", { name: "Create Ticket" });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state even with an active filter when unfilteredTotalItems=0", async () => {
    await setupAuthenticatedApp();

    // Type a search term
    const searchInputs = screen.getAllByLabelText("Search tickets");
    await userEvent.type(searchInputs[0], "something");

    // Should still show empty state
    const emptyElements = await screen.findAllByText("You haven't created any tickets yet.");
    expect(emptyElements.length).toBeGreaterThan(0);
  });
});

describe("UI-MY-02: No-Results state when unfilteredTotalItems>0 and filtered totalItems=0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () =>
      makeResult([], { totalItems: 0, totalPages: 0, unfilteredTotalItems: 5 }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows no-results state when filters yield zero matches but requester has tickets", async () => {
    await setupAuthenticatedApp();
    const noResultsElements = await screen.findAllByText("No tickets match your filters.");
    expect(noResultsElements.length).toBeGreaterThan(0);
    const clearButtons = screen.getAllByRole("button", { name: "Clear Filters" });
    expect(clearButtons.length).toBeGreaterThan(0);
  });
});

describe("UI-MY-03: Requester switch clears prior data and reloads new scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesterSetA);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async (id) => ({ requesterId: id }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => [{ id: 1, name: "Hardware" }]);

    vi.mocked(api.getStoredRequesterId).mockImplementation(() => {
      const stored = sessionStorage.getItem("toktickit.requesterId");
      return stored ? Number(stored) : null;
    });
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => {
      sessionStorage.setItem("toktickit.requesterId", String(id));
    });
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => {
      sessionStorage.removeItem("toktickit.requesterId");
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("clears prior requester data and reloads from new requester scope", async () => {
    // Return different data based on requester ID
    vi.mocked(api.fetchMyTickets).mockImplementation(async (requesterId) => {
      if (requesterId === 1) {
        return makeResult([makeTicket(1, { summary: "Ticket A", requesterId: 1 })], { unfilteredTotalItems: 1 });
      }
      // Requester B (id=3)
      return makeResult([makeTicket(3, { ticketNumber: "TKT-2026-000003", summary: "Ticket B", requesterId: 3 })], { unfilteredTotalItems: 1 });
    });

    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for shell to appear and Ticket A to show
    await screen.findAllByText("Ticket A");

    // After Change Requester, switch mock to return requesterSetB
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesterSetB);

    const changeButtons = screen.getAllByRole("button", { name: "Change Requester" });
    fireEvent.click(changeButtons[0]);

    // Should be back on selector screen
    await screen.findByLabelText("Development Requester");

    // Verify Ticket A is no longer displayed (requester context cleared)
    expect(screen.queryByText("Ticket A")).toBeNull();

    // Select requester B (Alan Turing, id=3)
    const selectAfterChange = screen.getByLabelText("Development Requester");
    fireEvent.change(selectAfterChange, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for Ticket B to appear
    await screen.findAllByText("Ticket B");

    // Verify Ticket A is absent
    expect(screen.queryByText("Ticket A")).toBeNull();
  });
});

describe("UI-MY-04: Loading skeleton and failure state with manual retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading skeleton while fetching tickets", async () => {
    vi.mocked(api.fetchMyTickets).mockReturnValue(new Promise(() => undefined));

    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("status", { name: "Loading tickets" })).toBeTruthy();
  });

  it("shows error state with manual retry button on API failure", async () => {
    vi.mocked(api.fetchMyTickets).mockRejectedValue(new Error("Network error"));

    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

describe("UI-MY-05: Valid out-of-range page does not display Empty or No-Results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates to last valid page when page exceeds totalPages after filter change", async () => {
    // Scenario:
    // 1. Initial response: page=1, totalPages=3
    // 2. Click page 3
    // 3. Return page 3 data
    // 4. Apply a filter
    // 5. Return: page=3, totalPages=1, data=[]
    // 6. Component should navigate to page 1 and re-fetch
    // 7. Return page 1 data
    // 8. Assert page 1 is displayed
    // 9. Assert neither Empty nor No-Results is shown

    // Track the requested page to serve appropriate responses
    const requestedPages: number[] = [];
    vi.mocked(api.fetchMyTickets).mockImplementation(async (_rid, params) => {
      const p = params?.page ?? 1;
      requestedPages.push(p);

      if (p === 1 && requestedPages.filter(x => x === 1).length <= 2) {
        // Initial load(s) - page 1, totalPages=3
        return makeResult(
          [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4), makeTicket(5)],
          { page: 1, pageSize: 10, totalItems: 25, totalPages: 3, unfilteredTotalItems: 25 },
        );
      }
      if (p === 3 && requestedPages.filter(x => x === 3).length === 1) {
        // Page 3 click - return page 3 data
        return makeResult(
          [makeTicket(30, { summary: "Ticket 30 on page 3" })],
          { page: 3, pageSize: 10, totalItems: 25, totalPages: 3, unfilteredTotalItems: 25 },
        );
      }
      if (p === 3 && requestedPages.filter(x => x === 3).length > 1) {
        // Filter applied, API returns page=3, totalPages=1, data=[]
        return makeResult([], { page: 3, pageSize: 10, totalItems: 0, totalPages: 1, unfilteredTotalItems: 5 });
      }
      // Page 1 after out-of-range redirect
      return makeResult(
        [makeTicket(1, { summary: "Ticket 1 after reset" })],
        { page: 1, pageSize: 10, totalItems: 5, totalPages: 1, unfilteredTotalItems: 5 },
      );
    });

    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Should show tickets from page 1
    await screen.findAllByText("Ticket 1 summary");

    // Click page 3 button
    const page3Button = screen.getByRole("button", { name: "3" });
    await userEvent.click(page3Button);

    // Wait for page 3 data to appear
    await screen.findAllByText("Ticket 30 on page 3");

    // Apply a filter (search) to trigger the out-of-range scenario
    const searchInputs = screen.getAllByLabelText("Search tickets");
    await userEvent.type(searchInputs[0], "something");

    // Wait for the component to navigate to page 1 and show tickets
    await screen.findAllByText("Ticket 1 after reset");

    // Assert neither Empty nor No-Results is shown
    expect(screen.queryByText("You haven't created any tickets yet.")).toBeNull();
    expect(screen.queryByText("No tickets match your filters.")).toBeNull();
  });
});
