import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";

const issueOneTimeToken = vi.fn();
const disconnectGoogleConnection = vi.fn();
const getGoogleConnection = vi.fn();
const markGoogleConnectionReauthRequired = vi.fn();
const upsertGoogleConnection = vi.fn();
const getEvolutionAdapter = vi.fn();
const getSetting = vi.fn();
const loadGoogleOAuthConfig = vi.fn();
const exchangeAuthorizationCode = vi.fn();
const fetchGoogleEmail = vi.fn();
const revokeGoogleToken = vi.fn();

vi.mock("@/lib/db/repositories/one-time-tokens", () => ({
  issueOneTimeToken: (...args: unknown[]) => issueOneTimeToken(...args),
  OneTimeTokenPurpose: { GOOGLE_CONNECT: "GOOGLE_CONNECT" },
}));

vi.mock("@/lib/db/repositories/google-connections", () => ({
  disconnectGoogleConnection: (...args: unknown[]) => disconnectGoogleConnection(...args),
  getGoogleConnection: (...args: unknown[]) => getGoogleConnection(...args),
  markGoogleConnectionReauthRequired: (...args: unknown[]) => markGoogleConnectionReauthRequired(...args),
  upsertGoogleConnection: (...args: unknown[]) => upsertGoogleConnection(...args),
}));

vi.mock("@/lib/whatsapp/evolution-adapter", () => ({
  getEvolutionAdapter: (...args: unknown[]) => getEvolutionAdapter(...args),
}));

vi.mock("@/lib/db/repositories/settings", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

vi.mock("@/lib/google/oauth-client", () => ({
  loadGoogleOAuthConfig: (...args: unknown[]) => loadGoogleOAuthConfig(...args),
  exchangeAuthorizationCode: (...args: unknown[]) => exchangeAuthorizationCode(...args),
  fetchGoogleEmail: (...args: unknown[]) => fetchGoogleEmail(...args),
  revokeGoogleToken: (...args: unknown[]) => revokeGoogleToken(...args),
}));

import {
  createGoogleConnectLink,
  completeGoogleConnection,
  disconnectGoogleAccount,
  flagGoogleConnectionForReauth,
} from "@/lib/google/connection-service";

const userKeyRecord: UserKeyRecord = { encryptedDek: "enc", keyVersion: 1 };

describe("createGoogleConnectLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  it("validates config before issuing a token, and builds the connect URL from the raw token", async () => {
    loadGoogleOAuthConfig.mockResolvedValue({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://app.example.com/api/auth/google/callback",
    });
    issueOneTimeToken.mockResolvedValue({ rawToken: "raw-token-xyz", expiresAt: "2026-01-01T00:10:00Z" });

    const link = await createGoogleConnectLink("user-1");

    expect(loadGoogleOAuthConfig).toHaveBeenCalled();
    expect(issueOneTimeToken).toHaveBeenCalledWith("user-1", "GOOGLE_CONNECT");
    expect(link).toBe("https://app.example.com/connect/google?t=raw-token-xyz");
  });

  it("propagates GoogleNotConfiguredError without issuing a token", async () => {
    class FakeNotConfigured extends Error {}
    loadGoogleOAuthConfig.mockRejectedValue(new FakeNotConfigured());

    await expect(createGoogleConnectLink("user-1")).rejects.toBeInstanceOf(FakeNotConfigured);
    expect(issueOneTimeToken).not.toHaveBeenCalled();
  });
});

describe("completeGoogleConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadGoogleOAuthConfig.mockResolvedValue({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://app.example.com/api/auth/google/callback",
    });
    getSetting.mockResolvedValue(false);
  });

  it("throws when Google does not return a refresh token, without storing a connection", async () => {
    exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "access-1",
      refreshToken: null,
      expiresAt: "2026-01-01T01:00:00Z",
      grantedScopes: ["openid"],
    });

    await expect(
      completeGoogleConnection({
        userId: "user-1",
        userPhoneE164: "+919876543210",
        authorizationCode: "code",
        userKeyRecord,
      })
    ).rejects.toThrow("Google did not return a refresh token");

    expect(upsertGoogleConnection).not.toHaveBeenCalled();
  });

  it("stores the connection and sends a WhatsApp confirmation when Evolution is enabled", async () => {
    exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: "2026-01-01T01:00:00Z",
      grantedScopes: ["openid", "email"],
    });
    fetchGoogleEmail.mockResolvedValue("user@example.com");
    getSetting.mockResolvedValue(true);
    const sendText = vi.fn().mockResolvedValue(undefined);
    getEvolutionAdapter.mockResolvedValue({ sendText });

    await completeGoogleConnection({
      userId: "user-1",
      userPhoneE164: "+919876543210",
      authorizationCode: "code",
      userKeyRecord,
    });

    expect(upsertGoogleConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        googleEmail: "user@example.com",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        scopes: ["openid", "email"],
      })
    );
    expect(sendText).toHaveBeenCalledWith("+919876543210", expect.stringContaining("Google connected successfully"));
  });

  it("does not fail the connection when the WhatsApp confirmation send throws", async () => {
    exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: "2026-01-01T01:00:00Z",
      grantedScopes: ["openid"],
    });
    fetchGoogleEmail.mockResolvedValue("user@example.com");
    getSetting.mockResolvedValue(true);
    getEvolutionAdapter.mockRejectedValue(new Error("adapter down"));

    await expect(
      completeGoogleConnection({
        userId: "user-1",
        userPhoneE164: "+919876543210",
        authorizationCode: "code",
        userKeyRecord,
      })
    ).resolves.toBeUndefined();

    expect(upsertGoogleConnection).toHaveBeenCalled();
  });
});

describe("disconnectGoogleAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the Google-side token when a refresh token is present, then disconnects locally", async () => {
    getGoogleConnection.mockResolvedValue({ refreshToken: "refresh-1" });

    await disconnectGoogleAccount("user-1", userKeyRecord);

    expect(revokeGoogleToken).toHaveBeenCalledWith("refresh-1");
    expect(disconnectGoogleConnection).toHaveBeenCalledWith("user-1", userKeyRecord);
  });

  it("skips revocation and still disconnects locally when there is no stored connection", async () => {
    getGoogleConnection.mockResolvedValue(null);

    await disconnectGoogleAccount("user-1", userKeyRecord);

    expect(revokeGoogleToken).not.toHaveBeenCalled();
    expect(disconnectGoogleConnection).toHaveBeenCalledWith("user-1", userKeyRecord);
  });
});

describe("flagGoogleConnectionForReauth", () => {
  it("delegates to the repository's reauth-required marker", async () => {
    await flagGoogleConnectionForReauth("user-1");

    expect(markGoogleConnectionReauthRequired).toHaveBeenCalledWith("user-1");
  });
});
