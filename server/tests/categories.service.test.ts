import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "../src/prisma.js";
import { getCategories } from "../src/service.js";

vi.mock("../src/prisma.js", () => ({ getPrisma: vi.fn() }));

describe("getCategories", () => {
  const findMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.mocked(getPrisma).mockReturnValue({
      category: { findMany },
    } as never);
  });

  it("queries only active categories", async () => {
    await getCategories();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ id: "asc" }, { name: "asc" }],
    });
  });
});