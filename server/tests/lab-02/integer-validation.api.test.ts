import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

vi.mock("../../src/service.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/service.js")>("../../src/service.js");
  return {
    ...actual,
    isActiveDevRequester: vi.fn(),
    createTicket: vi.fn(),
    getCategories: vi.fn(),
    getActiveDevRequesters: vi.fn(),
    getActiveRelatedSystems: vi.fn(),
    getTicketByNumber: vi.fn(),
    categoryExists: vi.fn(),
    isActiveCategory: vi.fn(),
    relatedSystemExists: vi.fn(),
    isActiveRelatedSystem: vi.fn(),
  };
});

const service = await import("../../src/service.js");

/**
 * API-TKT-INT-01: Integer lexical validation (api-spec §0)
 *
 * Tests that the raw-body integer validator correctly:
 * 1. Inspects only the effective top-level fields used by req.body.
 * 2. Ignores nested occurrences inside unknown properties.
 * 3. Correctly handles JSON escape sequences in property names.
 * 4. Rejects decimal and exponent forms before converting the value.
 */

describe("API-TKT-INT-01: Integer lexical validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  // ── Decimal forms ──────────────────────────────────────────────────────

  it("rejects categoryId: 1.0 with 400 VALIDATION_ERROR", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1.0,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects categoryId: 1e0 with 400 VALIDATION_ERROR", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1e0,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects relatedSystemId: 1.0 with 400 VALIDATION_ERROR", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1,"relatedSystemId":1.0,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.relatedSystemId).toBeDefined();
  });

  it("rejects relatedSystemId: 1e0 with 400 VALIDATION_ERROR", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1,"relatedSystemId":1e0,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.relatedSystemId).toBeDefined();
  });

  // ── Nested property with same field name ────────────────────────────────

  it("rejects invalid top-level categoryId even when a nested property has the same name with a valid value", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"ignored":{"categoryId":1},"categoryId":1.0,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.categoryId).toBeDefined();
  });

  it("accepts valid top-level categoryId even when a nested property has the same name with an invalid value", async () => {
    // Mock createTicket to succeed so we can verify the integer validator
    // doesn't produce a false positive from the nested invalid value.
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"ignored":{"categoryId":1.0},"categoryId":1,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    // The top-level categoryId is 1 (valid), so the integer validator should
    // not reject it. The request should reach the (mocked) service.
    expect(rawRes.status).toBe(201);
  });

  // ── Escaped property names ──────────────────────────────────────────────

  it("rejects escaped top-level categoryId with decimal value", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"category\\u0049d":1.0,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields.categoryId).toBeDefined();
  });

  // ── Ignored nested objects/arrays must not produce 500 ──────────────────

  it("ignores an unknown multi-property nested object without 500", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"ignored":{"a":1,"b":2},"categoryId":1,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(201);
  });

  it("ignores a pretty-printed unknown nested object without 500", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send(
        '{\n' +
        '  "ignored": {\n' +
        '    "nested": {\n' +
        '      "x": 1,\n' +
        '      "y": 2\n' +
        '    }\n' +
        '  },\n' +
        '  "categoryId": 1,\n' +
        '  "relatedSystemId": 1,\n' +
        '  "summary": "Valid summary text",\n' +
        '  "description": "Valid description text for testing",\n' +
        '  "requestedPriority": "MEDIUM"\n' +
        '}',
      );

    expect(rawRes.status).toBe(201);
  });

  it("ignores an unknown array of multi-property objects without 500", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"ignored":[{"a":1,"b":2}],"categoryId":1,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(201);
  });

  // ── Leading zeros ───────────────────────────────────────────────────────

  it("rejects categoryId: 01 with 400 VALIDATION_ERROR (leading zero)", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":01,"relatedSystemId":1,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    console.log('Response:', rawRes.status, rawRes.body);
    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    // Leading zero causes JSON syntax error, fields should be empty object
    expect(rawRes.body.error.fields).toEqual({});
  });

  it("rejects relatedSystemId: 01 with 400 VALIDATION_ERROR (leading zero)", async () => {
    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1,"relatedSystemId":01,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    console.log('Response:', rawRes.status, rawRes.body);
    expect(rawRes.status).toBe(400);
    expect(rawRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(rawRes.body.error.fields).toEqual({});
  });

  // ── Valid integer forms ─────────────────────────────────────────────────

  it("accepts valid integer categoryId and relatedSystemId", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 42,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const rawRes = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .set("Content-Type", "application/json")
      .send('{"categoryId":1,"relatedSystemId":42,"summary":"Valid summary text","description":"Valid description text for testing","requestedPriority":"MEDIUM"}');

    expect(rawRes.status).toBe(201);
  });

  // ── Oversized positive references ───────────────────────────────────────

  it.each([
    ["categoryId", "2147483648"],
    ["categoryId", "9007199254740993"],
    ["categoryId", "9".repeat(400)],
    ["relatedSystemId", "2147483648"],
    ["relatedSystemId", "9007199254740993"],
    ["relatedSystemId", "9".repeat(400)],
  ])(
    "returns 409 for positive out-of-range %s=%s",
    async (field, token) => {
      const body =
        field === "categoryId"
          ? `{"categoryId":${token},"relatedSystemId":1,"summary":"Valid summary","description":"Valid description text","requestedPriority":"MEDIUM"}`
          : `{"categoryId":1,"relatedSystemId":${token},"summary":"Valid summary","description":"Valid description text","requestedPriority":"MEDIUM"}`;

      const response = await request(app)
        .post("/api/tickets")
        .set("X-Dev-Requester-Id", "1")
        .set("Content-Type", "application/json")
        .send(body);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("INACTIVE_REFERENCE");
      expect(response.body.error).not.toHaveProperty("fields");
      expect(service.createTicket).not.toHaveBeenCalled();
    },
  );
});