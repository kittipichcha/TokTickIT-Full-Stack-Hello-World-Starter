import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SEC-AUTHZ-11: SESSION_SECRET placeholder rejection.
 *
 * The `.env.example` placeholder is 51 characters, so it passes a naive `>= 32` length
 * check. A copied placeholder is a publicly known value and provides no security, so the
 * fail-safe startup must reject it explicitly (not just short/missing secrets).
 */

const ORIGINAL_ENV = { ...process.env };

async function loadGetSessionSecret(): Promise<() => string> {
  // Re-import fresh so the module reads the current process.env.
  vi.resetModules();
  const mod = await import("../../src/config/env.js");
  return mod.getSessionSecret;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("SEC-AUTHZ-11: SESSION_SECRET fail-safe startup", () => {
  it("rejects the known .env.example placeholder even though it is >= 32 chars", async () => {
    const placeholder = "change-me-to-a-long-random-secret-at-least-32-chars";
    expect(placeholder.length).toBeGreaterThanOrEqual(32);

    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = placeholder;

    const getSessionSecret = await loadGetSessionSecret();
    expect(() => getSessionSecret()).toThrow(/placeholder/i);
  });

  it("rejects a missing secret in a non-test environment", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    const getSessionSecret = await loadGetSessionSecret();
    expect(() => getSessionSecret()).toThrow(/not configured/i);
  });

  it("rejects a short secret in a non-test environment", async () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "too-short";

    const getSessionSecret = await loadGetSessionSecret();
    expect(() => getSessionSecret()).toThrow(/not configured/i);
  });

  it("accepts a real, unique secret in a non-test environment", async () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "a-real-unique-secret-value-with-enough-entropy-1234567890";

    const getSessionSecret = await loadGetSessionSecret();
    expect(getSessionSecret()).toBe("a-real-unique-secret-value-with-enough-entropy-1234567890");
  });

  it("allows the deterministic test-only secret under NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-only-session-secret-not-for-production";

    const getSessionSecret = await loadGetSessionSecret();
    expect(getSessionSecret()).toBe("test-only-session-secret-not-for-production");
  });
});
