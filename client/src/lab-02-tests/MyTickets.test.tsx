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
  categoryId: number;
  categoryName: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    id,
    ticketNumber: overrides.ticketNumber ?? `TKT-2026-${String(id).padStart(6, "0")}`,
    categoryId: overrides.categoryId ?? 1,
    categoryName: overrides.categoryName ?? "Hardware",
    summary: overrides.summary ?? `Ticket ${id} summary`,
    requestedPriority: overrides.requestedPriority ?? "MEDIUM",
    itPriority: overrides.itPriority ?? null,
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

  await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
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
        return makeResult([makeTicket(1, { summary: "Ticket A" })], { unfilteredTotalItems: 1 });
      }
      // Requester B (id=3)
      return makeResult([makeTicket(3, { ticketNumber: "TKT-2026-000003", summary: "Ticket B" })], { unfilteredTotalItems: 1 });
    });

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for shell to appear and Ticket A to show
    await screen.findAllByText("Ticket A");

    // After Change Requester, switch mock to return requesterSetB
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesterSetB);

    const changeButtons = screen.getAllByRole("button", { name: "Change Requester" });
    fireEvent.click(changeButtons[0]);

    // Should be back on selector screen
    await screen.findByRole("combobox", { name: /development requester/i });

    // Verify Ticket A is no longer displayed (requester context cleared)
    expect(screen.queryByText("Ticket A")).toBeNull();

    // Select requester B (Alan Turing, id=3)
    fireEvent.change(screen.getByRole("combobox", { name: /development requester/i }), { target: { value: "3" } });
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

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("status", { name: "Loading tickets" })).toBeTruthy();
  });

  it("shows error state with manual retry button on API failure", async () => {
    vi.mocked(api.fetchMyTickets).mockRejectedValue(new Error("Network error"));

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeTruthy();
  });

  it("no automatic retry before Retry button is clicked", async () => {
    // Track fetchMyTickets calls
    const fetchCalls: number[] = [];
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => {
      fetchCalls.push(Date.now());
      throw new Error("Network error");
    });

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for error state to appear
    await screen.findByRole("alert");

    // Count calls made so far (initial load + any StrictMode double-render)
    const initialCallCount = fetchCalls.length;

    // Wait a short period to verify no automatic retry
    await new Promise((r) => setTimeout(r, 500));

    // No additional calls should have been made
    expect(fetchCalls.length).toBe(initialCallCount);
  });

  it("clicking Retry makes exactly one additional fetch request", async () => {
    // First call fails, second call succeeds
    let callCount = 0;
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) {
        throw new Error("Network error");
      }
      return makeResult(
        [makeTicket(1, { summary: "Retried ticket" })],
        { unfilteredTotalItems: 1 },
      );
    });

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for error state
    await screen.findByRole("alert");

    // Record call count before retry
    const callsBeforeRetry = callCount;

    // Click Retry
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Wait for the retried ticket to appear
    await screen.findAllByText("Retried ticket");

    // Exactly one additional call was made
    expect(callCount).toBe(callsBeforeRetry + 1);
  });
});

describe("UI-MY-05: Valid out-of-range page does not display Empty or No-Results", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it("navigates to last valid page when API returns page > totalPages for the requested page", async () => {
    const initialResult = makeResult(
      [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4), makeTicket(5)],
      { page: 1, pageSize: 10, totalItems: 25, totalPages: 3, unfilteredTotalItems: 25 },
    );
    const outOfRangeResult = makeResult([], { page: 3, pageSize: 10, totalItems: 5, totalPages: 1, unfilteredTotalItems: 5 });
    const afterResetResult = makeResult(
      [makeTicket(1, { summary: "Ticket 1 after reset" })],
      { page: 1, pageSize: 10, totalItems: 5, totalPages: 1, unfilteredTotalItems: 5 },
    );

    // Track page 1 calls to distinguish initial loads from redirect
    let page1Calls = 0;
    vi.mocked(api.fetchMyTickets).mockImplementation(async (_rid, params) => {
      const p = params?.page ?? 1;
      if (p === 1) {
        page1Calls++;
        if (page1Calls <= 1) return initialResult;
        return afterResetResult;
      }
      // p === 3
      return outOfRangeResult;
    });

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Should show tickets from page 1
    await screen.findAllByText("Ticket 1 summary");

    // Click page 3 button
    const page3Button = screen.getByRole("button", { name: "3" });
    await userEvent.click(page3Button);

    // API returns page=3, totalPages=1 — component should redirect to page 1
    // Wait for the component to navigate to page 1 and show tickets
    await screen.findAllByText("Ticket 1 after reset");

    // Assert neither Empty nor No-Results is shown
    expect(screen.queryByText("You haven't created any tickets yet.")).toBeNull();
    expect(screen.queryByText("No tickets match your filters.")).toBeNull();
  });
});

