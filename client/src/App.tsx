import { useEffect, useState } from "react";
import "./App.css";
import {
  checkHealth,
  clearStoredRequesterId,
  fetchCategories,
  fetchDevRequesters,
  fetchRequesterContext,
  getStoredRequesterId,
  setStoredRequesterId,
  type Category,
  type DevRequester,
} from "./api";

type SelectorState = "loading" | "ready" | "empty" | "error";

export default function App() {
  const [requesters, setRequesters] = useState<DevRequester[]>([]);
  const [selectorState, setSelectorState] = useState<SelectorState>("loading");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeRequester, setActiveRequester] = useState<DevRequester | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  const loadRequesters = async () => {
    setSelectorState("loading");
    setMessage(null);
    try {
      const data = await fetchDevRequesters();
      setRequesters(data);
      const storedId = getStoredRequesterId();
      const storedRequester = data.find((requester) => requester.id === storedId);
      if (storedId !== null && !storedRequester) {
        clearStoredRequesterId();
        setMessage("Your saved requester is no longer active. Please select an active requester.");
      }
      if (storedRequester) {
        setActiveRequester(storedRequester);
        setSelectedId(storedRequester.id);
      }
      setSelectorState(data.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setSelectorState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load requesters.");
    }
  };

  useEffect(() => {
    void loadRequesters();
  }, []);

  const continueToApp = async () => {
    const requester = requesters.find((candidate) => candidate.id === selectedId);
    if (!requester) return;

    try {
      await fetchRequesterContext(requester.id);
      setStoredRequesterId(requester.id);
      setActiveRequester(requester);
      setMessage(null);
      setError(null);
    } catch {
      clearStoredRequesterId();
      setActiveRequester(null);
      setSelectedId(null);
      setMessage("Selected requester is no longer active. Please select an active requester.");
      setError(null);
      setSelectorState("ready");
    }
  };

  const changeRequester = () => {
    clearStoredRequesterId();
    setActiveRequester(null);
    setSelectedId(null);
    setCategories(null);
    setHealthStatus(null);
    setError(null);
    void loadRequesters();
  };

  const checkSystem = async () => {
    setLoading(true);
    setError(null);
    setHealthStatus(null);
    setCategories(null);
    try {
      const health = await checkHealth();
      if (health.status !== "ok") throw new Error("System health check failed");
      setHealthStatus("Connection successful");
      setCategories(await fetchCategories());
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Failed to check system");
    } finally {
      setLoading(false);
    }
  };

  if (!activeRequester) {
    return (
      <main className="app-container selector-screen">
        <p className="eyebrow">TokTickIT</p>
        <h1>Choose a Development Requester</h1>
        <p className="testing-note">For Lab 2 testing only, not a login screen.</p>
        {message && <p className="notice" role="status">{message}</p>}
        {selectorState === "loading" && (
          <div className="selector-form" role="status" aria-label="Loading active requesters">
            <label htmlFor="requester">Development Requester</label>
            <div className="skeleton-select" aria-hidden="true" />
            <button className="primary-button" disabled>Continue</button>
          </div>
        )}
        {selectorState === "error" && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button className="secondary-button" onClick={() => void loadRequesters()}>Retry</button>
          </div>
        )}
        {selectorState === "empty" && <p className="empty-state">No active development requesters are available.</p>}
        {selectorState === "ready" && (
          <div className="selector-form">
            <label htmlFor="requester">Development Requester</label>
            <select
              id="requester"
              value={selectedId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedId(value ? Number(value) : null);
              }}
            >
              <option value="">Select a requester</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              disabled={selectedId === null || !requesters.some((r) => r.id === selectedId)}
              onClick={() => void continueToApp()}
            >
              Continue
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <strong>TokTickIT</strong>
        <nav aria-label="Primary"><a href="#my-tickets">My Tickets</a><a href="#create-ticket">Create Ticket</a></nav>
        <div className="identity">{activeRequester.name}<button className="header-button" onClick={changeRequester}>Change Requester</button></div>
      </header>
      <main className="app-container">
        <h1>System Overview</h1>
        <button className="primary-button" onClick={() => void checkSystem()} disabled={loading}>{loading ? "Checking..." : "Check System"}</button>
        {healthStatus && <div className="health-box" role="status"><p>{healthStatus}</p></div>}
        {categories && (
          <div className="categories-box">
            <h2>Available Categories</h2>
            {categories.length > 0 ? (
              <ul>
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            ) : (
              <p>No categories found.</p>
            )}
          </div>
        )}
        {error && <div className="error-box" role="alert"><p>{error}</p></div>}
      </main>
    </div>
  );
}
