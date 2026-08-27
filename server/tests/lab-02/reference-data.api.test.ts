import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";

vi.mock("../../src/service.js");

describe("API-REF-01: GET /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active categories with raw array shape (no data envelope)", async () => {
    const activeCategories = [
      { id: 1, name: "Hardware" },
      { id: 2, name: "Software" },
    ];
    vi.mocked(service.getCategories).mockResolvedValue(activeCategories);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(activeCategories);
    expect(response.body).not.toHaveProperty("data");
  });

  it("does not require X-Dev-Requester-Id header", async () => {
    vi.mocked(service.getCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
  });

  it("returns safe 500 on service failure", async () => {
    vi.mocked(service.getCategories).mockRejectedValue(new Error("db error"));

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});

describe("API-REF-02: GET /api/related-systems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active related systems with { data: [...] } envelope", async () => {
    const activeSystems = [
      { id: 1, name: "Corporate Laptop" },
      { id: 2, name: "Campus Wi-Fi" },
    ];
    vi.mocked(service.getActiveRelatedSystems).mockResolvedValue(activeSystems);

    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: activeSystems });
  });

  it("does not require X-Dev-Requester-Id header (bootstrap exemption)", async () => {
    vi.mocked(service.getActiveRelatedSystems).mockResolvedValue([
      { id: 1, name: "Corporate Laptop" },
    ]);

    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
  });

  it("returns empty data array when no active related systems exist", async () => {
    vi.mocked(service.getActiveRelatedSystems).mockResolvedValue([]);

    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });

  it("returns safe 500 on service failure", async () => {
    vi.mocked(service.getActiveRelatedSystems).mockRejectedValue(new Error("db error"));

    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});