describe("UI-MY-06: Mobile card collapse/expand for secondary details", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchCategories).mockImplementation(async () => [{ id: 1, name: "Hardware" }]);
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () =>
      makeResult([
        makeTicket(1, { ticketNumber: "TKT-2026-000001", summary: "Monitor issue", categoryName: "Hardware", requestedPriority: "HIGH", createdAt: "2026-08-21T09:14:00.000Z" }),
        makeTicket(2, { ticketNumber: "TKT-2026-000002", summary: "Software crash", categoryName: "Software", requestedPriority: "LOW", createdAt: "2026-08-22T10:00:00.000Z" }),
      ], { unfilteredTotalItems: 2 }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  function getToggleButtons(): NodeListOf<HTMLButtonElement> {
    return document.querySelectorAll(".ticket-card-toggle");
  }

  it("shows summary and ticket number/status outside collapsible region, details initially collapsed", async () => {
    await setupAuthenticatedApp();

    // Wait for ticket cards to appear (text appears in both table and cards)
    await screen.findAllByText("Monitor issue");

    // Ticket number and summary are always visible (appear in both table and cards)
    expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monitor issue").length).toBeGreaterThan(0);

    // Toggle button exists and shows "▼ More" with aria-expanded="false"
    const toggles = getToggleButtons();
    expect(toggles.length).toBe(2);
    expect(toggles[0].getAttribute("aria-expanded")).toBe("false");
    expect(toggles[0].textContent).toBe("▼ More");

    // Secondary details (category, priority, date) are not visible initially
    const detailsContainers = document.querySelectorAll(".ticket-card-details");
    expect(detailsContainers.length).toBe(0);
  });

  it("expands to show secondary details when toggle is clicked", async () => {
    await setupAuthenticatedApp();

    await screen.findAllByText("Monitor issue");

    const toggle1 = getToggleButtons()[0];
    await userEvent.click(toggle1);

    // After click, details should be visible
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(1);
    // Verify the card details container has the expected content
    const cardDetails = document.querySelector(".ticket-card-details");
    expect(cardDetails?.textContent).toContain("Hardware");
    expect(cardDetails?.textContent).toContain("HIGH");
    expect(cardDetails?.textContent).toContain("2026-08-21 09:14");

    // Toggle now shows "▲ Less" with aria-expanded="true"
    expect(toggle1.getAttribute("aria-expanded")).toBe("true");
    expect(toggle1.textContent).toBe("▲ Less");
  });

  it("collapses to hide secondary details when toggle is clicked again", async () => {
    await setupAuthenticatedApp();

    await screen.findAllByText("Monitor issue");

    const toggle1 = getToggleButtons()[0];
    await userEvent.click(toggle1);

    // Details visible after first click
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(1);

    // Click again to collapse
    await userEvent.click(toggle1);

    // Details should be hidden again
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(0);
    expect(toggle1.getAttribute("aria-expanded")).toBe("false");
    expect(toggle1.textContent).toBe("▼ More");
  });

  it("expands/collapses per-card independently", async () => {
    await setupAuthenticatedApp();

    await screen.findAllByText("Monitor issue");

    const toggles = getToggleButtons();
    const toggle1 = toggles[0];
    const toggle2 = toggles[1];

    // Expand only the first card
    await userEvent.click(toggle1);

    // Card 1 details visible
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(1);
    // Card 2 should not be expanded
    expect(toggle2.getAttribute("aria-expanded")).toBe("false");

    // Now expand card 2
    await userEvent.click(toggle2);

    // Both cards should now show details
    const detailsContainers = document.querySelectorAll(".ticket-card-details");
    expect(detailsContainers.length).toBe(2);
  });

  it("keyboard activation (Enter/Space) toggles expansion", async () => {
    await setupAuthenticatedApp();

    await screen.findAllByText("Monitor issue");

    const toggle1 = getToggleButtons()[0];

    // Activate via Enter key
    toggle1.focus();
    await userEvent.keyboard("{Enter}");

    // Details should now be visible
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(1);
    expect(toggle1.getAttribute("aria-expanded")).toBe("true");

    // Activate via Space key
    await userEvent.keyboard(" ");

    // Details should be hidden again
    expect(document.querySelectorAll(".ticket-card-details").length).toBe(0);
    expect(toggle1.getAttribute("aria-expanded")).toBe("false");
  });
});
describe("UI-MY-07: Stale-response protection — older request must not overwrite newer results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchCategories).mockImplementation(async () => [{ id: 1, name: "Hardware" }]);
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  });

  afterEach(() => {
    cleanup();
  });

  it("discards stale response from a slow earlier request when a newer request completes first", async () => {
    // Deferred promises to control resolution order
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });

    let callIdx = 0;
    vi.mocked(api.fetchMyTickets).mockImplementation(async (_rid, params) => {
      callIdx++;
      const search = params?.search ?? "";
      // Call 1 is the initial load — resolve immediately
      if (callIdx === 1) {
        return makeResult([], { unfilteredTotalItems: 0 });
      }
      // First search param change (e.g. "old") — hangs on promiseA
      if (callIdx === 2) {
        await promiseA;
        return makeResult(
          [makeTicket(1, { summary: "STALE result from old search" })],
          { unfilteredTotalItems: 1 },
        );
      }
      // All subsequent calls — hang on promiseB
      await promiseB;
      return makeResult(
        [makeTicket(2, { ticketNumber: "TKT-2026-000002", summary: "NEW result from new search" })],
        { unfilteredTotalItems: 1 },
      );
    });

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for initial empty state
    await screen.findByText("You haven't created any tickets yet.");

    // Get the search input
    const searchInput = screen.getAllByLabelText("Search tickets")[0];

    // Start request A (slow) — set search to "old"
    fireEvent.change(searchInput, { target: { value: "old" } });

    // Immediately start request B (fast) — set search to "new"
    fireEvent.change(searchInput, { target: { value: "new" } });

    // Resolve B first
    resolveB!(undefined);
    // Wait for B's result to render (appears in table and mobile cards)
    await screen.findAllByText("NEW result from new search");

    // Verify STALE is not yet displayed
    expect(screen.queryByText("STALE result from old search")).toBeNull();

    // Now resolve A (the stale request)
    resolveA!(undefined);

    // Wait a tick for React to process the stale state update
    await new Promise((r) => setTimeout(r, 100));

    // STALE should still not be displayed — the guard should have discarded it
    expect(screen.queryByText("STALE result from old search")).toBeNull();

    // NEW should still be displayed
    expect(screen.getAllByText("NEW result from new search").length).toBeGreaterThan(0);
  });
});