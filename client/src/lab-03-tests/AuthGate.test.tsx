import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthGate from "../AuthGate";
import * as apiClient from "../api-client";

/**
 * AuthGate.test.tsx — UI-AUTHGATE-01/02
 *
 * Tests the authenticated shell gate's logout behavior per (FR-03, BR-09, BR-33, AC-06):
 * - On logout failure: authenticated shell is preserved, user state is NOT cleared,
 *   and an inline error is visible (no silent false-success transition).
 * - On logout success: state transitions to Login.
 */

// Mock the whole api-client module (login, fetchMe, logout, etc.)
vi.mock("../api-client");

// Mock the downstream App component to avoid rendering its full dependency tree.
vi.mock("../App", () => ({
  default: () => <div data-testid="app-stub">App</div>,
}));

const AUTHENTICATED_USER: apiClient.AuthUser = {
  id: 1,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

describe("UI-AUTHGATE-01: logout failure preserves authenticated shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fetchMe resolves: user is authenticated, no password change required.
    vi.mocked(apiClient.fetchMe).mockResolvedValue(AUTHENTICATED_USER);
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the authenticated shell and shows an inline error when logout fails", async () => {
    vi.mocked(apiClient.logout).mockRejectedValue(new Error("Network error"));

    render(<AuthGate />);

    // Wait for the authenticated shell to appear (fetchMe resolved)
    const logoutBtn = await screen.findByRole("button", { name: /Logout/i });
    expect(logoutBtn).toBeTruthy();

    // Click Logout — will fail
    await userEvent.click(logoutBtn);

    // Inline error must appear near the Logout button
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Network error");

    // Logout button still rendered — shell not replaced by Login
    expect(screen.queryByRole("button", { name: /Logout/i })).toBeTruthy();

    // App stub still mounted — user is still authenticated
    expect(screen.queryByTestId("app-stub")).toBeTruthy();
  });
});

describe("UI-AUTHGATE-02: successful logout transitions to Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchMe).mockResolvedValue(AUTHENTICATED_USER);
  });

  afterEach(() => {
    cleanup();
  });

  it("transitions to the Login screen when logout succeeds", async () => {
    vi.mocked(apiClient.logout).mockResolvedValue(undefined);

    render(<AuthGate />);

    // Wait for authenticated shell
    const logoutBtn = await screen.findByRole("button", { name: /Logout/i });
    expect(logoutBtn).toBeTruthy();

    // Logout succeeds
    await userEvent.click(logoutBtn);

    // The Login screen should now be rendered (contains an email input)
    const emailInput = await screen.findByLabelText(/Email/i);
    expect(emailInput).toBeTruthy();

    // App stub no longer mounted
    expect(screen.queryByTestId("app-stub")).toBeNull();

    // No error alert should appear
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("UI-AUTHGATE-03: mount-time session-check failure is distinct from unauthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Login when fetchMe rejects with 401", async () => {
    const err = new Error("Unauthenticated") as apiClient.ApiError;
    err.status = 401;
    vi.mocked(apiClient.fetchMe).mockRejectedValue(err);

    render(<AuthGate />);

    const emailInput = await screen.findByLabelText(/Email/i);
    expect(emailInput).toBeTruthy();
    expect(screen.queryByTestId("app-stub")).toBeNull();
  });

  it("renders a session-error screen with Retry (not Login) when fetchMe rejects with 500", async () => {
    const err = new Error("Server exploded") as apiClient.ApiError;
    err.status = 500;
    vi.mocked(apiClient.fetchMe).mockRejectedValue(err);

    render(<AuthGate />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Server exploded");
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();

    // Neither the authenticated shell nor the Login screen is shown.
    expect(screen.queryByTestId("app-stub")).toBeNull();
    expect(screen.queryByLabelText(/Email/i)).toBeNull();
  });

  it("renders a session-error screen when fetchMe rejects without a status (network failure)", async () => {
    vi.mocked(apiClient.fetchMe).mockRejectedValue(new Error("Network error"));

    render(<AuthGate />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Network error");
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
    expect(screen.queryByLabelText(/Email/i)).toBeNull();
  });

  it("transitions to authenticated when Retry succeeds after a 500", async () => {
    const err = new Error("Server exploded") as apiClient.ApiError;
    err.status = 500;
    vi.mocked(apiClient.fetchMe).mockRejectedValueOnce(err);

    render(<AuthGate />);

    const retry = await screen.findByRole("button", { name: /Retry/i });

    // The retry now succeeds.
    vi.mocked(apiClient.fetchMe).mockResolvedValue(AUTHENTICATED_USER);
    await userEvent.click(retry);

    await waitFor(() => {
      expect(screen.queryByTestId("app-stub")).toBeTruthy();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
