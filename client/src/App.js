import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import "./App.css";
import { checkHealth, fetchCategories } from "./api";
export default function App() {
    const [categories, setCategories] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [healthStatus, setHealthStatus] = useState(null);
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
            }
            else {
                throw new Error(health.service ? `System health check failed: ${health.service}` : "System health check failed");
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to check system";
            setError(errorMessage);
            setHealthStatus(null);
            setCategories(null);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "app-container", children: [_jsx("h1", { children: "TokTickIT Categories" }), _jsx("button", { onClick: checkSystem, disabled: loading, children: loading ? "Checking..." : "Check System" }), healthStatus && (_jsx("div", { className: "health-box", children: _jsx("p", { children: healthStatus }) })), categories && (_jsxs("div", { className: "categories-box", children: [_jsx("h3", { children: "Available Categories" }), categories.length > 0 ? (_jsx("ul", { children: categories.map((category) => (_jsxs("li", { children: [_jsxs("strong", { children: ["ID ", category.id, ":"] }), " ", category.name] }, category.id))) })) : (_jsx("p", { children: "No categories found." }))] })), error && (_jsxs("div", { className: "error-box", children: [_jsx("h2", { children: "\u26A0\uFE0F Failed to Load Categories" }), _jsx("p", { children: error })] }))] }));
}
