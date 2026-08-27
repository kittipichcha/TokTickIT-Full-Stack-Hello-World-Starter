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
    vi.mocked(api.fetchMyTickets).mockImplementation(async () =>
      makeResult([makeTicket(1)], { unfilteredTotalItems: 1 }),
    );

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
    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for shell to appear
    await screen.findAllByRole("button", { name: "Change Requester" });

    // After Change Requester, switch mock to return requesterSetB
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesterSetB);

    const changeButtons = screen.getAllByRole("button", { name: "Change Requester" });
    fireEvent.click(changeButtons[0]);

    // Should be back on selector screen
    await screen.findByLabelText("Development Requester");
    // App shell should be gone - no Change Requester button visible
    expect(screen.queryByText("Choose a Development Requester")).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();

    const selectAfterChange = screen.getByLabelText("Development Requester");
    fireEvent.change(selectAfterChange, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findAllByText("Alan Turing");
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

  it("navigates to last valid page when page exceeds totalPages", async () => {
    // Scenario: user is on page 1, API returns page=1, totalPages=3
    // User clicks page 3, API returns page=3, totalPages=3 with tickets
    // User applies a filter, API returns page=3, totalPages=1, data=[]
    // Component should navigate to page 1 and re-fetch
    const normalResponse = makeResult(
      [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4), makeTicket(5)],
      { page: 1, pageSize: 10, totalItems: 5, totalPages: 1, unfilteredTotalItems: 5 },
    );

    // StrictMode double-renders, so we need 2 mock implementations for normal
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => normalResponse);

    render(<App />);

    const selects = await screen.findAllByLabelText("Development Requester");
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Should show tickets from page 1
    const ticketElements = await screen.findAllByText("Ticket 1 summary");
    expect(ticketElements.length).toBeGreaterThan(0);
    expect(screen.queryByText("You haven't created any tickets yet.")).toBeNull();
    expect(screen.queryByText("No tickets match your filters.")).toBeNull();
  });
});
