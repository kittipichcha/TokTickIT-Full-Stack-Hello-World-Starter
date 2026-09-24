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

/** The authenticated Administrator driving the screen (single source of truth). */
const ADMIN_USER: apiClient.AuthUser = {
  id: 3,
  name: "Alan Turing",
  email: "alan@example.com",
  role: "ADMINISTRATOR",
  mustChangePassword: false,
};

/** Renders the screen with the authenticated-user props it now requires. */
function renderAdmin(
  currentUser: apiClient.AuthUser = ADMIN_USER,
  onUserUpdated: (u: apiClient.AuthUser) => void = () => {},
) {
  return render(
    <AdminUserManagement currentUser={currentUser} onUserUpdated={onUserUpdated} />,
  );
}

describe("UI-ADM-01: User Management", () => {
  it("renders the user table with Name, Email, Role, and Status", async () => {
    renderAdmin();

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

    renderAdmin();
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

    renderAdmin();
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

    renderAdmin();
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

    renderAdmin();
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

    renderAdmin();
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

    renderAdmin();
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

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText("No users match your search.")).toBeTruthy();
    });
    // No error box.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends the search term to the API", async () => {
    renderAdmin();
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
    renderAdmin();
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

// ---------------------------------------------------------------------------
// UI-48-MODAL-01..04 — accessible modal behavior (review 48-B4, ui-spec.md §8)
//
// Each of the three Administrator dialogs must implement real modal keyboard
// behavior: initial focus, a Tab trap, a Shift+Tab trap, Escape-to-close with
// focus restoration, and no mutation on Escape/Cancel.
// ---------------------------------------------------------------------------

/** Opens a dialog via its invoking control and returns the dialog element. */
async function openDialog(
  invoke: () => Promise<void>,
  dialogName: string,
): Promise<HTMLElement> {
  await invoke();
  return screen.getByRole("dialog", { name: dialogName });
}

describe("UI-48-MODAL-01: Create User dialog keyboard behavior", () => {
  it("focuses the first control on open, traps Tab/Shift+Tab, and restores focus on Escape", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const trigger = screen.getByRole("button", { name: "Create User" });
    trigger.focus();
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Create User" });

    // Initial focus: the first focusable control inside the dialog.
    const nameInput = within(dialog).getByLabelText(/Name/);
    expect(document.activeElement).toBe(nameInput);

    // Shift+Tab from the first control wraps to the last.
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const last = focusables[focusables.length - 1];
    nameInput.focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);

    // Tab from the last control wraps back to the first.
    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(nameInput);

    // Escape closes the dialog and restores focus to the invoking control.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Create User" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape and Cancel never submit; only the submit control mutates", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    let dialog = screen.getByRole("dialog", { name: "Create User" });
    await userEvent.type(within(dialog).getByLabelText(/Name/), "New User");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "new@example.com");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "ValidPass123!xyz");

    // Escape: no mutation.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Create User" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ method: "POST" }),
    );

    // Cancel: no mutation.
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    dialog = screen.getByRole("dialog", { name: "Create User" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Create User" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ method: "POST" }),
    );

    // Confirm: exactly one mutation.
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    dialog = screen.getByRole("dialog", { name: "Create User" });
    await userEvent.type(within(dialog).getByLabelText(/Name/), "New User");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "new@example.com");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "ValidPass123!xyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create User" }));

    await waitFor(() => {
      const postCalls = vi
        .mocked(apiClient.apiJson)
        .mock.calls.filter(
          ([path, options]) =>
            path === "/api/admin/users" &&
            (options as { method?: string } | undefined)?.method === "POST",
        );
      expect(postCalls.length).toBe(1);
    });
  });
});

describe("UI-48-MODAL-02: Edit User dialog keyboard behavior", () => {
  it("focuses the first control on open, traps Tab/Shift+Tab, and restores focus on Escape", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    const trigger = within(row).getByRole("button", { name: "Edit" });
    trigger.focus();
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    const nameInput = within(dialog).getByLabelText(/Name/);
    expect(document.activeElement).toBe(nameInput);

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const last = focusables[focusables.length - 1];

    nameInput.focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(nameInput);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Edit User" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape and Cancel never submit; only the submit control mutates", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Edit User" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users/1",
      expect.objectContaining({ method: "PATCH" }),
    );

    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    let dialog = screen.getByRole("dialog", { name: "Edit User" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Edit User" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users/1",
      expect.objectContaining({ method: "PATCH" }),
    );

    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    dialog = screen.getByRole("dialog", { name: "Edit User" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      const patchCalls = vi
        .mocked(apiClient.apiJson)
        .mock.calls.filter(
          ([path, options]) =>
            path === "/api/admin/users/1" &&
            (options as { method?: string } | undefined)?.method === "PATCH",
        );
      expect(patchCalls.length).toBe(1);
    });
  });
});

