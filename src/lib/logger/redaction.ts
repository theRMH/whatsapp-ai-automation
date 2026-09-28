/**
 * Redaction utilities for the central logger (PRD 43).
 *
 * Forbidden in logs: message text, AI prompts, calendar descriptions,
 * sheet row contents, API keys, refresh tokens, media URLs.
 *
 * Approach: rather than trying to scrub arbitrary strings (which risks
 * missing something), the logger (index.ts) only accepts a fixed set of
 * known-safe fields per log call, and this module defensively redacts
 * any field name that looks like it might carry content or secrets, even
 * if a caller passes it in by mistake.
 */

const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /message/i,
  /text/i,
  /prompt/i,
  /content/i,
  /body/i,
  /description/i,
  /caption/i,
  /title/i,
  /note/i,
  /row/i,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /media[_-]?url/i,
  /refresh/i,
  /authorization/i,
];

const REDACTED_VALUE = "[REDACTED]";

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redacts any object values whose key matches a forbidden
 * pattern. Safe metadata fields (ids, counts, status, latency, error
 * codes) pass through unchanged. Used as the last line of defense before
 * any structured metadata is written to the log sink.
 */
export function redactUnsafeFields(
  input: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenKey(key)) {
      result[key] = REDACTED_VALUE;
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactUnsafeFields(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object"
          ? redactUnsafeFields(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extracts only safe fields from a third-party error response, per PRD
 * 43: "extract safe fields such as HTTP status and known error code. Do
 * not dump the whole response if it may echo customer content."
 */
export function extractSafeErrorFields(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    return {
      errorName: typeof err.name === "string" ? err.name : undefined,
      httpStatus:
        typeof err.status === "number"
          ? err.status
          : typeof err.statusCode === "number"
            ? err.statusCode
            : undefined,
      errorCode: typeof err.code === "string" ? err.code : undefined,
    };
  }
  return {};
}
