/**
 * Shared client API transport (Issue #35 — Lab 3 auth).
 *
 * One credentialed, CSRF-aware transport for all downstream issues (#37/#38/#41).
 * - `credentials: "include"` on all calls (session cookie).
 * - Captures `X-CSRF-Token` from `login`/`me` responses.
 * - Echoes the CSRF token on every state-changing call.
 * - Central canonical-error parsing.
 *
 * Downstream issues consume this — they never build a second token store.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const CSRF_STORAGE_KEY = "toktickit.csrfToken";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  data: AuthUser;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

/** Parses a canonical API error into an Error with a `code` property. */
export function parseApiError(response: Response, fallback: string): Error & { code?: string; status?: number } {
  const err = new Error(fallback) as Error & { code?: string; status?: number };
  err.status = response.status;
  void response
    .json()
    .then((body: ApiErrorBody) => {
      if (body?.error?.message) err.message = body.error.message;
      if (body?.error?.code) err.code = body.error.code;
    })
    .catch(() => {});
  return err;
}

/** Reads the CSRF token from a response header and stores it. */
function captureCsrfToken(response: Response): void {
  const token = response.headers.get("X-CSRF-Token");
  if (token) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  }
}

/** Returns the stored CSRF token, if any. */
export function getCsrfToken(): string | null {
  return sessionStorage.getItem(CSRF_STORAGE_KEY);
}

/** Clears the stored CSRF token (e.g. on logout). */
export function clearCsrfToken(): void {
  sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

/** Builds headers for a request, optionally including the CSRF token for mutations. */
function buildHeaders(includeCsrf: boolean, extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json");
  if (includeCsrf) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

/** Performs a credentialed request with CSRF handling. */
async function request(
  path: string,
  options: { method?: string; body?: unknown; includeCsrf?: boolean } = {},
): Promise<Response> {
  const { method = "GET", body, includeCsrf = false } = options;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: buildHeaders(includeCsrf),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(new URL(path, API_BASE_URL), init);
  captureCsrfToken(response);
  return response;
}

/** POST /api/auth/login — public. Establishes the session and captures the CSRF token. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await request("/api/auth/login", { method: "POST", body: { email, password } });
  if (!response.ok) {
    throw parseApiError(response, "Login failed.");
  }
  const payload = (await response.json()) as AuthResponse;
  return payload.data;
}

/** GET /api/auth/me — authenticated. Returns the current user. */
export async function fetchMe(): Promise<AuthUser> {
  const response = await request("/api/auth/me");
  if (!response.ok) {
    throw parseApiError(response, "Failed to fetch current user.");
  }
  const payload = (await response.json()) as AuthResponse;
  return payload.data;
}

/** POST /api/auth/logout — authenticated + CSRF. */
export async function logout(): Promise<void> {
  const response = await request("/api/auth/logout", { method: "POST", includeCsrf: true });
  if (!response.ok) {
    throw parseApiError(response, "Logout failed.");
  }
  clearCsrfToken();
}

/** POST /api/auth/change-password — authenticated + CSRF. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await request("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
    includeCsrf: true,
  });
  if (!response.ok) {
    throw parseApiError(response, "Password change failed.");
  }
}