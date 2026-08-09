import { useState } from "react";
import "./App.css";
import { fetchCategories, type Category } from "./api";

interface HealthStatus {
  status: "ok" | "fail";
  error: string | null;
  service: string;
}

export default function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    setHealthStatus(null);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(new URL("/api/health", apiBaseUrl));

      const data: HealthStatus = await response.json();
      setHealthStatus(data);

      if (!response.ok || data.status === "fail") {
        setError(data.error || `Server returned ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to backend";
      setError(errorMessage);
      setHealthStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    setCategories(null);

    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load categories";
      setCategoriesError(errorMessage);
      setCategories(null);
    } finally {
      setCategoriesLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>TokTickIT Health Check</h1>
      
      <button onClick={checkHealth} disabled={loading}>
        {loading ? "Checking..." : "Check Backend Status"}
      </button>

      {healthStatus && (
        <div className={`status-box ${healthStatus.status}`}>
          <h2>Status: {healthStatus.status.toUpperCase()}</h2>
          <p>Service: {healthStatus.service}</p>
          {healthStatus.error && <p className="error-message">Error: {healthStatus.error}</p>}
        </div>
      )}

      {error && (
        <div className="error-box">
          <h2>⚠️ Connection Error</h2>
          <p>{error}</p>
          <p className="hint">Make sure the backend server is running on http://localhost:3000</p>
        </div>
      )}

      <hr style={{ margin: "2rem 0" }} />

      <h2>Categories</h2>
      <button onClick={loadCategories} disabled={categoriesLoading}>
        {categoriesLoading ? "Loading..." : "Load Categories"}
      </button>

      {categories && (
        <div className="categories-box">
          <h3>Available Categories</h3>
          {categories.length > 0 ? (
            <ul>
              {categories.map((category) => (
                <li key={category.id}>
                  <strong>ID {category.id}:</strong> {category.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>No categories found.</p>
          )}
        </div>
      )}

      {categoriesError && (
        <div className="error-box">
          <h2>⚠️ Failed to Load Categories</h2>
          <p>{categoriesError}</p>
        </div>
      )}
    </div>
  );
}
