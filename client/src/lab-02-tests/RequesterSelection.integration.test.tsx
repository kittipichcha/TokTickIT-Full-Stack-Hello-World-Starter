/**
 * RR-04 class (b) — superseded Dev-Requester behavior, retired and replaced.
 *
 * Lab 2's requester-selection integration suite intercepted `fetch` to assert the
 * selector flow, the `X-Dev-Requester-Id` header on the requester-context request,
 * and the `toktickit.requesterId` sessionStorage key. Lab 3 §8.2 removes all three.
 *
 * Replacement assertions: the application shell renders for the authenticated user
 * and every request it makes is credentialed (session cookie) rather than
 * header-identified.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { TEST_USER } from "./helpers/user";

describe("Authenticated transport replaces header-identified requests", () => {
  let capturedRequests: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    capturedRequests = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlString = typeof input === "string" ? input : input.toString();
      capturedRequests.push({ url: urlString, init });

      if (urlString.includes("/api/categories")) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlString.includes("/api/tickets")) {
        return new Response(
          JSON.stringify({
            data: [],
            pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not Found", { status: 404 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the shell and issues credentialed requests without the legacy header", async () => {
    render(<App user={TEST_USER} />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0);
    });

    for (const request of capturedRequests) {
      // Every request is credentialed (session cookie travels with it).
      expect(request.init?.credentials).toBe("include");
      // No request carries the removed identity header.
      const headers = new Headers(request.init?.headers);
      expect(headers.get("X-Dev-Requester-Id")).toBeNull();
    }
  });

  it("never requests the removed requester endpoints", async () => {
    render(<App user={TEST_USER} />);

    await screen.findByText("TokTickIT");
    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0);
    });

    const urls = capturedRequests.map((r) => r.url);
    expect(urls.some((u) => u.includes("/api/dev-requesters"))).toBe(false);
    expect(urls.some((u) => u.includes("/api/requester-context"))).toBe(false);
  });
});