import { describe, it, expect } from "vitest";
import { redactUnsafeFields, extractSafeErrorFields } from "@/lib/logger/redaction";

describe("redactUnsafeFields", () => {
  it("passes through safe fields", () => {
    const result = redactUnsafeFields({
      userId: "abc-123",
      event: "MESSAGES_UPSERT",
      status: "success",
      latencyMs: 812,
    });
    expect(result).toEqual({
      userId: "abc-123",
      event: "MESSAGES_UPSERT",
      status: "success",
      latencyMs: 812,
    });
  });

  it("redacts message/text/content fields", () => {
    const result = redactUnsafeFields({
      userId: "abc-123",
      message: "Remind me to call my doctor",
      text: "some text",
      content: "sensitive",
    });
    expect(result.userId).toBe("abc-123");
    expect(result.message).toBe("[REDACTED]");
    expect(result.text).toBe("[REDACTED]");
    expect(result.content).toBe("[REDACTED]");
  });

  it("redacts secrets and tokens", () => {
    const result = redactUnsafeFields({
      apiKey: "sk-abc123",
      api_key: "sk-abc123",
      refreshToken: "rt-xyz",
      password: "hunter2",
    });
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.refreshToken).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
  });

  it("redacts media URLs, prompts, calendar descriptions, sheet rows", () => {
    const result = redactUnsafeFields({
      mediaUrl: "https://example.com/file.pdf",
      prompt: "system prompt text",
      calendarDescription: "meeting notes",
      sheetRow: { date: "2026-01-01" },
    });
    expect(result.mediaUrl).toBe("[REDACTED]");
    expect(result.prompt).toBe("[REDACTED]");
    expect(result.calendarDescription).toBe("[REDACTED]");
    expect(result.sheetRow).toBe("[REDACTED]");
  });

  it("recurses into nested objects", () => {
    const result = redactUnsafeFields({
      userId: "abc",
      details: {
        message: "should be redacted",
        status: "ok",
      },
    });
    expect(result.details).toEqual({ message: "[REDACTED]", status: "ok" });
  });

  it("recurses into arrays of objects", () => {
    const result = redactUnsafeFields({
      items: [
        { title: "secret title", id: "1" },
        { title: "another secret", id: "2" },
      ],
    });
    expect(result.items).toEqual([
      { title: "[REDACTED]", id: "1" },
      { title: "[REDACTED]", id: "2" },
    ]);
  });
});

describe("extractSafeErrorFields", () => {
  it("extracts status and code without dumping full error", () => {
    const error = { status: 429, code: "RATE_LIMITED", message: "customer data here" };
    const safe = extractSafeErrorFields(error);
    expect(safe.httpStatus).toBe(429);
    expect(safe.errorCode).toBe("RATE_LIMITED");
    expect(safe.message).toBeUndefined();
  });

  it("handles non-object errors gracefully", () => {
    expect(extractSafeErrorFields("plain string error")).toEqual({});
    expect(extractSafeErrorFields(null)).toEqual({});
  });
});
