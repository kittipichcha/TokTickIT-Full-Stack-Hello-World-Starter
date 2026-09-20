/**
 * RR-04 class (b) — superseded Dev-Requester behavior, retired and replaced.
 *
 * Lab 2's requester-selection suites drove the Development Requester selector,
 * asserted the `X-Dev-Requester-Id` header on the requester-context request, and
 * verified the `toktickit.requesterId` sessionStorage key. Lab 3 §8.2 removes the
 * selector, the header, and the storage key entirely, so those assertions describe
 * obsolete behavior — not regressions.
 *
 * Replacement assertions: the authenticated identity comes from the session and is
 * passed into the application shell; no selector, header, or requester storage key
 * remains.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../App";
import * as api from "../api";
import { TEST_USER } from "./helpers/user";

vi.mock("../api");

describe("Authenticated identity replaces the Development Requester selector", () => {
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

  it("renders the application shell directly for the authenticated user", async () => {
    render(<App user={TEST_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThan(0);
  });

  it("does not render the Development Requester selector", () => {
    render(<App user={TEST_USER} />);

    expect(screen.queryByRole("combobox", { name: /development requester/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("does not render a Change Requester action", () => {
    render(<App user={TEST_USER} />);

    expect(screen.queryByRole("button", { name: /change requester/i })).toBeNull();
  });

  it("does not expose the removed requester storage key", () => {
    // The Lab 2 `toktickit.requesterId` sessionStorage key is gone with the selector.
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("does not call the removed requester endpoints", () => {
    render(<App user={TEST_USER} />);

    // The removed helpers no longer exist on the api module.
    expect((api as Record<string, unknown>).fetchDevRequesters).toBeUndefined();
    expect((api as Record<string, unknown>).fetchRequesterContext).toBeUndefined();
    expect((api as Record<string, unknown>).getStoredRequesterId).toBeUndefined();
    expect((api as Record<string, unknown>).requesterHeaders).toBeUndefined();
  });
});