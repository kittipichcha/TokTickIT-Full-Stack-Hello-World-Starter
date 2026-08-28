import { describe, expect, it } from "vitest";
import { parseContentDispositionFilename } from "../format";

describe("parseContentDispositionFilename (RFC 5987 filename* precedence)", () => {
  it("decodes a UTF-8 filename* value", () => {
    const disposition = `attachment; filename="fallback.pdf"; filename*=UTF-8''%E0%B8%A0%E0%B8%B2%E0%B8%9E.pdf`;
    expect(parseContentDispositionFilename(disposition)).toBe("ภาพ.pdf");
  });

  it("prefers filename* over the ASCII filename fallback when both exist", () => {
    const disposition = `attachment; filename="fallback.pdf"; filename*=UTF-8''actual-name.pdf`;
    expect(parseContentDispositionFilename(disposition)).toBe("actual-name.pdf");
  });

  it("falls back to the plain filename when only filename= exists", () => {
    const disposition = `attachment; filename="report.pdf"`;
    expect(parseContentDispositionFilename(disposition)).toBe("report.pdf");
  });

  it("returns null for an empty disposition", () => {
    expect(parseContentDispositionFilename("")).toBeNull();
  });

  it("returns null when no filename parameter is present", () => {
    expect(parseContentDispositionFilename("attachment")).toBeNull();
  });

  it("handles a filename* value without quotes", () => {
    const disposition = `attachment; filename*=UTF-8''photo%20one.jpg`;
    expect(parseContentDispositionFilename(disposition)).toBe("photo one.jpg");
  });

  it("falls back to the plain filename when filename* is malformed", () => {
    const disposition = `attachment; filename="safe.pdf"; filename*=UTF-8''%ZZbad`;
    expect(parseContentDispositionFilename(disposition)).toBe("safe.pdf");
  });
});