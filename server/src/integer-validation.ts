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

  // Capture narrowed type for use in nested closures.
  const body = rawBody;

  let pos = 0;
  const len = body.length;

  /** Advance past whitespace characters. */
  function skipWhitespace(): void {
    while (pos < len && /\s/.test(body[pos])) pos++;
  }

  /**
   * Read a JSON string starting at the current position.
   * Handles escape sequences including \uXXXX.
   * Returns the decoded string and advances pos past the closing quote.
   */
  function readString(): string {
    if (body[pos] !== '"') throw new Error('Expected "');
    pos++; // skip opening quote
    let result = "";
    while (pos < len) {
      if (body[pos] === "\\") {
        pos++;
        if (pos >= len) throw new Error("Unexpected end");
        if (body[pos] === "u") {
          const hex = body.substring(pos + 1, pos + 5);
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
          result += escapes[body[pos]] ?? body[pos];
          pos++;
        }
      } else if (body[pos] === '"') {
        pos++; // skip closing quote
        return result;
      } else {
        result += body[pos];
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
    if (body[pos] === "-") pos++;
    if (pos < len && body[pos] >= "0" && body[pos] <= "9") {
      if (body[pos] === "0") {
        pos++;
        // After a zero, check if there are more digits (leading zero case)
        // We still need to consume all digits for the regex check
        while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
      } else {
        pos++;
        while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
      }
    }
    if (pos < len && body[pos] === ".") {
      pos++;
      while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
    }
    if (pos < len && (body[pos] === "e" || body[pos] === "E")) {
      pos++;
      if (pos < len && (body[pos] === "+" || body[pos] === "-")) pos++;
      while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
    }
    return body.substring(start, pos);
  }

  /**
   * Skip over any JSON value (string, number, object, array, true, false, null)
   * starting at the current position. Advances pos past the value.
   */
  function skipValue(): void {
    skipWhitespace();
    if (pos >= len) return;
    const ch = body[pos];
    if (ch === '"') {
      readString();
    } else if (ch === "{") {
      pos++;
      skipWhitespace();
      if (body[pos] !== "}") {
        while (true) {
          skipWhitespace();
          readString(); // key
          skipWhitespace();
          pos++; // skip :
          skipValue(); // value
          skipWhitespace();
          if (body[pos] === ",") {
            pos++;
            skipWhitespace();
            continue;
          }
          break;
        }
      }
      pos++; // skip }
    } else if (ch === "[") {
      pos++;
      skipWhitespace();
      if (body[pos] !== "]") {
        while (true) {
          skipValue();
          skipWhitespace();
          if (body[pos] === ",") {
            pos++;
            skipWhitespace();
            continue;
          }
          break;
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
  // The walk is defensive: the body has already been proven valid JSON above,
  // so any walker implementation error must not turn a valid request into a
  // 500. On such an error we return the fields validated so far and let the
  // normal JSON.parse-based request handling proceed.
  try {
    skipWhitespace();
    if (pos >= len || body[pos] !== "{") return invalid;
    pos++; // skip opening {

    skipWhitespace();
    if (body[pos] === "}") return invalid; // empty object

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
  } catch {
    // Defensive: never propagate a walker error to the request handler.
    return invalid;
  }

  return invalid;
}