/**
 * RR-04 class (b) — superseded Dev-Requester behavior, retired and replaced.
 *
 * Lab 2's `GET /api/dev-requesters` was the Development Requester selector's data
 * source, and `GET /api/requester-context` validated the selected requester. Lab 3
 * §8.2 removes the selector and both endpoints entirely, so the former assertions
 * about their payload shape and header parsing are obsolete behavior — not
 * regressions.
 *
 * Replacement assertions: the legacy endpoints are gone, the legacy header no
 * longer authorizes anything, and the authenticated reference-data surface is
 * what remains.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { disconnectPrisma } from "../../src/prisma.js";
import { ensureAndLogin, withSession, type TestSession } from "../lab-03/helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const EMAIL = "dev-requesters-retired@example.com";

let session: TestSession;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  session = await ensureAndLogin({ email: EMAIL, name: "Retired Selector", role: "REQUESTER" });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("RR-01: the Development Requester selector surface is removed", () => {
  itIfDb("GET /api/dev-requesters is no longer a registered route", async () => {
    const res = await withSession(request(app).get("/api/dev-requesters"), session);
    // The route is gone: Express falls through to the terminal 404 handler.
    expect(res.status).toBe(404);
  });

  itIfDb("GET /api/requester-context is no longer a registered route", async () => {
    const res = await withSession(request(app).get("/api/requester-context"), session);
    expect(res.status).toBe(404);
  });

  itIfDb("the legacy header no longer grants access to any protected route", async () => {
    // A request carrying only the removed header (no session) must be rejected.
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("the legacy header cannot substitute for a session on a shared read", async () => {
    const res = await request(app)
      .get("/api/tickets/TKT-2026-000001")
      .set("X-Dev-Requester-Id", "1");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  itIfDb("authenticated reference data is served instead", async () => {
    const categories = await withSession(request(app).get("/api/categories"), session);
    expect(categories.status).toBe(200);

    const systems = await withSession(request(app).get("/api/related-systems"), session);
    expect(systems.status).toBe(200);
  });
});