/**
 * Format an ISO 8601 date string to the canonical UTC display format:
 * YYYY-MM-DD HH:mm:ss UTC
 */
export function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parse the filename from a `Content-Disposition` header value.
 *
 * Per RFC 5987, the `filename*` parameter (UTF-8 encoded) takes precedence over
 * the plain `filename` ASCII fallback. This function:
 *   1. Prefers `filename*=UTF-8''<percent-encoded>` when present and decodes it.
 *   2. Falls back to the ordinary `filename="..."` value otherwise.
 *   3. Returns `null` when neither is present.
 */
export function parseContentDispositionFilename(disposition: string): string | null {
  if (!disposition) return null;

  // Prefer the RFC 5987 `filename*` parameter (UTF-8'' percent-encoded).
  const starMatch = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1].trim());
    } catch {
      // Malformed percent-encoding — fall through to the ASCII fallback.
    }
  }

  // Fall back to the ordinary `filename="..."` value.
  const plainMatch = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch) {
    return plainMatch[1].trim();
  }

  return null;
}