import { useState } from "react";
import "./App.css";
import { fetchCategories, type Category } from "./api";

export default function App() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    setCategories(null);

    try {
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load categories";
      setError(errorMessage);
      setCategories(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>TokTickIT Categories</h1>
      
      <button onClick={loadCategories} disabled={loading}>
        {loading ? "Loading..." : "Load Categories"}
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

      {error && (
        <div className="error-box">
          <h2>⚠️ Failed to Load Categories</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
