import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import { REQUESTER_STORAGE_KEY } from "../api";

// Integration test for Requester Selection UI + sessionStorage + real api.ts exports (unmocked api helper methods)
describe("Requester Selection Integration Test - UI & Storage Persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Intercept global fetch so UI can test component flow deterministically without external backend running on port 3000
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const urlString = typeof input === "string" ? input : input.toString();

      if (urlString.includes("/api/dev-requesters")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
              { id: 2, name: "Grace Hopper", email: "grace@example.com" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (urlString.includes("/api/requester-context")) {
        return new Response(
          JSON.stringify({ data: { requesterId: 1 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (urlString.includes("/api/tickets")) {
        return new Response(
          JSON.stringify({
            data: [],
            pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("verifies REQUESTER_STORAGE_KEY constant is defined as 'toktickit.requesterId'", () => {
    expect(REQUESTER_STORAGE_KEY).toBe("toktickit.requesterId");
  });

  it("integrates UI requester selection with actual sessionStorage using REQUESTER_STORAGE_KEY", async () => {
    render(<App />);

    // 1. Selector dropdown loads active requesters
    const select = (await screen.findByLabelText("Development Requester")) as HTMLSelectElement;
    expect(select).toBeTruthy();

    const continueBtn = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    // 2. Select Ada Lovelace (id=1)
    fireEvent.change(select, { target: { value: "1" } });
    expect(continueBtn.disabled).toBe(false);

    // 3. Click Continue -> validates context and saves to sessionStorage
    fireEvent.click(continueBtn);

    // 4. Verify Active Requester is rendered in shell header
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();

    // 5. Verify actual sessionStorage entry matches REQUESTER_STORAGE_KEY
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe("1");

    // 6. Click 'Change Requester' button -> clears sessionStorage and returns to selector
    const changeBtn = screen.getByRole("button", { name: "Change Requester" });
    fireEvent.click(changeBtn);

    expect(await screen.findByLabelText("Development Requester")).toBeTruthy();
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
  });
});
