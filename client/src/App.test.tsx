import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as api from "./api";
import { TEST_USER, TEST_STAFF_USER } from "./lab-02-tests/helpers/user";
import type { AuthUser } from "./api-client";

vi.mock("./api");

const TEST_ADMIN_USER: AuthUser = {
  id: 3,
  name: "Alan Turing",
  email: "alan@example.com",
  role: "ADMINISTRATOR",
  mustChangePassword: false,
};

describe("Application Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(api.fetchStaffQueue).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchAssignableOwners).mockImplementation(async () => []);
  });

  afterEach(() => {
    cleanup();
  });

  it("should render header with wordmark and navigation", async () => {
    render(<App user={TEST_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeDefined();
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Create Ticket").length).toBeGreaterThan(0);
    // The Development Requester selector and its Change Requester action are removed.
    expect(screen.queryByRole("button", { name: /change requester/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /development requester/i })).toBeNull();
  });

  it("should render the My Tickets screen for the authenticated user", async () => {
    render(<App user={TEST_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Issue #38 review fix (49-B1) — role-specific navigation and entry behavior
// (FR-08, ui-spec §5.3). These cases fail against the pre-fix implementation,
// which initialized every authenticated user on the Requester `home` view.
// ---------------------------------------------------------------------------

describe("UI-49-01..05 — role-specific initial navigation (FR-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(api.fetchStaffQueue).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchAssignableOwners).mockImplementation(async () => []);
  });

  afterEach(() => {
    cleanup();
  });

  it("UI-49-01 — IT Staff starts on the Ticket Queue, not My Tickets", async () => {
    render(<App user={TEST_STAFF_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    // The Staff Queue is the initial screen.
    expect(await screen.findByRole("heading", { name: /ticket queue/i })).toBeTruthy();
    // Requester-only destinations are absent from the navigation.
    expect(screen.queryByRole("link", { name: /^My Tickets$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Create Ticket$/i })).toBeNull();
    // The Requester My Tickets screen was never fetched/rendered.
    expect(api.fetchMyTickets).not.toHaveBeenCalled();
  });

  it("UI-49-02 — Administrator starts on the Ticket Queue, not My Tickets", async () => {
    render(<App user={TEST_ADMIN_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(await screen.findByRole("heading", { name: /ticket queue/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^My Tickets$/i })).toBeNull();
    expect(api.fetchMyTickets).not.toHaveBeenCalled();
  });

  it("UI-49-03 — IT Staff navigation exposes only staff-authorized destinations", async () => {
    render(<App user={TEST_STAFF_USER} />);

    const nav = await screen.findByRole("navigation", { name: /primary/i });
    expect(nav.textContent).toContain("Ticket Queue");
    expect(nav.textContent).not.toContain("My Tickets");
    expect(nav.textContent).not.toContain("Create Ticket");
  });

  it("UI-49-04 — Administrator navigation omits Requester-only destinations", async () => {
    render(<App user={TEST_ADMIN_USER} />);

    const nav = await screen.findByRole("navigation", { name: /primary/i });
    expect(nav.textContent).toContain("Ticket Queue");
    expect(nav.textContent).not.toContain("My Tickets");
    expect(nav.textContent).not.toContain("Create Ticket");
  });

  it("UI-49-05 — a Requester-only view is never rendered for Staff/Admin", async () => {
    render(<App user={TEST_STAFF_USER} />);

    await screen.findByText("TokTickIT");
    // No Requester-only screen content is present anywhere in the shell.
    expect(screen.queryByText(/No tickets yet/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /create ticket/i })).toBeNull();
    expect(api.fetchMyTickets).not.toHaveBeenCalled();
  });

  it("keeps the Requester flow unchanged (regression)", async () => {
    render(<App user={TEST_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Ticket Queue$/i })).toBeNull();
    expect(api.fetchStaffQueue).not.toHaveBeenCalled();
  });

  it("keeps Appears Resolved successful when the follow-up refresh fails", async () => {
    vi.mocked(api.fetchMyTickets).mockResolvedValue({
      data: [{
        id: 1,
        ticketNumber: "TKT-2026-000001",
        categoryId: 1,
        categoryName: "Hardware",
        summary: "Printer not working",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "OPEN",
        createdAt: "2026-09-10T00:00:00Z",
        updatedAt: "2026-09-10T00:00:00Z",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
    });
    vi.mocked(api.fetchTicketDetail)
      .mockResolvedValueOnce({
        id: 1,
        ticketNumber: "TKT-2026-000001",
        requesterId: TEST_USER.id,
        requesterName: TEST_USER.name,
        requesterIsActive: true,
        categoryId: 1,
        categoryName: "Hardware",
        relatedSystemId: 1,
        relatedSystemName: "Office",
        summary: "Printer not working",
        description: "The printer is offline.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        ticketOwnerId: null,
        currentStatus: "OPEN",
        createdAt: "2026-09-10T00:00:00Z",
        updatedAt: "2026-09-10T00:00:00Z",
        appearsResolved: false,
        publicComments: [],
        attachments: [],
      })
      .mockRejectedValueOnce(new Error("Refresh failed"));
    vi.mocked(api.postAppearsResolved).mockResolvedValue({
      ticketNumber: "TKT-2026-000001",
      appearsResolved: true,
      currentStatus: "OPEN",
    });

    render(<App user={TEST_USER} />);
    await userEvent.click((await screen.findAllByRole("link", { name: "TKT-2026-000001" }))[0]!);
    await screen.findByRole("button", { name: /indicate problem appears resolved/i });
    await userEvent.click(screen.getByRole("button", { name: /indicate problem appears resolved/i }));

    await waitFor(() => expect(screen.getByText(/you have indicated the problem appears resolved/i)).toBeTruthy());
    expect(api.postAppearsResolved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("Indicator updated");
  });
});
