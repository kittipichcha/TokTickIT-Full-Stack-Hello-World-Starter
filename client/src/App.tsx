import { useState } from "react";
import "./App.css";
import { checkHealth, fetchCategories, type Category } from "./api";

export default function App() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  const checkSystem = async () => {
    setLoading(true);
    setError(null);
    setHealthStatus(null);
    setCategories(null);

    try {
      // First check system health
      const health = await checkHealth();
      if (health.status === "ok") {
        setHealthStatus("✓ Connection successful");
        // Then load categories
        const categoriesData = await fetchCategories();
        setCategories(categoriesData);
      } else {
        throw new Error("System health check failed");
      }
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
      <h1>TokTickIT Categories</h1>
      
      <button onClick={checkSystem} disabled={loading}>
        {loading ? "Checking..." : "Check System"}
      </button>

      {healthStatus && (
        <div className="health-box">
          <p>{healthStatus}</p>
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
          <h2>⚠️ Failed to Load Categories</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
