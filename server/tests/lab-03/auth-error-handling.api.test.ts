import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";

// Deterministic test-only session secret (frozen §13 / Rev6 §4.5).
process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";
process.env.NODE_ENV = "test";

/**
 * API-AUTH-10..12: async handler failure containment.
 *
 * Express 4 does not catch rejected promises from async handlers, and this app has no
 * async wrapper. Before this fix, `login`, `logout`, and the rethrow in
 * `changePasswordHandler` let a rejected promise escape: the client received no response
 * and the process could exit. These tests force the underlying DB/session call to reject
 * and assert the canonical 500 JSON body is returned while the server stays up.
 *
 * `getPrisma` is mocked so the failure is injected deterministically without a real
 * database fault. The session store still uses a real PostgreSQL connection (via
 * `DATABASE_URL`), so the HTTP surface is exercised end to end.
 */

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");
const { logout } = await import("../../src/auth.controller.js");

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const KNOWN_PASSWORD = "KnownPass123!xyz";

interface FakeUser {
  id: number;
  name: string;
  email: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

function fakeUser(passwordHash: string): FakeUser {
  return {
    id: 1,
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "REQUESTER",
    passwordHash,
    isActive: true,
    mustChangePassword: false,
  };
}

/** Installs a mocked Prisma client whose `user` delegate behaves as configured. */
function installPrismaMock(overrides: {
  findUnique?: (args: unknown) => Promise<unknown>;
  update?: (args: unknown) => Promise<unknown>;
}): void {
  vi.mocked(getPrisma).mockReturnValue({
    user: {
      findUnique: vi.fn(overrides.findUnique ?? (async () => null)),
      update: vi.fn(overrides.update ?? (async () => ({}))),
    },
  } as unknown as ReturnType<typeof getPrisma>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.mocked(getPrisma).mockReset();
});

describe("API-AUTH-10..12: async auth handler failures return a canonical 500 and keep the process alive", () => {
  itIfDb(
    "API-AUTH-10: a DB failure during login returns 500 INTERNAL_ERROR and the server stays up",
    async () => {
      installPrismaMock({
        findUnique: async () => {
          throw new Error("connection terminated unexpectedly");
        },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: KNOWN_PASSWORD });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      });

      // The process is still serving requests: a validation failure (which never touches
      // the DB) is answered normally rather than hanging or crashing.
      const followUp = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-an-email", password: "" });
      expect(followUp.status).toBe(400);
      expect(followUp.body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  itIfDb(
    "API-AUTH-11: a DB failure during change-password returns 500 INTERNAL_ERROR and the server stays up",
    async () => {
      const hash = await bcrypt.hash(KNOWN_PASSWORD, 10);
      installPrismaMock({
        findUnique: async () => fakeUser(hash),
        update: async () => {
          throw new Error("connection terminated unexpectedly");
        },
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: KNOWN_PASSWORD });
      expect(login.status).toBe(200);

      const cookie = String(
        Array.isArray(login.headers["set-cookie"])
          ? login.headers["set-cookie"][0]
          : login.headers["set-cookie"],
      ).split(";")[0];
      const csrf = login.headers["x-csrf-token"] as string;

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrf)
        .send({ currentPassword: KNOWN_PASSWORD, newPassword: "BrandNew123!xyz" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      });

      // Still serving: an unauthenticated request is rejected normally.
      const followUp = await request(app).get("/api/auth/me");
      expect(followUp.status).toBe(401);
    },
  );

  it("API-AUTH-12: a session-store failure during logout returns 500 INTERNAL_ERROR", async () => {
    // Direct handler invocation: the session store is the only failure source here, and
    // forcing `session.destroy` to error through HTTP would require a real store fault.
    const destroyError = new Error("session store unavailable");
    const req = {
      session: {
        destroy: (cb: (err?: Error) => void) => cb(destroyError),
      },
    } as unknown as Parameters<typeof logout>[0];

    let statusCode = 0;
    let body: unknown = null;
    const res = {
      headersSent: false,
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Parameters<typeof logout>[1];

    await logout(req, res);

    expect(statusCode).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});
