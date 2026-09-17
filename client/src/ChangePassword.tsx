import { useState } from "react";
import { changePassword } from "./api-client";

interface ChangePasswordProps {
  onChanged: () => void;
}

const SPECIAL_CHARS = `!@#$%^&*()-_=+[]{};:,.?/\\`;

/** Client-side password policy check (mirrors the frozen §13 decision 12 policy). */
function policyError(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one digit.";
  if (!password.split("").some((c) => SPECIAL_CHARS.includes(c))) {
    return "Password must contain at least one special character.";
  }
  return null;
}

/**
 * Mandatory Change Password screen (ui-spec §5.2).
 * - Current password, new password, confirm new password fields.
 * - Client-side policy enforcement; user cannot reach normal screens until complete.
 * - UI-CHPWD-02: confirm field mismatch -> inline error; form NOT submitted; API NEVER called.
 * - On success the same session proceeds.
 */
export default function ChangePassword({ onChanged }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (!currentPassword) {
      errors.currentPassword = "Current password is required.";
    }
    const policy = policyError(newPassword);
    if (policy) {
      errors.newPassword = policy;
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!validate()) return; // UI-CHPWD-02: mismatch -> no submit, API never called

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password change failed.";
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="page-title">Change your password</h1>
      <p className="auth-hint">
        You must change your password before continuing. Use 12–128 characters with at least one
        uppercase letter, one lowercase letter, one digit, and one special character.
      </p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="chpwd-current">
            Current password <span className="required-asterisk" aria-hidden="true">*</span>
          </label>
          <input
            id="chpwd-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldErrors.currentPassword ? "field-invalid" : ""}
            aria-invalid={fieldErrors.currentPassword ? "true" : undefined}
          />
          {fieldErrors.currentPassword && <p className="field-error">{fieldErrors.currentPassword}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="chpwd-new">
            New password <span className="required-asterisk" aria-hidden="true">*</span>
          </label>
          <input
            id="chpwd-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={fieldErrors.newPassword ? "field-invalid" : ""}
            aria-invalid={fieldErrors.newPassword ? "true" : undefined}
          />
          {fieldErrors.newPassword && <p className="field-error">{fieldErrors.newPassword}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="chpwd-confirm">
            Confirm new password <span className="required-asterisk" aria-hidden="true">*</span>
          </label>
          <input
            id="chpwd-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldErrors.confirmPassword ? "field-invalid" : ""}
            aria-invalid={fieldErrors.confirmPassword ? "true" : undefined}
          />
          {fieldErrors.confirmPassword && <p className="field-error">{fieldErrors.confirmPassword}</p>}
        </div>

        {formError && <div className="error-box" role="alert">{formError}</div>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "Submitting…" : "Change password"}
        </button>
      </form>
    </div>
  );
}