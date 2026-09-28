import { redactUnsafeFields } from "./redaction";

/**
 * Central structured logger (PRD 43). All application logging must go
 * through this module rather than console.log directly, so redaction is
 * applied consistently.
 *
 * Usage:
 *   logger.info("webhook_received", { event: "MESSAGES_UPSERT", userId, latencyMs });
 *   logger.error("evolution_send_failed", { userId, errorCode, httpStatus });
 *
 * Do not pass message text, prompts, calendar descriptions, sheet rows,
 * secrets, or media URLs as metadata values - redactUnsafeFields() will
 * catch common cases by key name, but the primary defense is simply never
 * putting that data in a log call in the first place.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(level: LogLevel, event: string, metadata: Record<string, unknown> = {}): void {
  const safeMetadata = redactUnsafeFields(metadata);

  const entry: LogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeMetadata,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (event: string, metadata?: Record<string, unknown>) => write("debug", event, metadata),
  info: (event: string, metadata?: Record<string, unknown>) => write("info", event, metadata),
  warn: (event: string, metadata?: Record<string, unknown>) => write("warn", event, metadata),
  error: (event: string, metadata?: Record<string, unknown>) => write("error", event, metadata),
};

export { extractSafeErrorFields } from "./redaction";
