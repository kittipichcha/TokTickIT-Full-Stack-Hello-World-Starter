import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as service from "../../src/service.js";

vi.mock("../../src/service.js");

describe("GET /api/dev-requesters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active requesters in the documented envelope without a requester header", async () => {
    const activeRequesters = [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
      { id: 2, name: "Grace Hopper", email: "grace@example.com" },
    ];
    vi.mocked(service.getActiveDevRequesters).mockResolvedValue(activeRequesters);

    const response = await request(app).get("/api/dev-requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: activeRequesters });
    expect(service.getActiveDevRequesters).toHaveBeenCalledOnce();
  });
});
