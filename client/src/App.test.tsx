import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

vi.mock("./api");

describe("Application Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem("toktickit.requesterId", "1");
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ]);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
    vi.mocked(api.getStoredRequesterId).mockImplementation(() => {
      const stored = sessionStorage.getItem("toktickit.requesterId");
      return stored ? Number(stored) : null;
    });
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("should render header with wordmark, navigation, and selected requester", async () => {
    render(<App />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeDefined();
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Create Ticket").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /change requester/i })).toBeDefined();
  });

  it("should render the My Tickets screen after requester selection", async () => {
    render(<App />);

    expect(await screen.findByText(/Ada Lovelace/)).toBeDefined();
  });
});
