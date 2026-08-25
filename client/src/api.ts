export interface Category {
  id: number;
  name: string;
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

export interface DevRequesterResponse {
  data: DevRequester[];
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface RelatedSystemResponse {
  data: RelatedSystem[];
}

export interface TicketResponse {
  data: {
    id: number;
    ticketNumber: string;
    requesterId: number;
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: string;
    itPriority: string | null;
    ticketOwnerId: number | null;
    currentStatus: string;
    createdAt: string;
    updatedAt: string;
  };
}

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

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

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/related-systems", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch related systems: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as RelatedSystemResponse;
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

export async function fetchRequesterContext(id: number): Promise<{ requesterId: number }> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/requester-context", apiBaseUrl), {
    headers: requesterHeaders(id),
  });
  if (!response.ok) throw new Error(`Failed to validate requester context: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { data: { requesterId: number } };
  return payload.data;
}

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
}

export async function createTicket(
  requesterId: number,
  payload: CreateTicketPayload,
): Promise<TicketResponse["data"]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/tickets", apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requesterHeaders(requesterId),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Failed to create ticket: ${response.status}`) as Error & { code?: string; fields?: Record<string, string> };
    err.code = body?.error?.code;
    err.fields = body?.error?.fields;
    throw err;
  }
  const result = (await response.json()) as TicketResponse;
  return result.data;
}
