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
    getMyTickets: vi.fn(),
    categoryExists: vi.fn(),
    isActiveCategory: vi.fn(),
    relatedSystemExists: vi.fn(),
    isActiveRelatedSystem: vi.fn(),
  };
});

const service = await import("../../src/service.js");

function makeTicket(
  id: number,
  overrides: Partial<{
    ticketNumber: string;
    requesterId: number;
    categoryId: number;
    categoryName: string;
    summary: string;
    requestedPriority: string;
    currentStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id,
    ticketNumber: overrides.ticketNumber ?? `TKT-2026-${String(id).padStart(6, "0")}`,
    requesterId: overrides.requesterId ?? 1,
    categoryId: overrides.categoryId ?? 1,
    categoryName: overrides.categoryName ?? "Hardware",
    summary: overrides.summary ?? `Ticket ${id} summary`,
    requestedPriority: overrides.requestedPriority ?? "MEDIUM",
    currentStatus: overrides.currentStatus ?? "NEW",
    createdAt: overrides.createdAt ?? new Date("2026-08-21T09:14:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-08-21T09:14:00.000Z"),
  };
}

function makeResult(
  tickets: ReturnType<typeof makeTicket>[],
  overrides: Partial<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  }> = {},
) {
  return {
    data: tickets,
    pagination: {
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 10,
      totalItems: overrides.totalItems ?? tickets.length,
      totalPages: overrides.totalPages ?? Math.ceil((overrides.totalItems ?? tickets.length) / (overrides.pageSize ?? 10)),
      unfilteredTotalItems: overrides.unfilteredTotalItems ?? tickets.length,
    },
  };
}

describe("API-MY-01: My Tickets ownership isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("returns only current requester's own tickets", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([makeTicket(1, { requesterId: 1 }), makeTicket(2, { requesterId: 1 })], { unfilteredTotalItems: 5 }),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const ticket of res.body.data) {
      expect(ticket.requesterId).toBe(1);
    }
  });

  it("returns empty array when requester has no tickets", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([], { totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 }),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.unfilteredTotalItems).toBe(0);
  });
});

describe("API-MY-02: Search by ticket number/summary substring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("passes search term to service", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([makeTicket(1, { summary: "Laptop battery issue" })]),
    );

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ search: "battery" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.search).toBe("battery");
  });

  it("trims search and passes undefined when blank after trim", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ search: "   " });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.search).toBeUndefined();
  });
});

describe("API-MY-03: Category/Priority/Status filters are conjunctive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.categoryExists).mockResolvedValue(true);
    vi.mocked(service.isActiveCategory).mockResolvedValue(true);
  });

  it("passes categoryId filter to service", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "2" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.categoryId).toBe(2);
  });

  it("passes requestedPriority filter to service", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ requestedPriority: "HIGH" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.requestedPriority).toBe("HIGH");
  });

  it("passes status filter to service", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ status: "NEW" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.status).toBe("NEW");
  });
});

describe("API-MY-04: Deterministic sort with tie-breakers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("passes sort and order params to service", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ sort: "ticketNumber", order: "asc" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.sort).toBe("ticketNumber");
    expect(vi.mocked(service.getMyTickets).mock.calls[0]?.[1]?.order).toBe("asc");
  });
});

describe("API-MY-05: Pagination metadata accurate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("returns correct pagination metadata", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult(
        [makeTicket(1), makeTicket(2)],
        { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, unfilteredTotalItems: 10 },
      ),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 2,
      totalPages: 1,
      unfilteredTotalItems: 10,
    });
  });
});

describe("API-MY-06: Default pagination/sort values and invalid-value fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));
  });

  it("uses defaults when no params provided", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    const args = vi.mocked(service.getMyTickets).mock.calls[0]![1];
    expect(args.sort).toBe("createdAt");
    expect(args.order).toBe("desc");
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(10);
  });

  it("falls back to defaults for invalid sort", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ sort: "invalidField" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].sort).toBe("createdAt");
  });

  it("falls back to defaults for invalid order", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ order: "invalid" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].order).toBe("desc");
  });

  it("falls back to 1 for missing page", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].page).toBe(1);
  });

  it("falls back to 10 for pageSize=0", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ pageSize: "0" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].pageSize).toBe(10);
  });

  it("falls back to 10 for pageSize=51", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ pageSize: "51" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].pageSize).toBe(10);
  });
});

describe("API-MY-07: Invalid filter parameter values and pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("returns 400 for malformed categoryId", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid requestedPriority enum", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ requestedPriority: "URGENT" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid status enum", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ status: "CLOSED" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for nonexistent categoryId", async () => {
    vi.mocked(service.categoryExists).mockResolvedValue(false);

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "999" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("returns 409 for inactive categoryId", async () => {
    vi.mocked(service.categoryExists).mockResolvedValue(true);
    vi.mocked(service.isActiveCategory).mockResolvedValue(false);

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "2" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("returns 400 for categoryId=0", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "0" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for categoryId=-1", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "-1" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for categoryId=0.5", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "0.5" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for categoryId=1e2", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "1e2" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for enormous positive integer categoryId", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ categoryId: "9999999999" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  it("falls back to page 1 for malformed page", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ page: "abc" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].page).toBe(1);
  });

  it("falls back to page 1 for page=0", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ page: "0" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].page).toBe(1);
  });

  it("returns 200 with empty data for valid out-of-range page", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([], { page: 999, pageSize: 10, totalItems: 0, totalPages: 3, unfilteredTotalItems: 25 }),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ page: "999" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalPages).toBe(3);
    expect(res.body.pagination.unfilteredTotalItems).toBe(25);
  });
});

describe("API-MY-08: Search normalization and metadata values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
  });

  it("returns unfilteredTotalItems=0 for requester with no tickets", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([], { totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 }),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1");

    expect(res.body.pagination.unfilteredTotalItems).toBe(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("returns unfilteredTotalItems>0 when requester has tickets but filter yields zero", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(
      makeResult([], { totalItems: 0, totalPages: 0, unfilteredTotalItems: 5 }),
    );

    const res = await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ search: "nonexistent" });

    expect(res.body.pagination.unfilteredTotalItems).toBe(5);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("treats empty search as no filter", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ search: "" });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].search).toBeUndefined();
  });

  it("treats whitespace-only search as no filter", async () => {
    vi.mocked(service.getMyTickets).mockResolvedValue(makeResult([]));

    await request(app)
      .get("/api/tickets")
      .set("X-Dev-Requester-Id", "1")
      .query({ search: "   " });

    expect(vi.mocked(service.getMyTickets).mock.calls[0]![1].search).toBeUndefined();
  });
});