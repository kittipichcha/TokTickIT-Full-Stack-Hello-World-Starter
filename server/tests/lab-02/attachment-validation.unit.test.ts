import { describe, expect, it } from "vitest";
import { validateFileSize } from "../../src/service.js";

describe("UNIT-ATT-01: Attachment size boundary validator", () => {
  it("accepts 4,999,999 bytes", () => {
    expect(validateFileSize(4_999_999)).toBe(true);
  });

  it("accepts 5,000,000 bytes", () => {
    expect(validateFileSize(5_000_000)).toBe(true);
  });

  it("rejects 5,000,001 bytes", () => {
    expect(validateFileSize(5_000_001)).toBe(false);
  });

  it("rejects negative bytes", () => {
    expect(validateFileSize(-1)).toBe(false);
  });
});