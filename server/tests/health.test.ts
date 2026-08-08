import { describe, it, expect } from "vitest";
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
});
