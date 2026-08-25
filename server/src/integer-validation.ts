/**
 * Validate that integer fields in a raw JSON body use strict decimal grammar.
 * JSON.parse converts 1.0 → 1 and 1e0 → 1, losing the lexical distinction.
 *
 * This function walks the raw JSON text and inspects only the effective top-level
 * fields. Nested occurrences inside unknown properties are ignored, and JSON
 * escape sequences in property names (e.g. \u0049) are correctly decoded.
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
  const fieldSet = new Set(integerFields);

  // Verify the body is valid JSON before attempting to walk it.
  try {
    JSON.parse(rawBody);
  } catch {
    return invalid;
  }

  let pos = 0;
  const len = rawBody.length;

  /** Advance past whitespace characters. */
  function skipWhitespace(): void {
    while (pos < len && /\s/.test(rawBody[pos])) pos++;
  }

  /**
   * Read a JSON string starting at the current position.
   * Handles escape sequences including \uXXXX.
   * Returns the decoded string and advances pos past the closing quote.
   */
  function readString(): string {
    if (rawBody[pos] !== '"') throw new Error('Expected "');
    pos++; // skip opening quote
    let result = "";
    while (pos < len) {
      if (rawBody[pos] === "\\") {
        pos++;
        if (pos >= len) throw new Error("Unexpected end");
        if (rawBody[pos] === "u") {
          const hex = rawBody.substring(pos + 1, pos + 5);
          result += String.fromCharCode(parseInt(hex, 16));
          pos += 5;
        } else {
          const escapes: Record<string, string> = {
            '"': '"',
            "\\": "\\",
            "/": "/",
            b: "\b",
            f: "\f",
            n: "\n",
            r: "\r",
            t: "\t",
          };
          result += escapes[rawBody[pos]] ?? rawBody[pos];
          pos++;
        }
      } else if (rawBody[pos] === '"') {
        pos++; // skip closing quote
        return result;
      } else {
        result += rawBody[pos];
        pos++;
      }
    }
    throw new Error("Unterminated string");
  }

  /**
   * Read a JSON number token (raw text) starting at the current position.
   * Returns the raw token string and advances pos past the last digit.
   */
  function readNumberToken(): string {
    const start = pos;
    if (rawBody[pos] === "-") pos++;
    if (pos < len && rawBody[pos] >= "0" && rawBody[pos] <= "9") {
      if (rawBody[pos] === "0") {
        pos++;
      } else {
        pos++;
        while (pos < len && rawBody[pos] >= "0" && rawBody[pos] <= "9") pos++;
      }
    }
    if (pos < len && rawBody[pos] === ".") {
      pos++;
      while (pos < len && rawBody[pos] >= "0" && rawBody[pos] <= "9") pos++;
    }
    if (pos < len && (rawBody[pos] === "e" || rawBody[pos] === "E")) {
      pos++;
      if (pos < len && (rawBody[pos] === "+" || rawBody[pos] === "-")) pos++;
      while (pos < len && rawBody[pos] >= "0" && rawBody[pos] <= "9") pos++;
    }
    return rawBody.substring(start, pos);
  }

  /**
   * Skip over any JSON value (string, number, object, array, true, false, null)
   * starting at the current position. Advances pos past the value.
   */
  function skipValue(): void {
    skipWhitespace();
    if (pos >= len) return;
    const ch = rawBody[pos];
    if (ch === '"') {
      readString();
    } else if (ch === "{") {
      pos++;
      skipWhitespace();
      if (rawBody[pos] !== "}") {
        while (true) {
          readString(); // key
          skipWhitespace();
          pos++; // skip :
          skipValue(); // value
          skipWhitespace();
          if (rawBody[pos] === ",") pos++;
          else break;
        }
      }
      pos++; // skip }
    } else if (ch === "[") {
      pos++;
      skipWhitespace();
      if (rawBody[pos] !== "]") {
        while (true) {
          skipValue();
          skipWhitespace();
          if (rawBody[pos] === ",") pos++;
          else break;
        }
      }
      pos++; // skip ]
    } else if (ch === "t" || ch === "f") {
      pos += ch === "t" ? 4 : 5; // true / false
    } else if (ch === "n") {
      pos += 4; // null
    } else {
      readNumberToken();
    }
  }

  // ── Walk the top-level object ──────────────────────────────────────────

  skipWhitespace();
  if (pos >= len || rawBody[pos] !== "{") return invalid;
  pos++; // skip opening {

  skipWhitespace();
  if (rawBody[pos] === "}") return invalid; // empty object

  while (true) {
    skipWhitespace();
    const key = readString(); // decoded key (handles \uXXXX escapes)
    skipWhitespace();
    pos++; // skip :

    if (fieldSet.has(key)) {
      // Top-level integer field — capture the raw number token.
      skipWhitespace();
      const rawValue = readNumberToken();
      // Strict integer grammar: 0 or [1-9][0-9]* with no sign, dot, or exponent
      if (!/^(?:0|[1-9]\d*)$/.test(rawValue)) {
        invalid.push(key);
      }
    } else {
      // Non-integer or nested field — skip the entire value.
      skipValue();
    }

    skipWhitespace();
    if (pos < len && rawBody[pos] === ",") {
      pos++;
    } else {
      break;
    }
  }

  return invalid;
}