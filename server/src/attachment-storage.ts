import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Returns the storage directory path, creating it if necessary.
 */
function getStorageDir(): string {
  const dir = process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), "attachment-storage");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Validates the file extension against the allowed list.
 * Returns the normalized extension (lowercase) or null if invalid.
 */
export function validateExtension(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      // Ensure the extension is the terminal extension (not part of a double extension)
      const dotIndex = lower.lastIndexOf(".");
      const terminalExt = lower.slice(dotIndex);
      if (ALLOWED_EXTENSIONS.has(terminalExt)) {
        return terminalExt;
      }
    }
  }
  return null;
}

/**
 * Validates the content signature of a file buffer against the expected type.
 */
export function validateContentSignature(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      // FF D8 FF
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case ".png":
      // 89 50 4E 47 0D 0A 1A 0A
      if (buffer.length < 8) return false;
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case ".webp":
      // RIFF at bytes 0-3, WEBP at bytes 8-11
      if (buffer.length < 12) return false;
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    case ".pdf":
      // %PDF-
      if (buffer.length < 5) return false;
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46 &&
        buffer[4] === 0x2d
      );
    default:
      return false;
  }
}

/**
 * Sanitizes the original filename for display metadata.
 * Replaces control characters and path separators with underscore.
 */
export function sanitizeOriginalFilename(filename: string): string {
  return filename.replace(/[\x00-\x1f\x7f/\\]/g, "_");
}

/**
 * Generates a safe stored filename: UUID + validated extension.
 */
export function generateStoredFilename(extension: string): string {
  const uuid = crypto.randomUUID();
  return `${uuid}${extension}`;
}

/**
 * Writes a file buffer to the storage directory.
 * Returns the stored filename on success.
 */
export async function writeAttachmentFile(buffer: Buffer, extension: string): Promise<string> {
  const storedFilename = generateStoredFilename(extension);
  const filePath = path.join(getStorageDir(), storedFilename);
  await fs.promises.writeFile(filePath, buffer);
  return storedFilename;
}

/**
 * Deletes a file from the storage directory.
 * No error is thrown if the file does not exist.
 */
export async function deleteAttachmentFile(storedFilename: string): Promise<void> {
  const filePath = path.join(getStorageDir(), storedFilename);
  try {
    await fs.promises.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

/**
 * Reads a file from the storage directory.
 * Returns the file buffer, or null if the file does not exist.
 */
export async function readAttachmentFile(storedFilename: string): Promise<Buffer | null> {
  const filePath = path.join(getStorageDir(), storedFilename);
  try {
    return await fs.promises.readFile(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Returns the MIME type for a validated extension.
 */
export function getMimeType(extension: string): string {
  return EXTENSION_MIME_MAP[extension] || "application/octet-stream";
}

/**
 * Sanitizes a filename for use in Content-Disposition header.
 * Replaces non-ASCII characters with underscore.
 */
export function sanitizeDownloadFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7e]/g, "_");
}