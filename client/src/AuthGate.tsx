import { useEffect, useState } from "react";
import Login from "./Login";
import ChangePassword from "./ChangePassword";
import { fetchMe, logout, type ApiError, type AuthUser } from "./api-client";
import App from "./App";

type AuthState = "loading" | "login" | "change-password" | "authenticated" | "session-error";

/**
 * Authenticated shell gate (ui-spec §5.3).
 * - Not authenticated -> Login.
 * - mustChangePassword -> ChangePassword (user cannot reach normal screens until complete).
 * - Authenticated -> the application shell with the current user's name + role + Logout.
 * On success the same session proceeds.
 *
 * Logout failure (BR-33, AC-06): authenticated shell is preserved; an inline error is shown
 * near the Logout button. The client state is not cleared until the server confirms logout
 * succeeded — no silent false-success transition to the login screen.
 *
 * Mount-time session check: only a 401 means "not authenticated" -> Login. Any other failure
 * (network error, 5xx) is a session-verification failure, not an unauthenticated user, so it
 * renders a distinct error screen with an explicit Retry (no auto-retry, mirroring logout).
 */
export default function AuthGate() {
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  function loadSession() {
    setState("loading");
    setSessionError(null);
    void fetchMe()
      .then((u) => {
        setUser(u);
        setState(u.mustChangePassword ? "change-password" : "authenticated");
      })
      .catch((err) => {
        const status = err instanceof Error ? (err as ApiError).status : undefined;
        if (status === 401) {
          setState("login");
        } else {
          const message = err instanceof Error ? err.message : "Could not verify your session.";
          setSessionError(message);
          setState("session-error");
        }
      });
  }

  useEffect(() => {
    loadSession();
  }, []);

  function handleLogin(nextUser: AuthUser) {
    setUser(nextUser);
    setState(nextUser.mustChangePassword ? "change-password" : "authenticated");
  }

  function handlePasswordChanged() {
    setState("authenticated");
  }

  /**
   * Publishes a refreshed authenticated user (review 48-B3).
   *
   * After a successful self-demotion the server's `/api/auth/me` is the single
   * source of truth for the current identity. The refreshed user replaces the
   * cached one so role-specific navigation and view gating update immediately.
   */
  function handleUserUpdated(nextUser: AuthUser) {
    setUser(nextUser);
  }

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      setUser(null);
      setState("login");
    } catch (err) {
      // BR-33: preserve authenticated state on failure; show inline error; no auto-retry.
      const message = err instanceof Error ? err.message : "Logout failed.";
      setLogoutError(message);
    }
  }

  if (state === "loading") {
    return <div className="auth-screen" role="status">Loading…</div>;
  }

  if (state === "session-error") {
    return (
      <div className="auth-screen">
        <p role="alert">{sessionError}</p>
        <button type="button" onClick={loadSession}>Retry</button>
      </div>
    );
  }

  if (state === "login") {
    return <Login onLogin={handleLogin} />;
  }

  if (state === "change-password") {
    return <ChangePassword onChanged={handlePasswordChanged} />;
  }

  // Authenticated shell: wrap the application with the user identity + Logout.
  return (
    <div className="app-shell">
      <header className="app-header">
        <strong>TokTickIT</strong>
        <div className="identity">
          {user ? `${user.name} · ${user.role}` : ""}
          <button type="button" className="header-button" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
        {logoutError && (
          <p className="field-error" role="alert" style={{ margin: "4px 0 0", width: "100%" }}>
            {logoutError}
          </p>
        )}
      </header>
      {user && <App user={user} onUserUpdated={handleUserUpdated} />}
    </div>
  );
}