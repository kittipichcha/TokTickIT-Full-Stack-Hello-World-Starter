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

describe("API-TKT-NOR-01: Summary/Description trimming and boundary behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  const validBody = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Valid summary text",
    description: "Valid description text for testing",
    requestedPriority: "MEDIUM",
  };

  it("rejects summary with 4 characters after trim", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { summary: "Summary must be at least 5 characters." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, summary: "abcd" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();
  });

  it("accepts summary with 5 characters after trim", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1, summary: "abcde",
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, summary: "abcde" });

    expect(res.status).toBe(201);
  });

  it("accepts summary with 120 characters after trim", async () => {
    const summary120 = "a".repeat(120);
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1, summary: summary120,
      description: "Valid description text for testing",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, summary: summary120 });

    expect(res.status).toBe(201);
  });

  it("rejects summary with 121 characters after trim", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { summary: "Summary must be at most 120 characters." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, summary: "a".repeat(121) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();
  });

  it("rejects whitespace-only summary", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { summary: "Summary is required." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, summary: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeDefined();
  });

  it("rejects description with 9 characters after trim", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { description: "Description must be at least 10 characters." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, description: "123456789" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();
  });

  it("accepts description with 10 characters after trim", async () => {
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1, summary: "Valid summary text",
      description: "1234567890",
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, description: "1234567890" });

    expect(res.status).toBe(201);
  });

  it("accepts description with 2000 characters after trim", async () => {
    const desc2000 = "a".repeat(2000);
    vi.mocked(service.createTicket).mockResolvedValue({
      id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1,
      categoryId: 1, relatedSystemId: 1, summary: "Valid summary text",
      description: desc2000,
      requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
      currentStatus: "NEW", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, description: desc2000 });

    expect(res.status).toBe(201);
  });

  it("rejects description with 2001 characters after trim", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { description: "Description must be at most 2000 characters." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, description: "a".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();
  });

  it("rejects whitespace-only description", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { description: "Description is required." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, description: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.description).toBeDefined();
  });
});

describe("API-TKT-NOR-02: CategoryId/RelatedSystemId validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  const validBody = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Valid summary text",
    description: "Valid description text for testing",
    requestedPriority: "MEDIUM",
  };

  it("rejects missing categoryId with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { categoryId: "Category is required." }),
    );

    const { categoryId, ...body } = validBody;
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects non-integer categoryId with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { categoryId: "Category must be a valid positive integer." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, categoryId: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects zero categoryId with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { categoryId: "Category must be a valid positive integer." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, categoryId: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects negative categoryId with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { categoryId: "Category must be a valid positive integer." }),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, categoryId: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects nonexistent categoryId with 409", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified category does not exist or is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, categoryId: 999 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("rejects inactive categoryId with 409", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified category is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, categoryId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("rejects missing relatedSystemId with 400", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new ValidationError("Validation failed.", { relatedSystemId: "Related system is required." }),
    );

    const { relatedSystemId, ...body } = validBody;
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.relatedSystemId).toBeDefined();
  });

  it("rejects nonexistent relatedSystemId with 409", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified related system does not exist or is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, relatedSystemId: 999 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("rejects inactive relatedSystemId with 409", async () => {
    vi.mocked(service.createTicket).mockRejectedValue(
      new InactiveReferenceError("The specified related system is inactive."),
    );

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .send({ ...validBody, relatedSystemId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });
});