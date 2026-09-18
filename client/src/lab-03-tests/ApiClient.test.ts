import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseApiError } from "../api-client";

/**
 * UNIT-API-ERROR-01/02/03 — canonical API error parsing (PR #46 review follow-up).
 *
 * The parser must be awaited so the caller observes the canonical `message`/`code`/`fields`
 * IMMEDIATELY. These tests deliberately do NOT use `await Promise.resolve()` or a retry:
 * if the parser returned before reading the body, the assertions below would fail.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("UNIT-API-ERROR-01: canonical JSON error is parsed synchronously from the caller's view", () => {
  it("exposes status, code, message, and fields immediately after await", async () => {
    const response = jsonResponse(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid password",
        fields: { password: "Password is too short." },
      },
    });

    const err = await parseApiError(response, "Fallback message.");

    // No microtask flush / retry: the values must already be present.
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid password");
    expect(err.fields).toEqual({ password: "Password is too short." });
  });

  it("preserves the canonical code through a real caller (login) without a second tick", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: { code: "VALIDATION_ERROR", message: "Invalid password", fields: { password: "Too short." } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { login } = await import("../api-client");
    let caught: unknown;
    try {
      await login("ada@example.com", "wrong");
    } catch (e) {
      caught = e;
    }

    const err = caught as { status?: number; code?: string; message?: string; fields?: Record<string, string> };
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid password");
    expect(err.fields).toEqual({ password: "Too short." });
  });
});

describe("UNIT-API-ERROR-02: malformed / non-JSON body falls back safely", () => {
  it("preserves the fallback message and the HTTP status when the body is not JSON", async () => {
    const response = new Response("<html>Internal Server Error</html>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });

    const err = await parseApiError(response, "Something went wrong.");

    expect(err.status).toBe(500);
    expect(err.message).toBe("Something went wrong.");
    expect(err.code).toBeUndefined();
    expect(err.fields).toBeUndefined();
  });

  it("does not throw when the body is empty", async () => {
    const response = new Response("", { status: 502 });

    const err = await parseApiError(response, "Bad gateway.");

    expect(err.status).toBe(502);
    expect(err.message).toBe("Bad gateway.");
  });
});

describe("UNIT-API-ERROR-03: 500 response produces a safe error", () => {
  it("uses the canonical message when present and never leaks raw internals", async () => {
    const response = jsonResponse(500, {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });

    const err = await parseApiError(response, "Server error.");

    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("An unexpected error occurred.");
  });

  it("falls back to the safe generic message when a 500 has no canonical body", async () => {
    const response = new Response("", { status: 500 });

    const err = await parseApiError(response, "Server error.");

    expect(err.status).toBe(500);
    expect(err.message).toBe("Server error.");
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});
