import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { disconnectPrisma } from "../src/prisma.js";

describe("Categories API - Real Database Connection", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  const itIfDb = process.env.DATABASE_URL ? it : it.skip;

  itIfDb("should return 200 with all categories in ascending order by ID", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  itIfDb("should return categories with id and name fields", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    response.body.forEach((category: { id: unknown; name: unknown }) => {
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    });
  });

  itIfDb("should return categories sorted by ID in ascending order", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    const ids = response.body.map((cat: { id: number }) => cat.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sortedIds);
  });
});
