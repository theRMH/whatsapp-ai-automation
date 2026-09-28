import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserRecord } from "@/lib/db/repositories/users";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";
import type { AssistantRunResult } from "@/lib/ai/types";

const checkAndIncrementDailyAiRequests = vi.fn();
const incrementDailyAiTokens = vi.fn();
const getRecentConversationTurns = vi.fn();
const getSetting = vi.fn();
const isGoogleConnectedMock = vi.fn();
const runAssistant = vi.fn();
const healthCheck = vi.fn();
const executeToolCall = vi.fn();

vi.mock("@/lib/db/repositories/usage", () => ({
  checkAndIncrementDailyAiRequests: (...args: unknown[]) => checkAndIncrementDailyAiRequests(...args),
  incrementDailyAiTokens: (...args: unknown[]) => incrementDailyAiTokens(...args),
}));

vi.mock("@/lib/db/repositories/conversation-turns", () => ({
  getRecentConversationTurns: (...args: unknown[]) => getRecentConversationTurns(...args),
}));

vi.mock("@/lib/db/repositories/settings", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { status: isGoogleConnectedMock() ? "CONNECTED" : "DISCONNECTED" } }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/ai/openrouter-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/openrouter-provider")>("@/lib/ai/openrouter-provider");
  return {
    ...actual,
    getAIProvider: async () => ({ runAssistant, healthCheck }),
  };
});

vi.mock("@/lib/ai/tool-executor", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/tool-executor")>("@/lib/ai/tool-executor");
  return {
    ...actual,
    executeToolCall: (...args: unknown[]) => executeToolCall(...args),
  };
});

import { runAssistantTurn } from "@/lib/ai/orchestrator";
import { AIProviderError } from "@/lib/ai/openrouter-provider";

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    name: "Asha",
    phoneE164: "+919876543210",
    phoneJid: null,
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
    accessMode: "NO_EXPIRY",
    trialStartAt: null,
    trialEndAt: null,
    lastActiveAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const userKeyRecord: UserKeyRecord = { encryptedDek: "enc", keyVersion: 1 };

function finalReply(text: string): AssistantRunResult {
  return { decision: { kind: "FINAL_REPLY", text }, usage: { inputTokens: 10, outputTokens: 5 } };
}

describe("runAssistantTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndIncrementDailyAiRequests.mockResolvedValue({ allowed: true, count: 1, limit: 200 });
    getRecentConversationTurns.mockResolvedValue([]);
    getSetting.mockResolvedValue(6);
    isGoogleConnectedMock.mockReturnValue(false);
  });

  it("returns a rate-limit message without calling the provider when the daily limit is hit", async () => {
    checkAndIncrementDailyAiRequests.mockResolvedValue({ allowed: false, count: 200, limit: 200 });
    const onSideEffectStarted = vi.fn();

    const result = await runAssistantTurn(makeUser(), userKeyRecord, "hello", onSideEffectStarted);

    expect(result.replyText).toMatch(/usage limit/i);
    expect(runAssistant).not.toHaveBeenCalled();
  });

  it("returns the model's final reply directly when no tool calls are requested", async () => {
    runAssistant.mockResolvedValue(finalReply("Sure, done!"));

    const result = await runAssistantTurn(makeUser(), userKeyRecord, "hello", vi.fn());

    expect(result.replyText).toBe("Sure, done!");
    expect(incrementDailyAiTokens).toHaveBeenCalledWith("user-1", "Asia/Kolkata", 10, 5);
  });

  it("falls back to a generic reply when the provider throws", async () => {
    runAssistant.mockRejectedValue(new AIProviderError("AI_UNAVAILABLE", "boom"));

    const result = await runAssistantTurn(makeUser(), userKeyRecord, "hello", vi.fn());

    expect(result.replyText).toMatch(/couldn't process/i);
  });

  it("executes requested tool calls and feeds results back before producing a final reply", async () => {
    runAssistant
      .mockResolvedValueOnce({
        decision: {
          kind: "TOOL_CALLS",
          toolCalls: [{ id: "call-1", name: "ACCOUNT_STATUS", argumentsJson: "{}" }],
        },
        usage: { inputTokens: 10, outputTokens: 5 },
      })
      .mockResolvedValueOnce(finalReply("You're on an active plan."));

    executeToolCall.mockResolvedValue({
      toolCallId: "call-1",
      name: "ACCOUNT_STATUS",
      resultJson: JSON.stringify({ ok: true, status: "ACTIVE" }),
    });

    const onSideEffectStarted = vi.fn();
    const result = await runAssistantTurn(makeUser(), userKeyRecord, "am I active?", onSideEffectStarted);

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(executeToolCall.mock.calls[0][3]).toBe(onSideEffectStarted);
    expect(runAssistant).toHaveBeenCalledTimes(2);
    expect(result.replyText).toBe("You're on an active plan.");
  });

  it("stops after the configured max tool iterations and returns a rephrase message", async () => {
    getSetting.mockResolvedValue(2);
    runAssistant.mockResolvedValue({
      decision: {
        kind: "TOOL_CALLS",
        toolCalls: [{ id: "call-x", name: "HELP", argumentsJson: "{}" }],
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    executeToolCall.mockResolvedValue({ toolCallId: "call-x", name: "HELP", resultJson: "{}" });

    const result = await runAssistantTurn(makeUser(), userKeyRecord, "loop please", vi.fn());

    expect(runAssistant).toHaveBeenCalledTimes(2);
    expect(result.replyText).toMatch(/couldn't finish/i);
  });
});