describe("UI-48-MODAL-03: Reset Password dialog keyboard behavior", () => {
  it("focuses the first control on open, traps Tab/Shift+Tab, and restores focus on Escape", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    const trigger = within(row).getByRole("button", { name: "Reset Password" });
    trigger.focus();
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Reset Initial Password" });
    const passwordInput = within(dialog).getByLabelText(/New initial password/);
    expect(document.activeElement).toBe(passwordInput);

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const last = focusables[focusables.length - 1];

    passwordInput.focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(passwordInput);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Reset Initial Password" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape and Close never submit; only the submit control mutates", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Reset Password" }));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Reset Initial Password" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users/1/initial-password",
      expect.objectContaining({ method: "POST" }),
    );

    await userEvent.click(within(row).getByRole("button", { name: "Reset Password" }));
    let dialog = screen.getByRole("dialog", { name: "Reset Initial Password" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Reset Initial Password" })).toBeNull();
    expect(vi.mocked(apiClient.apiJson)).not.toHaveBeenCalledWith(
      "/api/admin/users/1/initial-password",
      expect.objectContaining({ method: "POST" }),
    );

    await userEvent.click(within(row).getByRole("button", { name: "Reset Password" }));
    dialog = screen.getByRole("dialog", { name: "Reset Initial Password" });
    await userEvent.type(within(dialog).getByLabelText(/New initial password/), "ResetPass123!xyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set Password" }));

    await waitFor(() => {
      const postCalls = vi
        .mocked(apiClient.apiJson)
        .mock.calls.filter(
          ([path, options]) =>
            path === "/api/admin/users/1/initial-password" &&
            (options as { method?: string } | undefined)?.method === "POST",
        );
      expect(postCalls.length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// UI-48-SELF-DEMOTION — authenticated identity refresh after self-demotion
// (review 48-B3)
//
// The backend permits a non-last Administrator to demote themselves. The client
// must then re-read `/api/auth/me` and publish the refreshed identity — never
// keep rendering Administrator navigation from a stale local role.
// ---------------------------------------------------------------------------

describe("UI-48-SELF-DEMOTION: self-demotion refreshes the authenticated identity", () => {
  it("refreshes /api/auth/me and publishes the new role when the admin edits self", async () => {
    const refreshed: apiClient.AuthUser = {
      ...ADMIN_USER,
      role: "IT_STAFF",
    };
    vi.mocked(apiClient.fetchMe).mockResolvedValue(refreshed);

    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") {
        return { data: { id: 3, name: "Alan Turing", email: "alan@example.com", role: "IT_STAFF", isActive: true } };
      }
      return { data: USERS };
    });

    const onUserUpdated = vi.fn();
    renderAdmin(ADMIN_USER, onUserUpdated);
    await waitFor(() => expect(screen.getByText("Alan Turing")).toBeTruthy());

    const row = screen.getByText("Alan Turing").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    await userEvent.selectOptions(within(dialog).getByLabelText(/Role/), "IT_STAFF");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    // The PATCH succeeds and the authenticated identity is re-read from the server.
    await waitFor(() => {
      expect(vi.mocked(apiClient.fetchMe)).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onUserUpdated).toHaveBeenCalledWith(refreshed);
    });
  });

  it("does not refresh the identity when editing another user", async () => {
    vi.mocked(apiClient.apiJson).mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") {
        return { data: { id: 1, name: "Ada Renamed", email: "ada@example.com", role: "REQUESTER", isActive: true } };
      }
      return { data: USERS };
    });

    const onUserUpdated = vi.fn();
    renderAdmin(ADMIN_USER, onUserUpdated);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());

    const row = screen.getByText("Ada Lovelace").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit User" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.apiJson)).toHaveBeenCalledWith(
        "/api/admin/users/1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(vi.mocked(apiClient.fetchMe)).not.toHaveBeenCalled();
    expect(onUserUpdated).not.toHaveBeenCalled();
  });
});