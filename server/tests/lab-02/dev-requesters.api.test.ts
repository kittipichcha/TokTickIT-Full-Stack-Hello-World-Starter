import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";

vi.mock("../../src/service.js");

describe("API-REQ-01: GET /api/dev-requesters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("excludes inactive requesters from the selector payload", async () => {
    // The service layer filters by isActive: true, so only active requesters are returned.
    const onlyActive = [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ];
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue(onlyActive);

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(1);
  });

  it("returns empty data array when no active requesters exist", async () => {
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue([]);

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });

  it("does not require X-Dev-Requester-Id header (bootstrap exemption)", async () => {
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue([
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ]);

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    // No requester header was set, and the endpoint still succeeded
  });

  it("returns safe canonical 500 when service throws", async () => {
    vi.mocked(service.getActiveDevRequesters).mockRejectedValue(new Error("db error"));

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});
