/**
 * Administrator User Management screen (Issue #41 — ui-spec §5.8).
 *
 * Surface:
 *   - User table: Name, Email, Role, Status, Edit.
 *   - Search by name/email; optional role filter.
 *   - Create User modal (name, email, one role, activation state, initial password).
 *   - Per-row Edit and Reset Password actions.
 *   - Inline validation for every safety-rule error surfaced from the API error payload.
 *   - BR-33: entered form data is preserved on API failure (never silently cleared).
 *
 * All mutations go through #35's shared `api-client.ts` transport
 * (`credentials: "include"` + `X-CSRF-Token`) — no second token store here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, type ApiError, type AuthUser } from "./api-client";
import Modal from "./Modal";

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

interface AdminUserListResponse {
  data: AdminUser[];
}

interface AdminUserCreateResponse {
  data: AdminUser & { mustChangePassword: boolean };
}

interface InitialPasswordResponse {
  data: { id: number; mustChangePassword: boolean };
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMINISTRATOR", label: "Administrator" },
];

const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

/** Extracts the canonical field-level errors from an API failure. */
function fieldErrorsOf(err: unknown): Record<string, string> {
  const apiErr = err as ApiError;
  return apiErr?.fields ?? {};
}

/** Extracts a safe, user-facing message from an API failure. */
function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface UserFormState {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  role: "REQUESTER",
  isActive: true,
  initialPassword: "",
};

interface AdminUserManagementProps {
  /**
   * The current authenticated user (single source of truth, owned by AuthGate).
   * Used to detect a self-edit so the authenticated identity can be refreshed
   * after a successful role change (review 48-B3).
   */
  currentUser: AuthUser;
  /**
   * Publishes a refreshed authenticated user back to the shared session state.
   * The component never mutates a local copy of the authenticated role.
   */
  onUserUpdated: (user: AuthUser) => void;
}

