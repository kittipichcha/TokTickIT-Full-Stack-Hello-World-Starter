import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { getActiveDevRequesters } from "../../src/service.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));

describe("getActiveDevRequesters", () => {
  const findMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ id: 1, name: "Ada Lovelace", email: "ada@example.com" }]);
    vi.mocked(getPrisma).mockReturnValue({
      devRequester: { findMany },
    } as never);
  });

  it("queries only active requesters with the documented selector shape and ordering", async () => {
    await getActiveDevRequesters();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
});
