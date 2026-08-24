import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

vi.mock("./api");

describe("Application Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem("toktickit.requesterId", "1");
    vi.mocked(api.fetchDevRequesters).mockResolvedValue([
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ]);
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
    expect(screen.getByText("My Tickets")).toBeDefined();
    expect(screen.getByText("Create Ticket")).toBeDefined();
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByRole("button", { name: /change requester/i })).toBeDefined();
  });

  it("should render main container with welcome message", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /welcome, ada lovelace/i })).toBeDefined();
  });
});
