export interface Category {
  id: number;
  name: string;
}

export async function fetchCategories(): Promise<Category[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/categories", apiBaseUrl));

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

