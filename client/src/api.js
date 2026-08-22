export async function checkHealth() {
    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(new URL("/api/health", apiBaseUrl));
    if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
export async function fetchCategories() {
    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(new URL("/api/categories", apiBaseUrl));
    if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
