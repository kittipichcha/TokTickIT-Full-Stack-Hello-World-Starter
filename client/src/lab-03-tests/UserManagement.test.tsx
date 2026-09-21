/**
 * Frozen Test-DD file: `client/src/lab-03-tests/UserManagement.test.tsx`
 *
 * Owned by Issue #41. Frozen rows executed here:
 *   - UI-ADM-01  User Management (list/search/filter/create/edit/activate)
 *   - UI-ADM-02  Admin user search zero results (empty-state message; no error)
 *
 * Rev 6 sub-assertion under UI-ADM-01 (BR-33): a duplicate-email-on-edit 409 leaves the
 * edit form values populated, shows the inline error, and does not reset/navigate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUserManagement from "../AdminUserManagement";
import * as apiClient from "../api-client";

vi.mock("../api-client");

const USERS = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com", role: "REQUESTER", isActive: true },
  { id: 2, name: "Grace Hopper", email: "grace@example.com", role: "IT_STAFF", isActive: false },
  { id: 3, name: "Alan Turing", email: "alan@example.com", role: "ADMINISTRATOR", isActive: true },
];

/** Builds a canonical ApiError carrying status/code/fields. */
function apiError(
  message: string,
  options: { status?: number; code?: string; fields?: Record<string, string> } = {},
): apiClient.ApiError {
  const err = new Error(message) as apiClient.ApiError;
  err.status = options.status ?? 400;
  err.code = options.code ?? "VALIDATION_ERROR";
  err.fields = options.fields;
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.apiJson).mockResolvedValue({ data: USERS });
});

afterEach(() => {
  cleanup();
});

describe("UI-ADM-01: User Management", () => {
  it("renders the user table with Name, Email, Role, and Status", async () => {
    render(<AdminUserManagement />);

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.getByText("Alan Turing")).toBeTruthy();

    // Role + status columns (scoped to the table — the filter select also has role labels).
    const table = screen.getByRole("table");
    expect(within(table).getByText("Requester")).toBeTruthy();
    expect(within(table).getByText("IT Staff")).toBeTruthy();
    expect(within(table).getByText("Administrator")).toBeTruthy();
    expect(within(table).getAllByText("Active").length).toBeGreaterThan(0);
    expect(within(table).getByText("Inactive")).toBeTruthy();

    // Column headers.
    for (const header of ["Name", "Email", "Role", "Status", "Edit"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
    }
  });

  it("creates a user through the Create User modal", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        return { data: { id: 4, name: "New User", email: "new@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true } };
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: "Create User" }));

    const dialog = screen.getByRole("dialog", { name: "Create User" });
    await userEvent.type(within(dialog).getByLabelText(/Name/), "New User");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "new@example.com");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "ValidPass123!xyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({
          method: "POST",
          includeCsrf: true,
          body: expect.objectContaining({
            name: "New User",
            email: "new@example.com",
            role: "REQUESTER",
            initialPassword: "ValidPass123!xyz",
          }),
        }),
      );
    });
  });

  it("edits a user through the Edit modal", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") {
        return { data: { id: 1, name: "Ada Renamed", email: "ada@example.com", role: "REQUESTER", isActive: true } };
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    const nameInput = within(dialog).getByLabelText(/Name/) as HTMLInputElement;
    expect(nameInput.value).toBe("Ada Lovelace");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Ada Renamed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users/1",
        expect.objectContaining({
          method: "PATCH",
          includeCsrf: true,
          body: expect.objectContaining({ name: "Ada Renamed" }),
        }),
      );
    });
  });

  it("resets a user's initial password through the Reset Password modal", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        return { data: { id: 1, mustChangePassword: true } };
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Reset Password" }));

    const dialog = screen.getByRole("dialog", { name: "Reset Initial Password" });
    await userEvent.type(within(dialog).getByLabelText(/New initial password/), "ResetPass123!xyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set Password" }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users/1/initial-password",
        expect.objectContaining({
          method: "POST",
          includeCsrf: true,
          body: { initialPassword: "ResetPass123!xyz" },
        }),
      );
    });
  });

  it("surfaces a duplicate-email 409 inline and preserves the entered form data (BR-33)", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") {
        throw apiError("A user with this email address already exists.", {
          status: 409,
          code: "CONFLICT",
        });
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    const emailInput = within(dialog).getByLabelText(/Email/) as HTMLInputElement;
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "grace@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    // Inline error displayed.
    await waitFor(() => {
      expect(screen.getByText("A user with this email address already exists.")).toBeTruthy();
    });

    // BR-33: the edit form remains open with the entered values preserved.
    const stillOpen = screen.getByRole("dialog", { name: "Edit User" });
    expect((within(stillOpen).getByLabelText(/Email/) as HTMLInputElement).value).toBe(
      "grace@example.com",
    );
    expect((within(stillOpen).getByLabelText(/Name/) as HTMLInputElement).value).toBe(
      "Ada Lovelace",
    );
  });

  it("surfaces a last-active-Administrator 409 inline without clearing the form", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") {
        throw apiError("The last active Administrator cannot be deactivated.", {
          status: 409,
          code: "CONFLICT",
        });
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Alan Turing")).toBeTruthy());

    const row = screen.getByText("Alan Turing").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    await userEvent.click(within(dialog).getByLabelText(/Active/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("The last active Administrator cannot be deactivated.")).toBeTruthy();
    });
    expect(screen.getByRole("dialog", { name: "Edit User" })).toBeTruthy();
  });

  it("surfaces field-level validation errors from the API payload", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        throw apiError("Validation failed.", {
          status: 400,
          code: "VALIDATION_ERROR",
          fields: { role: "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR." },
        });
      }
      return { data: USERS };
    });

    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    const dialog = screen.getByRole("dialog", { name: "Create User" });
    await userEvent.type(within(dialog).getByLabelText(/Name/), "Bad Role");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "bad@example.com");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "ValidPass123!xyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    await waitFor(() => {
      expect(
        screen.getByText("Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR."),
      ).toBeTruthy();
    });
  });
});

describe("UI-ADM-02: Admin user search zero results", () => {
  it("shows a clear no-results message rather than an error", async () => {
    vi.mocked(apiClient.apiJson).mockResolvedValue({ data: [] });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText("No users match your search.")).toBeTruthy();
    });
    // No error box.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends the search term to the API", async () => {
    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    await userEvent.type(screen.getByLabelText("Search users"), "grace");

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users?search=grace",
        expect.anything(),
      );
    });
  });

  it("sends the role filter to the API", async () => {
    render(<AdminUserManagement />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "IT_STAFF");

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users?role=IT_STAFF",
        expect.anything(),
      );
    });
  });
});