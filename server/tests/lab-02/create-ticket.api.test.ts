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
const { ValidationError, InactiveReferenceError } = service;

describe("API-TKT-01: Create ticket success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  const validBody = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual even when idle.",
    requestedPriority: "MEDIUM",
  };

  it("returns 201 with generated ticket number matching TKT-{YYYY}-{6-digit} format", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Laptop battery drains quickly",
      description: "Battery drains much faster than usual even when idle.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: new Date("2026-08-21T09:14:00.000Z"),
      updatedAt: new Date("2026-08-21T09:14:00.000Z"),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");
    expect(res.body.data.itPriority).toBeNull();
    expect(res.body.data.ticketOwnerId).toBeNull();
  });

  it("returns full ticket data in { data: {...} } envelope", async () => {
    const createdAt = new Date("2026-08-21T09:14:00.000Z");
    const updatedAt = new Date("2026-08-21T09:14:00.000Z");
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Laptop battery drains quickly",
      description: "Battery drains much faster than usual even when idle.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt,
      updatedAt,
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(501);
    expect(res.body.data.ticketNumber).toBe("TKT-2026-000123");
    expect(res.body.data.requesterId).toBe(1);
    expect(res.body.data.categoryId).toBe(1);
    expect(res.body.data.relatedSystemId).toBe(1);
    expect(res.body.data.summary).toBe("Laptop battery drains quickly");
    expect(res.body.data.description).toBe("Battery drains much faster than usual even when idle.");
    expect(res.body.data.requestedPriority).toBe("MEDIUM");
    expect(res.body.data.itPriority).toBeNull();
    expect(res.body.data.ticketOwnerId).toBeNull();
    expect(res.body.data.currentStatus).toBe("NEW");
  });
});

describe("API-TKT-04: Ownership assigned from X-Dev-Requester-Id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("persists ownership from the validated caller header", async () => {
    let capturedRequesterId: number | null = null;
    vi.mocked(service.createTicket).mockImplementation(async (rid) => {
      capturedRequesterId = rid;
      return {
        id: 1, ticketNumber: "TKT-2026-000001", requesterId: rid,
        categoryId: 1, relatedSystemId: 1,
        summary: "Valid summary text",
        description: "Valid description text for testing",
        requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
        currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
      };
    });

    await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "42")
      .send({
        categoryId: 1, relatedSystemId: 1,
        summary: "Valid summary text",
        description: "Valid description text for testing",
        requestedPriority: "MEDIUM",
      });

    expect(capturedRequesterId).toBe(42);
  });
});

describe("API-TKT-05: IT Priority and Ticket Owner remain null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("returns itPriority and ticketOwnerId as null on requester-created tickets", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({
        categoryId: 1, relatedSystemId: 1,
        summary: "Valid summary text",
        description: "Valid description text for testing",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.itPriority).toBeNull();
    expect(res.body.data.ticketOwnerId).toBeNull();
  });
});

describe("API-TKT-07: Requested Priority server-side validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  const validBody = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Valid summary text",
    description: "Valid description text for testing",
  };

  it("rejects missing requestedPriority with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { requestedPriority: "Requested priority is required." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.requestedPriority).toBeDefined();
  });

  it("rejects invalid enum value with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { requestedPriority: "Requested priority must be one of LOW, MEDIUM, HIGH." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, requestedPriority: "URGENT" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.requestedPriority).toBeDefined();
  });

  it.each(["LOW", "MEDIUM", "HIGH"])("accepts %s as valid priority", async (priority) => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1,
      summary: "Valid summary text",
      description: "Valid description text for testing",
      requestedPriority: priority, itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, requestedPriority: priority });

    expect(res.status).toBe(201);
    expect(res.body.data.requestedPriority).toBe(priority);
  });
});

describe("API-TKT-02: Inactive/stale reference rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("rejects inactive category with 409 INACTIVE_REFERENCE", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified category is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({
        categoryId: 1, relatedSystemId: 1,
        summary: "Valid summary text",
        description: "Valid description text for testing",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("rejects inactive related system with 409 INACTIVE_REFERENCE", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified related system is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({
        categoryId: 1, relatedSystemId: 1,
        summary: "Valid summary text",
        description: "Valid description text for testing",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });
});