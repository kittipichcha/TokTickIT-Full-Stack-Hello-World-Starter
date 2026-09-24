import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import App from "./App";
import * as api from "./api";
import * as apiClient from "./api-client";
import { TEST_USER } from "./lab-02-tests/helpers/user";

vi.mock("./api");
vi.mock("./api-client");

/** An authenticated Administrator (review 48-B1). */
const TEST_ADMIN_USER: apiClient.AuthUser = {
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
    vi.mocked(apiClient.apiJson).mockResolvedValue({ data: [] });
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
// UI-48-NAV — Administrator role-based initial navigation (review 48-B1)
//
// An Administrator must never land on the Requester-only My Tickets screen and
// must not see Requester-only navigation. Within #48's feature set the
// Administrator entry point is User Management.
// ---------------------------------------------------------------------------

describe("UI-48-NAV: Administrator initial navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(apiClient.apiJson).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("lands a fresh Administrator session on User Management, not My Tickets", async () => {
    render(<App user={TEST_ADMIN_USER} />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeTruthy();
    // The Requester-only My Tickets screen is not rendered.
    expect(screen.queryByRole("heading", { name: "My Tickets" })).toBeNull();
  });

  it("hides Requester-only navigation from an Administrator", async () => {
    render(<App user={TEST_ADMIN_USER} />);

    const nav = await screen.findByRole("navigation", { name: /primary/i });
    expect(within(nav).queryByText("My Tickets")).toBeNull();
    expect(within(nav).queryByText("Create Ticket")).toBeNull();
    expect(within(nav).getByText("User Management")).toBeTruthy();
  });

  it("keeps Requester navigation unchanged for a Requester", async () => {
    render(<App user={TEST_USER} />);

    const nav = await screen.findByRole("navigation", { name: /primary/i });
    expect(within(nav).getByText("My Tickets")).toBeTruthy();
    expect(within(nav).getByText("Create Ticket")).toBeTruthy();
    expect(within(nav).queryByText("User Management")).toBeNull();
  });

  it("leaves User Management when the authenticated role is no longer Administrator", async () => {
    const { rerender } = render(<App user={TEST_ADMIN_USER} />);
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeTruthy();

    // Simulate the refreshed identity published after a self-demotion.
    rerender(<App user={{ ...TEST_ADMIN_USER, role: "IT_STAFF" }} />);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "User Management" })).toBeNull();
    });
  });
});
