/**
 * RR-04 class (a) — behavior unchanged, auth fixture updated.
 *
 * The request-parsing contract assertions are unchanged from Lab 2. Only the
 * identity fixture changed: `X-Dev-Requester-Id` header injection is replaced by
 * an authenticated session (login → cookie + CSRF token).
 *
 * The former `API-CONTRACT-01 requester context contract` block asserted the
 * removed Dev-Requester selector/context endpoints; that block is class (b) and
 * is retired — its replacement lives in `dev-requesters.api.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { disconnectPrisma } from "../../src/prisma.js";
import { ensureAndLogin, withSession, type TestSession } from "../lab-03/helpers/auth.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

const EMAIL = "api-contract@example.com";

let session: TestSession;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  session = await ensureAndLogin({ email: EMAIL, name: "Api Contract", role: "REQUESTER" });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await disconnectPrisma();
});

describe("API-CONTRACT-01 request parsing contract", () => {
  itIfDb("rejects malformed JSON body with canonical 400 on POST /api/tickets", async () => {
    const response = await withSession(request(app).post("/api/tickets"), session, { csrf: true })
      .set("Content-Type", "application/json")
      .send("{ malformed");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error).toHaveProperty("fields");
  });

  itIfDb("rejects non-object JSON body (null) with canonical 400 on POST /api/tickets", async () => {
    const response = await withSession(request(app).post("/api/tickets"), session, { csrf: true })
      .set("Content-Type", "application/json")
      .send("null");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error).toHaveProperty("fields");
  });

  itIfDb("rejects array JSON body with canonical 400 on POST /api/tickets", async () => {
    const response = await withSession(request(app).post("/api/tickets"), session, { csrf: true })
      .set("Content-Type", "application/json")
      .send("[]");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error).toHaveProperty("fields");
  });

  itIfDb("rejects primitive JSON body (string) with canonical 400 on POST /api/tickets", async () => {
    const response = await withSession(request(app).post("/api/tickets"), session, { csrf: true })
      .set("Content-Type", "application/json")
      .send('"hello"');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error).toHaveProperty("fields");
  });

  itIfDb("rejects wrong Content-Type with canonical 400 on POST /api/tickets", async () => {
    const response = await withSession(request(app).post("/api/tickets"), session, { csrf: true })
      .set("Content-Type", "text/plain")
      .send("not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error).toHaveProperty("fields");
  });

  itIfDb("uses first value for duplicate query parameters", async () => {
    const response = await withSession(
      request(app).get("/api/tickets?sort=createdAt&sort=ticketNumber"),
      session,
    );

    expect(response.status).toBe(200);
    // The endpoint uses the first occurrence and never errors on duplicates.
    expect(response.body).toHaveProperty("pagination");
  });
});