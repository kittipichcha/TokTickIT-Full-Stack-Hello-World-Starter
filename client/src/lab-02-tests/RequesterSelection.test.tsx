import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    vi.mocked(api.fetchRequesterContext).mockImplementation(async (id) => ({ requesterId: id }));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => []);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading and requires context before the application shell", () => {
    vi.mocked(api.fetchDevRequesters).mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByRole("status", { name: /loading active requesters/i })).toBeTruthy();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Change Requester" })).toBeNull();
  });

  it("shows an empty state when there are no active requesters", async () => {
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => []);
    render(<App />);
    expect(await screen.findByText("No active development requesters are available.")).toBeTruthy();
    expect(screen.queryByLabelText("Development Requester")).toBeNull();
  });

  it("shows a manual retry after loading fails", async () => {
    let callCount = 0;
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("Network unavailable");
      return requesters;
    });
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain("Network unavailable");
    expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
  });

  it("clears stale context and explains why selection is required", async () => {
    sessionStorage.setItem("toktickit.requesterId", "99");
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    render(<App />);
    expect(await screen.findByText(/no longer active/)).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("persists the selected requester and supports keyboard selection and switching", async () => {
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    render(<App />);
    const selects = await screen.findAllByLabelText("Development Requester");
    const select = selects[0];
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);
    select.focus();
    fireEvent.change(select, { target: { value: "2" } });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(continueButton, { key: "Enter" });
    fireEvent.click(continueButton);
    expect(await screen.findByText("Grace Hopper")).toBeTruthy();
    expect(api.fetchRequesterContext).toHaveBeenCalledWith(2);
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));
    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("keyboard-only Continue triggers selection with visible focus on dropdown and button", async () => {
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    render(<App />);

    const selects = (await screen.findAllByLabelText("Development Requester")) as HTMLSelectElement[];
    const select = selects[0];

    // Focus the dropdown and make a selection
    select.focus();
    expect(document.activeElement).toBe(select);

    fireEvent.change(select, { target: { value: "1" } });
    expect(select.value).toBe("1");

    // Tab to Continue button and activate with Enter (keyboard-only activation)
    await userEvent.tab();
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(document.activeElement).toBe(continueBtn);

    await userEvent.keyboard("{Enter}");

    // Assert on content that exists only after successful Continue — the application
    // shell "Change Requester" action — not on the requester name that is already
    // present as an <option> in the selector.
    expect(await screen.findByRole("button", { name: /change requester/i })).toBeTruthy();
    expect(screen.queryByLabelText("Development Requester")).toBeNull();
    expect(api.fetchRequesterContext).toHaveBeenCalledWith(1);
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("1");
  });

  it("activates Change Requester using only the keyboard and returns to the selector", async () => {
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    render(<App />);

    // Select a requester and reach the shell
    const selects = await screen.findAllByLabelText("Development Requester");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const changeButton = await screen.findByRole("button", { name: "Change Requester" });

    // Keyboard-navigate from the shell's start through the header focusable controls to
    // reach Change Requester, then activate it with Enter.
    await userEvent.tab(); // My Tickets link
    await userEvent.tab(); // Create Ticket link
    await userEvent.tab(); // Change Requester button
    expect(document.activeElement).toBe(changeButton);

    await userEvent.keyboard("{Enter}");

    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change Requester" })).toBeNull();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("shows an explanatory message when selected requester context is rejected", async () => {
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
    vi.mocked(api.fetchRequesterContext).mockRejectedValue(new Error("Requester inactive"));

    render(<App />);
    const selects = await screen.findAllByLabelText("Development Requester");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(/no longer active/i)).toBeTruthy();
    expect(screen.getByLabelText("Development Requester")).toBeTruthy();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });
});