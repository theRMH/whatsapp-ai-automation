import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "@/lib/ai/system-prompt";
import type { AssistantContext } from "@/lib/ai/types";

function makeContext(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    userName: "Asha",
    userTimezone: "Asia/Kolkata",
    nowIso: "2026-09-25T10:00:00+05:30",
    recentTurns: [],
    connectedIntegrations: { google: false },
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes the user's name, timezone, and current time", () => {
    const prompt = buildSystemPrompt(makeContext());
    expect(prompt).toContain("Asha");
    expect(prompt).toContain("Asia/Kolkata");
    expect(prompt).toContain("2026-09-25T10:00:00+05:30");
  });

  it("states Google is not connected when disconnected", () => {
    const prompt = buildSystemPrompt(makeContext({ connectedIntegrations: { google: false } }));
    expect(prompt).toContain("not connected");
  });

  it("states Google is connected when connected", () => {
    const prompt = buildSystemPrompt(makeContext({ connectedIntegrations: { google: true } }));
    expect(prompt).toMatch(/Google Calendar and Google Sheets \(connected\)/);
  });

  it("instructs the assistant never to claim success without a tool result", () => {
    const prompt = buildSystemPrompt(makeContext());
    expect(prompt.toLowerCase()).toContain("never claim");
  });

  it("instructs the assistant not to reveal internal implementation details", () => {
    const prompt = buildSystemPrompt(makeContext());
    expect(prompt.toLowerCase()).toContain("internal implementation");
  });

  it("instructs the assistant not to claim to know stored document contents", () => {
    const prompt = buildSystemPrompt(makeContext());
    expect(prompt.toLowerCase()).toContain("do not read the contents of stored documents");
    expect(prompt.toLowerCase()).toContain("never guess a document's contents from its filename");
  });

  it("instructs the assistant to only use provided tools", () => {
    const prompt = buildSystemPrompt(makeContext());
    expect(prompt.toLowerCase()).toContain("do not invent tool names");
  });
});

describe("buildUserMessage", () => {
  it("returns the latest message verbatim when there is no recent history", () => {
    const result = buildUserMessage([], "Remind me to call mom");
    expect(result).toBe("Remind me to call mom");
  });

  it("prepends formatted recent history when present", () => {
    const result = buildUserMessage(
      [
        { direction: "INBOUND", content: "Hi" },
        { direction: "OUTBOUND", content: "Hello! How can I help?" },
      ],
      "What's on my calendar?"
    );
    expect(result).toContain("User: Hi");
    expect(result).toContain("Assistant: Hello! How can I help?");
    expect(result).toContain("Latest message from user: What's on my calendar?");
  });
});
