/**
 * Validate that integer fields in a raw JSON body use strict decimal grammar.
 * JSON.parse converts 1.0 → 1 and 1e0 → 1, losing the lexical distinction.
 * This re-parses the raw body with a reviver that rejects non-integer number literals.
 *
 * Per api-spec §0: integer values accept only the decimal grammar `0|[1-9][0-9]*`
 * with no sign, decimal point, whitespace, or exponent.
 */
export function validateIntegerFields(
  rawBody: string | undefined,
  integerFields: string[],
): string[] {
  if (!rawBody) return [];
  const invalid: string[] = [];
  try {
    JSON.parse(rawBody, (key, value) => {
      if (integerFields.includes(key) && typeof value === "number") {
        // Re-parse the raw JSON to find the exact text for this field.
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(
          `"${escapedKey}"\\s*:\\s*(-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)`,
        );
        const match = regex.exec(rawBody);
        if (match) {
          const rawValue = match[1];
          // Strict integer grammar: 0 or [1-9][0-9]* with no sign, dot, or exponent
          if (!/^(?:0|[1-9]\d*)$/.test(rawValue)) {
            invalid.push(key);
          }
        }
      }
      return value;
    });
  } catch {
    // If raw body isn't valid JSON, let the normal JSON parse error handler deal with it
  }
  return invalid;
}