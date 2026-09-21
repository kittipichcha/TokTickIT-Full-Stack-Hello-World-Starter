/**
 * Frozen Test-DD file: `server/tests/lab-03/comments-notes.unit.test.ts`
 *
 * Owned by Issue #38. Frozen row executed here:
 *   - UNIT-COMMENT-01  Comment/Note content validation (AC-08)
 *
 * Pure unit coverage of `validateCommentContent` (BR-22/23): trim,
 * whitespace-only rejection, and the 1–2,000-after-trim boundaries.
 */

import { describe, expect, it } from "vitest";
import { validateCommentContent, MAX_COMMENT_LENGTH, ValidationError } from "../../src/service.js";

describe("UNIT-COMMENT-01 — Comment/Note content validation (AC-08)", () => {
  it("trims surrounding whitespace", () => {
    expect(validateCommentContent("  hello world  ")).toBe("hello world");
  });

  it("accepts a single character after trim", () => {
    expect(validateCommentContent("x")).toBe("x");
  });

  it("accepts exactly the maximum length after trim", () => {
    const content = "a".repeat(MAX_COMMENT_LENGTH);
    expect(validateCommentContent(content)).toBe(content);
  });

  it("accepts maximum length with surrounding whitespace", () => {
    const content = "a".repeat(MAX_COMMENT_LENGTH);
    expect(validateCommentContent(`  ${content}  `)).toBe(content);
  });

  it("rejects content exceeding the maximum length after trim", () => {
    const content = "a".repeat(MAX_COMMENT_LENGTH + 1);
    expect(() => validateCommentContent(content)).toThrow(ValidationError);
  });

  it("rejects an empty string", () => {
    expect(() => validateCommentContent("")).toThrow(ValidationError);
  });

  it("rejects whitespace-only content", () => {
    expect(() => validateCommentContent("   \t\n  ")).toThrow(ValidationError);
  });

  it("rejects non-string content", () => {
    expect(() => validateCommentContent(undefined)).toThrow(ValidationError);
    expect(() => validateCommentContent(null)).toThrow(ValidationError);
    expect(() => validateCommentContent(42)).toThrow(ValidationError);
    expect(() => validateCommentContent({})).toThrow(ValidationError);
  });

  it("reports a field-level message for the content field", () => {
    try {
      validateCommentContent("   ");
      throw new Error("expected validateCommentContent to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fields).toHaveProperty("content");
    }
  });
});