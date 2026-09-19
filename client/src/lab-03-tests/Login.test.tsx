import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../Login";
import * as apiClient from "../api-client";

vi.mock("../api-client");

const validUser = {
  id: 1,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "REQUESTER",
  mustChangePassword: true,
};

describe("UI-LOGIN-01: Login screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("valid login calls onLogin with the authenticated user", async () => {
    vi.mocked(apiClient.login).mockResolvedValue(validUser);
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "Lab3-18ea620d20bd6a06d667");
    await userEvent.click(screen.getByRole("button", { name: /Login/ }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(validUser));
  });

  it("invalid login shows a safe generic failure and preserves entered values (BR-33)", async () => {
    vi.mocked(apiClient.login).mockRejectedValue(new Error("Login failed."));
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /Login/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    // BR-33: entered values remain in the form after a failed attempt.
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).value).toBe("ada@example.com");
    expect((screen.getByLabelText(/Password/) as HTMLInputElement).value).toBe("wrong-password");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows a busy state while the login request is in flight", async () => {
    let resolveLogin: (u: typeof validUser) => void;
    vi.mocked(apiClient.login).mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "Lab3-18ea620d20bd6a06d667");
    await userEvent.click(screen.getByRole("button", { name: /Login/ }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Submitting/ }) as HTMLButtonElement).disabled).toBe(true);
    });

    resolveLogin!(validUser);
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(validUser));
  });

  it("shows inline validation errors for empty fields", async () => {
    render(<Login onLogin={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Login/ }));

    await waitFor(() => {
      expect(screen.getByText("Email is required.")).toBeTruthy();
      expect(screen.getByText("Password is required.")).toBeTruthy();
    });
  });
});