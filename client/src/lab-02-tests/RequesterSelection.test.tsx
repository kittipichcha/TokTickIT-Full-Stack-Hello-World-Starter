import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import * as api from "../api";

vi.mock("../api");

const requesters = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];

describe("Requester Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockImplementation(() => {
      const stored = sessionStorage.getItem("toktickit.requesterId");
      return stored ? Number(stored) : null;
    });
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading and requires context before the application shell", () => {
    vi.mocked(api.fetchDevRequesters).mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByRole("status").textContent).toContain("Loading active requesters");
    expect(screen.queryByRole("button", { name: "Change Requester" })).toBeNull();
  });

  it("shows an empty state when there are no active requesters", async () => {
    vi.mocked(api.fetchDevRequesters).mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText("No active development requesters are available.")).toBeTruthy();
    expect(screen.queryByLabelText("Development Requester")).toBeNull();
  });

  it("shows a manual retry after loading fails", async () => {
    vi.mocked(api.fetchDevRequesters).mockRejectedValueOnce(new Error("Network unavailable"));
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain("Network unavailable");
    expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false);
    vi.mocked(api.fetchDevRequesters).mockResolvedValue(requesters);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
  });

  it("clears stale context and explains why selection is required", async () => {
    sessionStorage.setItem("toktickit.requesterId", "99");
    vi.mocked(api.fetchDevRequesters).mockResolvedValue(requesters);
    render(<App />);
    expect(await screen.findByText(/no longer active/)).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("persists the selected requester and supports keyboard selection and switching", async () => {
    vi.mocked(api.fetchDevRequesters).mockResolvedValue(requesters);
    render(<App />);
    const select = await screen.findByLabelText("Development Requester");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);
    select.focus();
    fireEvent.change(select, { target: { value: "2" } });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(continueButton, { key: "Enter" });
    fireEvent.click(continueButton);
    expect(await screen.findByText("Grace Hopper")).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));
    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });
});