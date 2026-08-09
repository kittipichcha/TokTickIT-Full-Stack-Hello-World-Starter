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
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSystem = async () => {
    setLoading(true);
    setError(null);
    setHealthStatus(null);
    setCategories(null);

    try {
      // Check backend health
      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const healthResponse = await fetch(new URL("/api/health", apiBaseUrl));

      const healthData: HealthStatus = await healthResponse.json();
      setHealthStatus(healthData);

      if (!healthResponse.ok || healthData.status === "fail") {
        setError(healthData.error || `Server returned ${healthResponse.status}: ${healthResponse.statusText}`);
        return;
      }

      // Load categories
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check system";
      setError(errorMessage);
      setHealthStatus(null);
      setCategories(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>TokTickIT System Check</h1>
      
      <button onClick={checkSystem} disabled={loading}>
        {loading ? "Checking..." : "Check System"}
      </button>

      {healthStatus && (
        <div className={`status-box ${healthStatus.status}`}>
          <h2>Backend Status: {healthStatus.status.toUpperCase()}</h2>
          <p>Service: {healthStatus.service}</p>
          {healthStatus.error && <p className="error-message">Error: {healthStatus.error}</p>}
        </div>
      )}

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

      {error && (
        <div className="error-box">
          <h2>⚠️ System Check Failed</h2>
          <p>{error}</p>
          <p className="hint">Make sure the backend server is running on http://localhost:3000</p>
        </div>
      )}
    </div>
  );
}
