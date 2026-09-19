import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";

/**
 * SEC-AUTHZ-12: account-existence timing equalization.
 *
 * `verifyCredentials` must perform a bcrypt comparison even when no User row matches the
 * email. Otherwise an unknown email returns immediately while a known email pays the full
 * bcrypt cost, leaking account existence through response timing (BR-08 / AC-05 require
 * invalid credentials and inactive accounts to be indistinguishable).
 */

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

const { getPrisma } = await import("../../src/prisma.js");
const { verifyCredentials } = await import("../../src/auth-service.js");

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("SEC-AUTHZ-12: verifyCredentials timing equalization", () => {
  it("performs a bcrypt comparison for an unknown email", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      user: { findUnique: vi.fn(async () => null) },
    } as unknown as ReturnType<typeof getPrisma>);

    const compareSpy = vi.spyOn(bcrypt, "compare");

    const result = await verifyCredentials("nobody@example.com", "SomePassword123!");

    expect(result).toBeNull();
    // The dummy comparison must have run, so the unknown-email path costs the same as a
    // known-email path with a wrong password.
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });

  it("performs exactly one bcrypt comparison for a known email with a wrong password", async () => {
    const hash = await bcrypt.hash("CorrectPassword123!", 10);
    vi.mocked(getPrisma).mockReturnValue({
      user: {
        findUnique: vi.fn(async () => ({
          id: 1,
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "REQUESTER",
          passwordHash: hash,
          isActive: true,
          mustChangePassword: false,
        })),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    const compareSpy = vi.spyOn(bcrypt, "compare");

    const result = await verifyCredentials("ada@example.com", "WrongPassword123!");

    expect(result).toBeNull();
    expect(compareSpy).toHaveBeenCalledTimes(1);
  });
});
