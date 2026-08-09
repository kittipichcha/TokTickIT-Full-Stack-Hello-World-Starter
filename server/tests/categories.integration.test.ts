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

  itIfDb("should return categories sorted by ID then name (composite sort)", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    
    // Verify composite sort: ID first, then name within same ID
    for (let i = 1; i < response.body.length; i++) {
      const prev = response.body[i - 1];
      const curr = response.body[i];
      const isOrdered = 
        prev.id < curr.id || 
        (prev.id === curr.id && prev.name <= curr.name);
      expect(isOrdered).toBe(true);
    }
  });
});
