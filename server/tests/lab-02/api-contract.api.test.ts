import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";
import { getRequesterIdFromHeaders } from "../../src/requester-context.js";

vi.mock("../../src/service.js");

describe("API-CONTRACT-01 requester context contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue([
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ]);
    vi.mocked(service.getCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);
  });

  it("returns active requesters in the documented envelope without a requester header", async () => {
    const activeRequesters = [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
      { id: 2, name: "Grace Hopper", email: "grace@example.com" },
    ];
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue(activeRequesters);

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: activeRequesters });
    expect(service.getActiveDevRequesters).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", undefined],
    ["malformed", "abc"],
    ["decimal", "1.0"],
    ["signed", "+1"],
  ])("returns canonical 422 for %s requester header", async (_label, value) => {
    const req = request(app).get("/api/requester-context");
    if (value !== undefined) req.set("X-Dev-Requester-Id", value);

    const response = await req;
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "REQUESTER_CONTEXT_INVALID",
        message: "A valid active requester is required.",
      },
    });
    expect(response.body).not.toHaveProperty("fields");
  });

  it("rejects whitespace-padded values before requester lookup", () => {
    const parsed = getRequesterIdFromHeaders({
      headers: { "x-dev-requester-id": " 1" },
    } as never);
    expect(parsed).toBeNull();
    expect(vi.mocked(service.isActiveDevRequester)).not.toHaveBeenCalled();
  });

  it("returns canonical 422 for duplicate requester header", async () => {
    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", ["1", "2"] as unknown as string);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it.each(["unknown", "inactive"])("returns canonical 422 for %s requester id", async () => {
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(false);

    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "9");

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("returns safe canonical 500 when requester lookup throws", async () => {
    vi.mocked(service.isActiveDevRequester).mockRejectedValue(new Error("db details"));

    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  it("allows a valid active requester through", async () => {
    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { requesterId: 1 } });
    expect(service.isActiveDevRequester).toHaveBeenCalledWith(1);
  });

  it("allows bootstrap endpoints without requester header", async () => {
    const requesters = await request(app).get("/api/dev-requesters");
    const categories = await request(app).get("/api/categories");

    expect(requesters.status).toBe(200);
    expect(requesters.body).toEqual({
      data: [{ id: 1, name: "Ada Lovelace", email: "ada@example.com" }],
    });
    expect(categories.status).toBe(200);
    expect(Array.isArray(categories.body)).toBe(true);
    expect(categories.body).toEqual([{ id: 1, name: "Hardware" }]);
  });
});
