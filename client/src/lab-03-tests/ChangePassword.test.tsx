import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePassword from "../ChangePassword";
import * as apiClient from "../api-client";

vi.mock("../api-client");

const VALID_NEW_PASSWORD = "NewPass123!xyz";

describe("UI-CHPWD-01: Mandatory Change Password screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("successfully changes the password and continues on the same session", async () => {
    vi.mocked(apiClient.changePassword).mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<ChangePassword onChanged={onChanged} />);

    await userEvent.type(screen.getByLabelText(/Current password/), "Lab3-18ea620d20bd6a06d667");
    await userEvent.type(screen.getByLabelText(/New password/), VALID_NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText(/Confirm new password/), VALID_NEW_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: /Change password/ }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(apiClient.changePassword).toHaveBeenCalledWith("Lab3-18ea620d20bd6a06d667", VALID_NEW_PASSWORD);
  });

  it("enforces the password policy client-side", async () => {
    render(<ChangePassword onChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Current password/), "old-password");
    await userEvent.type(screen.getByLabelText(/New password/), "short");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "short");
    await userEvent.click(screen.getByRole("button", { name: /Change password/ }));

    await waitFor(() => {
      expect(screen.getByText(/at least 12 characters/)).toBeTruthy();
    });
    expect(apiClient.changePassword).not.toHaveBeenCalled();
  });
});

describe("UI-CHPWD-02: confirm-new-password mismatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an inline mismatch error; the form is NOT submitted and the API is NEVER called", async () => {
    render(<ChangePassword onChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Current password/), "Lab3-18ea620d20bd6a06d667");
    await userEvent.type(screen.getByLabelText(/New password/), VALID_NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "Different123!");
    await userEvent.click(screen.getByRole("button", { name: /Change password/ }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    });
    // UI-CHPWD-02: form not submitted; API never called.
    expect(apiClient.changePassword).not.toHaveBeenCalled();
  });
});