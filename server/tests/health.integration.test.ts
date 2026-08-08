import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";

describe("Health Check - Real Database Connection", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  const itIfDb = process.env.DATABASE_URL ? it : it.skip;

  itIfDb("should return 200 when database is connected", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.error).toBeNull();
    expect(response.body.service).toBe("TokTickIT API");
  });
});
