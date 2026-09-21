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

/** Canonical client error shape: an Error carrying the HTTP status and canonical error fields. */
export type ApiError = Error & {
  status?: number;
  code?: string;
  fields?: Record<string, string>;
};

/**
 * Parses a canonical API error into an Error with `status`, `code`, and `fields`.
 *
 * This is ASYNC and must be awaited: the response body is read before the error is
 * returned, so callers observe the canonical `message`/`code`/`fields` immediately.
 * A non-JSON or empty body is tolerated — the fallback message and HTTP status are
 * preserved and no raw server internals are exposed.
 */
export async function parseApiError(response: Response, fallback: string): Promise<ApiError> {
  const err = new Error(fallback) as ApiError;
  err.status = response.status;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error?.message) err.message = body.error.message;
    if (body?.error?.code) err.code = body.error.code;
    if (body?.error?.fields) err.fields = body.error.fields;
  } catch {
    // Non-JSON / empty body: preserve the fallback message and the HTTP status.
  }

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
    throw await parseApiError(response, "Login failed.");
  }
  const payload = (await response.json()) as AuthResponse;
  return payload.data;
}

/** GET /api/auth/me — authenticated. Returns the current user. */
export async function fetchMe(): Promise<AuthUser> {
  const response = await request("/api/auth/me");
  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch current user.");
  }
  const payload = (await response.json()) as AuthResponse;
  return payload.data;
}

/** POST /api/auth/logout — authenticated + CSRF. */
export async function logout(): Promise<void> {
  const response = await request("/api/auth/logout", { method: "POST", includeCsrf: true });
  if (!response.ok) {
    throw await parseApiError(response, "Logout failed.");
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
    throw await parseApiError(response, "Password change failed.");
  }
}

/**
 * Shared credentialed transport for downstream feature APIs (#37/#38/#41).
 *
 * Every call sends `credentials: "include"` so the session cookie travels with
 * the request, and captures any `X-CSRF-Token` response header. State-changing
 * calls pass `includeCsrf: true` to echo the stored token.
 *
 * This is the ONLY token store in the client — feature modules must not build
 * their own.
 */
export async function apiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    includeCsrf?: boolean;
    /** When true, `body` is sent as-is (e.g. FormData) instead of JSON-encoded. */
    rawBody?: boolean;
    headers?: HeadersInit;
  } = {},
): Promise<Response> {
  const { method = "GET", body, includeCsrf = false, rawBody = false, headers } = options;

  const finalHeaders = new Headers(headers);
  if (!rawBody) finalHeaders.set("Content-Type", "application/json");
  if (includeCsrf) {
    const token = getCsrfToken();
    if (token) finalHeaders.set("X-CSRF-Token", token);
  }

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: finalHeaders,
  };
  if (body !== undefined) {
    init.body = rawBody ? (body as BodyInit) : JSON.stringify(body);
  }

  const response = await fetch(new URL(path, API_BASE_URL), init);
  captureCsrfToken(response);
  return response;
}

/** Credentialed JSON request that throws a canonical `ApiError` on failure. */
export async function apiJson<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    includeCsrf?: boolean;
    fallbackError?: string;
  } = {},
): Promise<T> {
  const { fallbackError = "Request failed." } = options;
  const response = await apiRequest(path, options);
  if (!response.ok) {
    throw await parseApiError(response, fallbackError);
  }
  return (await response.json()) as T;
}