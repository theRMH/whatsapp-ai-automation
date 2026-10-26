import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserRecord } from "@/lib/db/repositories/users";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";

const createGoogleConnectLink = vi.fn();
const disconnectGoogleAccount = vi.fn();
const getGoogleConnectionStatus = vi.fn();

vi.mock("@/lib/google/connection-service", () => ({
  createGoogleConnectLink: (...args: unknown[]) => createGoogleConnectLink(...args),
  disconnectGoogleAccount: (...args: unknown[]) => disconnectGoogleAccount(...args),
}));

vi.mock("@/lib/db/repositories/google-connections", () => ({
  getGoogleConnectionStatus: (...args: unknown[]) => getGoogleConnectionStatus(...args),
}));

import { executeToolCall } from "@/lib/ai/tool-executor";
import { ToolName } from "@/lib/ai/tools";
import { GoogleNotConfiguredError } from "@/lib/google/config";

function makeUser(): UserRecord {
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
  };
}

const userKeyRecord: UserKeyRecord = { encryptedDek: "enc", keyVersion: 1 };
const onSideEffectStarted = vi.fn();

describe("executeToolCall - google tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GOOGLE_STATUS does not trigger side-effect tracking (read-only)", async () => {
    getGoogleConnectionStatus.mockResolvedValue("CONNECTED");

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g1", name: ToolName.GOOGLE_STATUS, argumentsJson: "{}" },
      onSideEffectStarted
    );

    expect(onSideEffectStarted).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.connected).toBe(true);
    expect(parsed.status).toBe("CONNECTED");
  });

  it("GOOGLE_STATUS reports connected=false for a non-CONNECTED status", async () => {
    getGoogleConnectionStatus.mockResolvedValue("DISCONNECTED");

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g2", name: ToolName.GOOGLE_STATUS, argumentsJson: "{}" },
      onSideEffectStarted
    );

    const parsed = JSON.parse(result.resultJson);
    expect(parsed.connected).toBe(false);
    expect(parsed.status).toBe("DISCONNECTED");
  });

  it("GOOGLE_CONNECT flags side effects and returns the one-time connect URL", async () => {
    createGoogleConnectLink.mockResolvedValue("https://app.example.com/connect/google?t=abc123");

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g3", name: ToolName.GOOGLE_CONNECT, argumentsJson: "{}" },
      onSideEffectStarted
    );

    expect(onSideEffectStarted).toHaveBeenCalledTimes(1);
    expect(createGoogleConnectLink).toHaveBeenCalledWith("user-1");
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.connectUrl).toBe("https://app.example.com/connect/google?t=abc123");
  });

  it("GOOGLE_CONNECT returns NOT_AVAILABLE when Google is not configured", async () => {
    createGoogleConnectLink.mockRejectedValue(new GoogleNotConfiguredError());

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g4", name: ToolName.GOOGLE_CONNECT, argumentsJson: "{}" },
      onSideEffectStarted
    );

    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("NOT_AVAILABLE");
  });

  it("GOOGLE_CONNECT returns INTERNAL_ERROR on an unexpected failure", async () => {
    createGoogleConnectLink.mockRejectedValue(new Error("boom"));

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g5", name: ToolName.GOOGLE_CONNECT, argumentsJson: "{}" },
      onSideEffectStarted
    );

    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("INTERNAL_ERROR");
  });

  it("GOOGLE_DISCONNECT flags side effects and disconnects the account", async () => {
    disconnectGoogleAccount.mockResolvedValue(undefined);

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "g6", name: ToolName.GOOGLE_DISCONNECT, argumentsJson: "{}" },
      onSideEffectStarted
    );

    expect(onSideEffectStarted).toHaveBeenCalledTimes(1);
    expect(disconnectGoogleAccount).toHaveBeenCalledWith("user-1", userKeyRecord);
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("DISCONNECTED");
  });
});
