import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import * as api from "../api";

vi.mock("../api");

const requesterSetA = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];

const requesterSetB = [
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
  { id: 3, name: "Alan Turing", email: "alan@example.com" },
];

const ticketsForAda = {
  data: [{ ticketNumber: "TKT-2026-000001", summary: "Ada's ticket" }],
  pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
};

const ticketsForAlan = {
  data: [{ ticketNumber: "TKT-2026-000002", summary: "Alan's ticket" }],
  pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
};

describe("UI-MY-03 requester switch behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(api.fetchDevRequesters)
      .mockResolvedValueOnce(requesterSetA)
      .mockResolvedValueOnce(requesterSetB);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async (id) => ({ requesterId: id }));
    vi.mocked(api.fetchCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.mocked(api.fetchMyTickets)
      .mockResolvedValueOnce(ticketsForAda)
      .mockResolvedValueOnce(ticketsForAlan);

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

  it("clears prior requester data and reloads from new requester scope", async () => {
    render(<App />);

    // Select Ada Lovelace (id=1) and continue
    const select = await screen.findByLabelText("Development Requester");
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Ada Lovelace");

    // Verify Ada's tickets were fetched with her requester ID
    await waitFor(() => {
      expect(vi.mocked(api.fetchMyTickets)).toHaveBeenCalledWith(1);
    });

    // Switch requester
    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    // Verify old requester context is cleared
    await screen.findByLabelText("Development Requester");
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();

    // Select Alan Turing (id=3) and continue
    const selectAfterChange = screen.getByLabelText("Development Requester");
    fireEvent.change(selectAfterChange, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Alan Turing");

    // Verify Alan's tickets were fetched with his requester ID (new scope)
    await waitFor(() => {
      expect(vi.mocked(api.fetchMyTickets)).toHaveBeenCalledWith(3);
    });

    // Verify fetchDevRequesters was called twice (initial load + after change)
    expect(vi.mocked(api.fetchDevRequesters)).toHaveBeenCalledTimes(2);
  });
});
