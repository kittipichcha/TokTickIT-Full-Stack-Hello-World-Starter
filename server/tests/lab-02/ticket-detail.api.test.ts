import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";

vi.mock("../../src/service.js");

describe("API-TKT-03: Ticket detail ownership enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  const mockTicket = {
    id: 501,
    ticketNumber: "TKT-2026-000123",
    requesterId: 1,
    requesterName: "Ada Lovelace",
    requesterIsActive: true,
    categoryId: 2,
    categoryName: "Hardware",
    relatedSystemId: 6,
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual.",
    requestedPriority: "MEDIUM",
    itPriority: null,
    ticketOwnerId: null,
    currentStatus: "NEW",
    createdAt: new Date("2026-08-21T09:14:00.000Z"),
    updatedAt: new Date("2026-08-21T09:14:00.000Z"),
    attachments: [],
  };

  it("returns 200 with full ticket detail for owner", async () => {
    vi.mocked(service.getTicketByNumber).mockResolvedValue(mockTicket);

    const res = await request(app)
      .get("/api/tickets/TKT-2026-000123")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ticketNumber).toBe("TKT-2026-000123");
    expect(res.body.data.requesterName).toBe("Ada Lovelace");
    expect(res.body.data.categoryName).toBe("Hardware");
    expect(res.body.data.relatedSystemName).toBe("Corporate Laptop");
    expect(res.body.data.attachments).toEqual([]);
  });

  it("returns 404 for non-owner access", async () => {
    vi.mocked(service.getTicketByNumber).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/tickets/TKT-2026-000123")
      .set("X-Dev-Requester-Id", "2");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for non-existent ticket", async () => {
    vi.mocked(service.getTicketByNumber).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/tickets/TKT-2026-999999")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for malformed ticket number", async () => {
    const res = await request(app)
      .get("/api/tickets/not-a-ticket")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 422 for missing requester header", async () => {
    const res = await request(app).get("/api/tickets/TKT-2026-000123");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });
});