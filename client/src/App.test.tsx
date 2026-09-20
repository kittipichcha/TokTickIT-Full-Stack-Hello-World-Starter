import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "./App";
import * as api from "./api";
import { TEST_USER } from "./lab-02-tests/helpers/user";

vi.mock("./api");

describe("Application Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
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