export default function AdminUserManagement({
  currentUser,
  onUserUpdated,
}: AdminUserManagementProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // Reset-password modal
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetFieldErrors, setResetFieldErrors] = useState<Record<string, string>>({});
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const requestSeqRef = useRef(0);

  const loadUsers = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      const query = params.toString();
      const result = await apiJson<AdminUserListResponse>(
        `/api/admin/users${query ? `?${query}` : ""}`,
        { fallbackError: "Failed to load users." },
      );
      if (seq !== requestSeqRef.current) return;
      setUsers(result.data);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setLoadError(messageOf(err, "Failed to load users."));
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // ---- Create ----

  function openCreate() {
    setMutationSuccess(null);
    setCreateForm(EMPTY_FORM);
    setCreateFieldErrors({});
    setCreateError(null);
    setCreateOpen(true);
  }

  async function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (createBusy) return;
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateBusy(true);
    try {
      await apiJson<AdminUserCreateResponse>("/api/admin/users", {
        method: "POST",
        includeCsrf: true,
        fallbackError: "Failed to create user.",
        body: {
          name: createForm.name,
          email: createForm.email,
          role: createForm.role,
          isActive: createForm.isActive,
          initialPassword: createForm.initialPassword,
        },
      });
      setMutationSuccess("User created successfully.");
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await loadUsers();
    } catch (err) {
      // BR-33: preserve the entered form data; show the error inline.
      setCreateFieldErrors(fieldErrorsOf(err));
      setCreateError(messageOf(err, "Failed to create user."));
    } finally {
      setCreateBusy(false);
    }
  }

  // ---- Edit ----

  function openEdit(user: AdminUser) {
    setMutationSuccess(null);
    setEditTarget(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      initialPassword: "",
    });
    setEditFieldErrors({});
    setEditError(null);
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editBusy || !editTarget) return;
    setEditError(null);
    setEditFieldErrors({});
    setEditBusy(true);
    try {
      const result = await apiJson<{ data: AdminUser }>(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        includeCsrf: true,
        fallbackError: "Failed to update user.",
        body: {
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          isActive: editForm.isActive,
        },
      });

      const editedSelf = editTarget.id === currentUser.id;
      if (editedSelf) {
        onUserUpdated({
          ...currentUser,
          id: result.data.id,
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
        });
      }

      setMutationSuccess("User updated successfully.");
      setEditTarget(null);
      await loadUsers();
    } catch (err) {
      // BR-33: the edit form values remain populated; the error is shown inline.
      setEditFieldErrors(fieldErrorsOf(err));
      setEditError(messageOf(err, "Failed to update user."));
    } finally {
      setEditBusy(false);
    }
  }

  // ---- Reset initial password ----

  function openReset(user: AdminUser) {
    setResetTarget(user);
    setResetPassword("");
    setResetFieldErrors({});
    setResetError(null);
    setResetSuccess(null);
  }

  async function submitReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (resetBusy || !resetTarget) return;
    setResetError(null);
    setResetSuccess(null);
    setResetFieldErrors({});
    setResetBusy(true);
    try {
      await apiJson<InitialPasswordResponse>(
        `/api/admin/users/${resetTarget.id}/initial-password`,
        {
          method: "POST",
          includeCsrf: true,
          fallbackError: "Failed to reset password.",
          body: { initialPassword: resetPassword },
        },
      );
      if (resetTarget.id === currentUser.id) {
        onUserUpdated({ ...currentUser, mustChangePassword: true });
      }
      setResetSuccess("Initial password set. The user must change it at next login.");
      setResetPassword("");
    } catch (err) {
      // BR-33: preserve the entered password value; show the error inline.
      setResetFieldErrors(fieldErrorsOf(err));
      setResetError(messageOf(err, "Failed to reset password."));
    } finally {
      setResetBusy(false);
    }
  }

  const noResults = !loading && !loadError && users.length === 0;

  return (
    <main className="app-container my-tickets">
      <h1 className="page-title">User Management</h1>
      {mutationSuccess && <p className="admin-user-success" role="status">{mutationSuccess}</p>}

      <div className="my-tickets-toolbar">
        <div className="toolbar-filters">
          <div className="toolbar-search">
            <label htmlFor="admin-user-search" className="visually-hidden">
              Search users
            </label>
            <input
              id="admin-user-search"
              type="search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label htmlFor="admin-role-filter" className="visually-hidden">
            Filter by role
          </label>
          <select
            id="admin-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary-button" onClick={openCreate}>
          Create User
        </button>
      </div>

      {loading && (
        <div role="status" aria-label="Loading users">
          <div className="skeleton-select" />
          <div className="skeleton-select" />
          <div className="skeleton-select" />
        </div>
      )}

      {loadError && !loading && (
        <div className="error-box" role="alert">
          <p>{loadError}</p>
          <div className="error-actions">
            <button type="button" className="secondary-button" onClick={() => void loadUsers()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {noResults && (
        <p className="empty-state" role="status">
          No users match your search.
        </p>
      )}

      {!loading && !loadError && users.length > 0 && (
        <div className="tickets-table-wrapper desktop-only admin-users-desktop">
          <table className="tickets-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Edit</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">{u.name}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Role">
                    <span className="role-badge">{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td data-label="Status">
                    <span className={u.isActive ? "status-active" : "status-inactive"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <button type="button" className="tertiary-button" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    <button type="button" className="tertiary-button" onClick={() => openReset(u)}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && users.length > 0 && (
        <div className="tickets-cards mobile-only admin-user-cards" aria-label="Users">
          {users.map((u) => (
            <article className="ticket-card admin-user-card" key={u.id}>
              <h2 className="admin-user-card-name">{u.name}</h2>
              <dl className="admin-user-card-fields">
                <div>
                  <dt>Email</dt>
                  <dd>{u.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd><span className="role-badge">{ROLE_LABELS[u.role]}</span></dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={u.isActive ? "status-active" : "status-inactive"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="admin-user-card-actions">
                <button type="button" className="tertiary-button" onClick={() => openEdit(u)}>
                  Edit
                </button>
                <button type="button" className="tertiary-button" onClick={() => openReset(u)}>
                  Reset Password
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ---- Create User modal ---- */}
      {createOpen && (
        <Modal labelledBy="create-user-title" onClose={() => setCreateOpen(false)} busy={createBusy}>
            <h2 id="create-user-title">Create User</h2>
            <form onSubmit={submitCreate} noValidate>
              <div className="form-field">
                <label htmlFor="create-name">
                  Name <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={createFieldErrors.name ? "field-invalid" : ""}
                  aria-invalid={createFieldErrors.name ? "true" : undefined}
                  aria-describedby={createFieldErrors.name ? "create-name-error" : undefined}
                />
                {createFieldErrors.name && (
                  <p className="field-error" id="create-name-error">
                    {createFieldErrors.name}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="create-email">
                  Email <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className={createFieldErrors.email ? "field-invalid" : ""}
                  aria-invalid={createFieldErrors.email ? "true" : undefined}
                  aria-describedby={createFieldErrors.email ? "create-email-error" : undefined}
                />
                {createFieldErrors.email && (
                  <p className="field-error" id="create-email-error">
                    {createFieldErrors.email}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="create-role">
                  Role <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <select
                  id="create-role"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                  className={createFieldErrors.role ? "field-invalid" : ""}
                  aria-invalid={createFieldErrors.role ? "true" : undefined}
                  aria-describedby={createFieldErrors.role ? "create-role-error" : undefined}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {createFieldErrors.role && (
                  <p className="field-error" id="create-role-error">
                    {createFieldErrors.role}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="create-active">
                  <input
                    id="create-active"
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  />{" "}
                  Active
                </label>
              </div>

              <div className="form-field">
                <label htmlFor="create-password">
                  Initial password <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  value={createForm.initialPassword}
                  onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                  className={createFieldErrors.initialPassword ? "field-invalid" : ""}
                  aria-invalid={createFieldErrors.initialPassword ? "true" : undefined}
                  aria-describedby={
                    createFieldErrors.initialPassword ? "create-password-error" : undefined
                  }
                />
                {createFieldErrors.initialPassword && (
                  <p className="field-error" id="create-password-error">
                    {createFieldErrors.initialPassword}
                  </p>
                )}
              </div>

              {createError && (
                <p className="field-error" role="alert">
                  {createError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={createBusy}>
                  {createBusy ? "Creating…" : "Create User"}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* ---- Edit User modal ---- */}
      {editTarget && (
        <Modal labelledBy="edit-user-title" onClose={() => setEditTarget(null)} busy={editBusy}>
            <h2 id="edit-user-title">Edit User</h2>
            <form onSubmit={submitEdit} noValidate>
              <div className="form-field">
                <label htmlFor="edit-name">
                  Name <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={editFieldErrors.name ? "field-invalid" : ""}
                  aria-invalid={editFieldErrors.name ? "true" : undefined}
                  aria-describedby={editFieldErrors.name ? "edit-name-error" : undefined}
                />
                {editFieldErrors.name && (
                  <p className="field-error" id="edit-name-error">
                    {editFieldErrors.name}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="edit-email">
                  Email <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={editFieldErrors.email ? "field-invalid" : ""}
                  aria-invalid={editFieldErrors.email ? "true" : undefined}
                  aria-describedby={editFieldErrors.email ? "edit-email-error" : undefined}
                />
                {editFieldErrors.email && (
                  <p className="field-error" id="edit-email-error">
                    {editFieldErrors.email}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="edit-role">
                  Role <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className={editFieldErrors.role ? "field-invalid" : ""}
                  aria-invalid={editFieldErrors.role ? "true" : undefined}
                  aria-describedby={editFieldErrors.role ? "edit-role-error" : undefined}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {editFieldErrors.role && (
                  <p className="field-error" id="edit-role-error">
                    {editFieldErrors.role}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="edit-active">
                  <input
                    id="edit-active"
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  />{" "}
                  Active
                </label>
              </div>

              {editError && (
                <p className="field-error" role="alert">
                  {editError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditTarget(null)}
                  disabled={editBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* ---- Reset Password modal ---- */}
      {resetTarget && (
        <Modal labelledBy="reset-password-title" onClose={() => setResetTarget(null)} busy={resetBusy}>
            <h2 id="reset-password-title">Reset Initial Password</h2>
            <p>
              Set a new initial password for <strong>{resetTarget.name}</strong>. The user must
              change it at next login.
            </p>
            <form onSubmit={submitReset} noValidate>
              <div className="form-field">
                <label htmlFor="reset-password">
                  New initial password <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className={resetFieldErrors.initialPassword ? "field-invalid" : ""}
                  aria-invalid={resetFieldErrors.initialPassword ? "true" : undefined}
                  aria-describedby={
                    resetFieldErrors.initialPassword ? "reset-password-error" : undefined
                  }
                />
                {resetFieldErrors.initialPassword && (
                  <p className="field-error" id="reset-password-error">
                    {resetFieldErrors.initialPassword}
                  </p>
                )}
              </div>

              {resetError && (
                <p className="field-error" role="alert">
                  {resetError}
                </p>
              )}
              {resetSuccess && (
                <p className="notice" role="status">
                  {resetSuccess}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setResetTarget(null)}
                  disabled={resetBusy}
                >
                  Close
                </button>
                <button type="submit" className="primary-button" disabled={resetBusy}>
                  {resetBusy ? "Saving…" : "Set Password"}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </main>
  );
}
