import { describe, expect, it } from "vitest";
import { validateFileSize } from "../../src/service.js";
import { validateContentSignature, validateExtension } from "../../src/attachment-storage.js";

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

describe("UNIT-ATT-02: Extension validator against production logic", () => {
  it("accepts each allowed extension", () => {
    for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".pdf"]) {
      expect(validateExtension(`photo${ext}`)).toBe(ext);
    }
  });

  it("accepts allowed extensions in upper/mixed case", () => {
    expect(validateExtension("PHOTO.JPG")).toBe(".jpg");
    expect(validateExtension("Photo.PnG")).toBe(".png");
    expect(validateExtension("scan.PDF")).toBe(".pdf");
  });

  it("rejects an unsupported extension", () => {
    expect(validateExtension("file.txt")).toBeNull();
    expect(validateExtension("file.exe")).toBeNull();
    expect(validateExtension("file.gif")).toBeNull();
  });

  it("rejects a file with no extension", () => {
    expect(validateExtension("noextension")).toBeNull();
  });

  it("rejects a final extension that is unsupported even if an earlier segment is allowed", () => {
    // Double extension: the terminal extension must be allowed.
    expect(validateExtension("photo.jpg.txt")).toBeNull();
    expect(validateExtension("photo.png.exe")).toBeNull();
  });

  it("rejects a trailing dot with no extension", () => {
    expect(validateExtension("photo.")).toBeNull();
  });
});

describe("UNIT-ATT-03: Content signature validator against production logic", () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

  it("accepts a JPG signature for .jpg", () => {
    expect(validateContentSignature(jpg, ".jpg")).toBe(true);
  });

  it("accepts a JPEG signature for .jpeg", () => {
    expect(validateContentSignature(jpeg, ".jpeg")).toBe(true);
  });

  it("accepts a PNG signature for .png", () => {
    expect(validateContentSignature(png, ".png")).toBe(true);
  });

  it("accepts a WEBP signature for .webp", () => {
    expect(validateContentSignature(webp, ".webp")).toBe(true);
  });

  it("accepts a PDF signature for .pdf", () => {
    expect(validateContentSignature(pdf, ".pdf")).toBe(true);
  });

  it("rejects a wrong signature for an allowed extension", () => {
    // PNG bytes claimed as .jpg
    expect(validateContentSignature(png, ".jpg")).toBe(false);
    // JPG bytes claimed as .png
    expect(validateContentSignature(jpg, ".png")).toBe(false);
    // PDF bytes claimed as .webp
    expect(validateContentSignature(pdf, ".webp")).toBe(false);
  });

  it("rejects a truncated buffer for each extension", () => {
    expect(validateContentSignature(Buffer.from([0xff, 0xd8]), ".jpg")).toBe(false);
    expect(validateContentSignature(Buffer.from([0x89, 0x50]), ".png")).toBe(false);
    expect(validateContentSignature(Buffer.from([0x52, 0x49]), ".webp")).toBe(false);
    expect(validateContentSignature(Buffer.from([0x25, 0x50]), ".pdf")).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(validateContentSignature(Buffer.alloc(0), ".jpg")).toBe(false);
    expect(validateContentSignature(Buffer.alloc(0), ".pdf")).toBe(false);
  });
});