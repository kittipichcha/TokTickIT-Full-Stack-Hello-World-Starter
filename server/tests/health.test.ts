import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Health Check Endpoint", () => {
  it("should return HTTP 200 with ok status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("error");
    expect(response.body).toHaveProperty("service");
    expect(response.body.status).toBe("ok");
    expect(response.body.error).toBeNull();
    expect(response.body.service).toBe("TokTickIT API");
  });

  it("should return HTTP 503 with fail status when health check fails", async () => {
    // Mock checkHealth to return failure
    vi.doMock("../src/app.js", () => ({
      app: {
        get: vi.fn(),
      },
    }), { virtual: true });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("error");
    expect(response.body).toHaveProperty("service");
    expect(response.body.status).toBe("fail");
    expect(response.body.error).not.toBeNull();
    expect(response.body.service).toBe("TokTickIT API");
  });
});
