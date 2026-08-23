export interface Category {
  id: number;
  name: string;
}

export interface HealthCheckResponse {
  status: "ok" | "fail";
  service: string;
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

interface DevRequesterResponse {
  data: DevRequester[];
}

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

export async function checkHealth(): Promise<HealthCheckResponse> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/health", apiBaseUrl));
  if (!response.ok) throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/categories", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchDevRequesters(): Promise<DevRequester[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/dev-requesters", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch requesters: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as DevRequesterResponse;
  return payload.data;
}

export function getStoredRequesterId(): number | null {
  const stored = sessionStorage.getItem(REQUESTER_STORAGE_KEY);
  return stored && /^[1-9][0-9]*$/.test(stored) ? Number(stored) : null;
}

export function setStoredRequesterId(id: number): void {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(id));
}

export function clearStoredRequesterId(): void {
  sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
}

export function requesterHeaders(id: number): HeadersInit {
  return { "X-Dev-Requester-Id": String(id) };
}
