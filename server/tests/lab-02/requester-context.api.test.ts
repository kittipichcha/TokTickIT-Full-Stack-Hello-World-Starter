import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";
import { getRequesterIdFromHeaders } from "../../src/requester-context.js";

vi.mock("../../src/service.js");

describe("API-REQ-02 & API-REQ-03: requester context & bootstrap exemptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  describe("API-REQ-02: Requester-scoped context enforcement", () => {
    it("allows valid active requester through", async () => {
      const response = await request(app)
        .get("/api/requester-context")
        .set("X-Dev-Requester-Id", "1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { requesterId: 1 } });
      expect(service.isActiveDevRequester).toHaveBeenCalledWith(1);
    });

    it.each([
      ["missing", undefined],
      ["malformed non-numeric", "abc"],
      ["decimal", "1.0"],
      ["signed", "+1"],
    ])("rejects %s requester header with canonical 422", async (_label, value) => {
      const req = request(app).get("/api/requester-context");
      if (value !== undefined) req.set("X-Dev-Requester-Id", value);

      const response = await req;
      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        error: {
          code: "REQUESTER_CONTEXT_INVALID",
          message: "A valid active requester is required.",
        },
      });
      expect(response.body).not.toHaveProperty("fields");
    });

    it("rejects whitespace-padded header values before database lookup", () => {
      const parsed = getRequesterIdFromHeaders({
        headers: { "x-dev-requester-id": " 1" },
      } as never);
      expect(parsed).toBeNull();
      expect(vi.mocked(service.isActiveDevRequester)).not.toHaveBeenCalled();
    });

    it("rejects duplicate requester header values with 422", async () => {
      const response = await request(app)
        .get("/api/requester-context")
        .set("X-Dev-Requester-Id", ["1", "2"] as unknown as string);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    });

    it.each(["unknown", "inactive"])("rejects %s requester ID with 422", async () => {
      vi.mocked(service.isActiveDevRequester).mockResolvedValue(false);

      const response = await request(app)
        .get("/api/requester-context")
        .set("X-Dev-Requester-Id", "99");

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    });
  });

  describe("API-REQ-03: Bootstrap & reference endpoints exemption", () => {
    it("allows GET /api/dev-requesters without X-Dev-Requester-Id header", async () => {
      vi.mocked(service.getActiveDevRequesters).mockResolvedValue([
        { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
      ]);

      const response = await request(app).get("/api/dev-requesters");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [{ id: 1, name: "Ada Lovelace", email: "ada@example.com" }],
      });
    });

    it("allows GET /api/categories without X-Dev-Requester-Id header", async () => {
      vi.mocked(service.getCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);

      const response = await request(app).get("/api/categories");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual([{ id: 1, name: "Hardware" }]);
    });
  });
});
