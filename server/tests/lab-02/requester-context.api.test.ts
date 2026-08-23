import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, requireDevRequesterContext } from "../../src/app.js";
import * as service from "../../src/service.js";

vi.mock("../../src/service.js");

function protectedApp() {
  const testApp = express();
  testApp.get("/protected", requireDevRequesterContext, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return testApp;
}

describe("requester context contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it.each([
    ["missing", undefined],
    ["malformed", "abc"],
    ["decimal", "1.0"],
    ["signed", "+1"],
    ["unknown", "99"],
    ["inactive", "2"],
  ])("rejects %s requester context with canonical 422", async (label, value) => {
    if (label === "unknown" || label === "inactive") {
      vi.mocked(service.isActiveDevRequester).mockResolvedValue(false);
    }
    const testRequest = request(protectedApp()).get("/protected");
    if (value !== undefined) testRequest.set("X-Dev-Requester-Id", value);
    const response = await testRequest;
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "REQUESTER_CONTEXT_INVALID",
        message: "A valid active requester is required.",
      },
    });
  });

  it("rejects duplicate requester headers", async () => {
    const response = await request(protectedApp())
      .get("/protected")
      .set("X-Dev-Requester-Id", ["1", "2"] as unknown as string);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("rejects whitespace-padded values before requester lookup", () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireDevRequesterContext(
      { headers: { "x-dev-requester-id": " 1" } } as never,
      response as never,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a valid active requester through", async () => {
    const response = await request(protectedApp()).get("/protected").set("X-Dev-Requester-Id", "1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(service.isActiveDevRequester).toHaveBeenCalledWith(1);
  });
});

describe("API-REQ-03: Bootstrap endpoints", () => {
  it("GET /api/dev-requesters works without X-Dev-Requester-Id header", async () => {
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue([
      { id: 1, name: "Test Requester", email: "test@example.com" },
    ]);

    const response = await request(app).get("/api/dev-requesters");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: 1, name: "Test Requester", email: "test@example.com" }],
    });
  });

  it("GET /api/categories works without X-Dev-Requester-Id header", async () => {
    vi.mocked(service.getCategories).mockResolvedValue([
      { id: 1, name: "Hardware" },
    ]);

    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual([{ id: 1, name: "Hardware" }]);
  });
});
