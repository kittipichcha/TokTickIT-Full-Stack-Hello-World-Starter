import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../../src/auth-service.js";

describe("UNIT-AUTH-01: Password hashing", () => {
  it("produces a bcrypt hash, never plaintext", async () => {
    const password = "ValidPass123!";
    const hash = await hashPassword(password);

    // bcrypt hash format: $2a$/$2b$/$2y$ + cost + salt + hash
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    // bcrypt hashes are 60 characters.
    expect(hash).toHaveLength(60);
    // Never plaintext.
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });

  it("verifyPassword returns true for the correct password and false otherwise", async () => {
    const password = "ValidPass123!";
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("WrongPass123!", hash)).toBe(false);
  });

  it("produces a different hash for the same password (salt) but both verify", async () => {
    const password = "ValidPass123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe("Password policy (frozen §13 decision 12)", () => {
  it("rejects below 12 characters", () => {
    expect(validatePasswordPolicy("Short1!a")).not.toBeNull();
  });

  it("accepts exactly 12 valid characters", () => {
    expect(validatePasswordPolicy("Abcdef12!xyz")).toBeNull();
  });

  it("accepts 128 valid characters", () => {
    const pwd = "A1!" + "a".repeat(125);
    expect(pwd).toHaveLength(128);
    expect(validatePasswordPolicy(pwd)).toBeNull();
  });

  it("rejects above 128 characters", () => {
    const pwd = "A1!" + "a".repeat(126);
    expect(pwd).toHaveLength(129);
    expect(validatePasswordPolicy(pwd)).not.toBeNull();
  });

  it("rejects missing uppercase", () => {
    expect(validatePasswordPolicy("abcdef123!xyz")).not.toBeNull();
  });

  it("rejects missing lowercase", () => {
    expect(validatePasswordPolicy("ABCDEF123!XYZ")).not.toBeNull();
  });

  it("rejects missing digit", () => {
    expect(validatePasswordPolicy("Abcdefgh!xyz")).not.toBeNull();
  });

  it("rejects missing special character", () => {
    expect(validatePasswordPolicy("Abcdefgh123xyz")).not.toBeNull();
  });

  it("accepts a valid composition", () => {
    expect(validatePasswordPolicy("Abcdef123!xyz")).toBeNull();
  });

  it("does not trim the value; whitespace counts toward length", () => {
    // Leading/trailing spaces count toward length and are permitted.
    expect(validatePasswordPolicy("  Abcdef123!  ")).toBeNull();
  });
});