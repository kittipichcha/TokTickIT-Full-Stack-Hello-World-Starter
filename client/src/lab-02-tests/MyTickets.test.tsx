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

describe("UI-MY-03 requester switch behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(api.fetchDevRequesters)
      .mockResolvedValueOnce(requesterSetA)
      .mockResolvedValueOnce(requesterSetB);
    vi.mocked(api.fetchRequesterContext).mockImplementation(async (id) => ({ requesterId: id }));
    vi.mocked(api.checkHealth).mockResolvedValue({ status: "ok", service: "TokTickIT API" });
    vi.mocked(api.fetchCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);

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

    const select = await screen.findByLabelText("Development Requester");
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Ada Lovelace");

    fireEvent.click(screen.getByRole("button", { name: "Check System" }));
    await screen.findByText("Available Categories");
    expect(screen.getByText("Hardware")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    await screen.findByLabelText("Development Requester");
    expect(screen.queryByText("Available Categories")).toBeNull();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();

    const selectAfterChange = screen.getByLabelText("Development Requester");
    fireEvent.change(selectAfterChange, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Alan Turing");
    await waitFor(() => {
      expect(vi.mocked(api.fetchDevRequesters)).toHaveBeenCalledTimes(2);
    });
  });
});
