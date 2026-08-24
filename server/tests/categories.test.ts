import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import * as service from "../src/service.js";

vi.mock("../src/service.js");

describe("Categories Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return HTTP 200 with categories array", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ];

    vi.mocked(service.getCategories).mockResolvedValue(mockCategories);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(mockCategories);
  });

  it("should return categories with id and name fields", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
    ];

    vi.mocked(service.getCategories).mockResolvedValue(mockCategories);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    response.body.forEach((category: { id: unknown; name: unknown }) => {
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    });
  });

  it("should return categories in ascending order by ID then name (composite sort)", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 1, name: "Billing" },
      { id: 2, name: "Hardware" },
      { id: 2, name: "Network" },
      { id: 3, name: "Software" },
    ];

    vi.mocked(service.getCategories).mockResolvedValue(mockCategories);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    // Verify sort order: categories should be sorted by ID first, then by name
    for (let i = 0; i < response.body.length - 1; i++) {
      const current = response.body[i];
      const next = response.body[i + 1];
      if (current.id === next.id) {
        expect(current.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
      } else {
        expect(current.id).toBeLessThanOrEqual(next.id);
      }
    }
    
    // Verify composite sort: ID first, then name within same ID
    for (let i = 1; i < response.body.length; i++) {
      const prev = response.body[i - 1];
      const curr = response.body[i];
      const isOrdered = 
        prev.id < curr.id || 
        (prev.id === curr.id && prev.name <= curr.name);
      expect(isOrdered).toBe(true);
    }
  });

  it("should return HTTP 500 when service throws an error", async () => {
    vi.mocked(service.getCategories).mockRejectedValue(
      new Error("Failed to fetch categories from database")
    );

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  it("should return empty array when no categories exist", async () => {
    vi.mocked(service.getCategories).mockResolvedValue([]);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
