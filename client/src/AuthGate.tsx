import { useEffect, useState } from "react";
import Login from "./Login";
import ChangePassword from "./ChangePassword";
import { fetchMe, logout, type AuthUser } from "./api-client";
import App from "./App";

type AuthState = "loading" | "login" | "change-password" | "authenticated";

/**
 * Authenticated shell gate (ui-spec §5.3).
 * - Not authenticated -> Login.
 * - mustChangePassword -> ChangePassword (user cannot reach normal screens until complete).
 * - Authenticated -> the application shell with the current user's name + role + Logout.
 * On success the same session proceeds.
 */
export default function AuthGate() {
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMe()
      .then((u) => {
        setUser(u);
        setState(u.mustChangePassword ? "change-password" : "authenticated");
      })
      .catch(() => {
        setState("login");
      });
  }, []);

  function handleLogin(nextUser: AuthUser) {
    setUser(nextUser);
    setState(nextUser.mustChangePassword ? "change-password" : "authenticated");
  }

  function handlePasswordChanged() {
    setState("authenticated");
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setState("login");
    }
  }

  if (state === "loading") {
    return <div className="auth-screen" role="status">Loading…</div>;
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
      </header>
      <App />
    </div>
  );
}