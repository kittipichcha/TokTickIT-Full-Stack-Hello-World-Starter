import { useState } from "react";
import { login } from "./api-client";

interface LoginProps {
  onLogin: (user: { id: number; name: string; email: string; role: string; mustChangePassword: boolean }) => void;
}

/**
 * Login screen (ui-spec §5.1).
 * - Email and password fields with labels.
 * - Login button (primary), busy state while in flight.
 * - Inline validation errors below fields.
 * - Safe generic failure for invalid credentials or inactive account.
 * - BR-33: entered values are preserved on failed login (never cleared on API failure).
 */
export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err) {
      // Safe generic failure — do not reveal whether the email or password was wrong.
      setFormError("Login failed. Please check your credentials and try again.");
      // BR-33: entered values remain in the form after a failed attempt.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="page-title">Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-email">
            Email <span className="required-asterisk" aria-hidden="true">*</span>
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldErrors.email ? "field-invalid" : ""}
            aria-invalid={fieldErrors.email ? "true" : undefined}
          />
          {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="login-password">
            Password <span className="required-asterisk" aria-hidden="true">*</span>
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldErrors.password ? "field-invalid" : ""}
            aria-invalid={fieldErrors.password ? "true" : undefined}
          />
          {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
        </div>

        {formError && <div className="error-box" role="alert">{formError}</div>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "Submitting…" : "Login"}
        </button>
      </form>
    </div>
  );
}