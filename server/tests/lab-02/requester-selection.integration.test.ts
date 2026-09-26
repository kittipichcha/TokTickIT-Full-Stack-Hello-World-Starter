/**
 * RR-04 class (b) — superseded Dev-Requester behavior, retired and replaced.
 *
 * Lab 2's requester-selection integration suite asserted the real-database behavior
 * of `GET /api/dev-requesters` and `GET /api/requester-context` — the Development
 * Requester selector's data source and validation endpoint. Lab 3 §8.2 removes the
 * selector and both endpoints, so those assertions describe obsolete behavior.
 *
 * Replacement assertions: the authenticated identity is established by a real login
 * against the real database, and the removed endpoints are gone.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { disconnectPrisma, getPrisma } from "../../src/prisma.js";
import { ensureAndLogin, withSession, type TestSession } from "../lab-03/helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const EMAIL = "requester-selection-retired@example.com";

let session: TestSession;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  session = await ensureAndLogin({ email: EMAIL, name: "Selection Retired", role: "REQUESTER" });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("Requester identity — real database, authenticated session", () => {
  itIfDb("a real login establishes the authenticated identity from the database", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user).toBeTruthy();

    const me = await withSession(request(app).get("/api/auth/me"), session);
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(user!.id);
    expect(me.body.data.role).toBe("REQUESTER");
  });

  itIfDb("the removed selector endpoint is no longer served", async () => {
    const response = await request(app).get("/api/dev-requesters");
    expect(response.status).toBe(404);
  });

  itIfDb("the removed requester-context endpoint is no longer served", async () => {
    const response = await request(app).get("/api/requester-context");
    expect(response.status).toBe(404);
  });

  itIfDb("the legacy header cannot establish identity", async () => {
    const response = await request(app)
      .get("/api/requester-context")
      .set("X-Dev-Requester-Id", "1");
    expect(response.status).toBe(404);
  });

  itIfDb("an inactive requester cannot authenticate", async () => {
    const prisma = getPrisma();
    const inactive = await prisma.user.findFirst({ where: { isActive: false, role: "REQUESTER" } });
    if (!inactive) return;

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: inactive.email, password: "TestPass123!xyz" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});