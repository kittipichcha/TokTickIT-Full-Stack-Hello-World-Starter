import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { disconnectPrisma } from "../../src/prisma.js";

describe("Requester Selection API - Real Database Connection", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  const itIfDb = process.env.DATABASE_URL ? it : it.skip;

  itIfDb("GET /api/dev-requesters returns only active requesters from actual database in expected shape and order", async () => {
    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);

    const requesters: Array<{ id: number; name: string; email: string }> = response.body.data;
    expect(requesters.length).toBeGreaterThan(0);

    // Verify all returned requesters have required properties
    requesters.forEach((req) => {
      expect(typeof req.id).toBe("number");
      expect(typeof req.name).toBe("string");
      expect(typeof req.email).toBe("string");
    });

    // Inactive requester 'Edsger Dijkstra' should NOT be returned
    const inactiveFound = requesters.some((req) => req.email === "edsger@example.com");
    expect(inactiveFound).toBe(false);

    // Verify ordering by name asc, id asc
    for (let i = 1; i < requesters.length; i++) {
      const prev = requesters[i - 1];
      const curr = requesters[i];
      const isOrdered =
        prev.name.localeCompare(curr.name) < 0 ||
        (prev.name === curr.name && prev.id <= curr.id);
      expect(isOrdered).toBe(true);
    }
  });

  itIfDb("GET /api/requester-context succeeds for active requester ID in database", async () => {
    // First fetch active requesters to get a real active ID
    const listRes = await request(app).get("/api/dev-requesters");
    expect(listRes.status).toBe(200);
    const activeRequester = listRes.body.data[0];

    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", String(activeRequester.id));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { requesterId: activeRequester.id },
    });
  });

  itIfDb("GET /api/requester-context returns 422 for nonexistent or inactive requester ID", async () => {
    // Non-existent ID
    const responseNonExistent = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "999999");

    expect(responseNonExistent.status).toBe(422);
    expect(responseNonExistent.body).toEqual({
      error: {
        code: "REQUESTER_CONTEXT_INVALID",
        message: "A valid active requester is required.",
      },
    });
  });

  itIfDb("GET /api/requester-context returns 422 for missing or invalid header", async () => {
    const responseMissing = await request(app).get("/api/requester-context");
    expect(responseMissing.status).toBe(422);
    expect(responseMissing.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");

    const responseInvalid = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "invalid-id");
    expect(responseInvalid.status).toBe(422);
    expect(responseInvalid.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });
});
