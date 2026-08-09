import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import * as service from "../src/service.js";

vi.mock("../src/service.js");

describe("Health Check Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return HTTP 200 with ok status", async () => {
    vi.mocked(service.checkHealth).mockResolvedValue({
      status: "ok",
      service: "TokTickIT API",
    });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("service");
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("TokTickIT API");
  });

  it("should return HTTP 503 with fail status when health check fails", async () => {
    vi.mocked(service.checkHealth).mockResolvedValue({
      status: "fail",
      service: "TokTickIT API",
    });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("service");
    expect(response.body.status).toBe("fail");
    expect(response.body.service).toBe("TokTickIT API");
  });
});
