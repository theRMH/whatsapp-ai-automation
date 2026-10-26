import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGoogleAuthUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  fetchGoogleEmail,
  revokeGoogleToken,
  GoogleOAuthError,
} from "@/lib/google/oauth-client";
import type { GoogleOAuthConfig } from "@/lib/google/config";

const config: GoogleOAuthConfig = {
  clientId: "client-123",
  clientSecret: "secret-abc",
  redirectUri: "https://app.example.com/api/auth/google/callback",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("buildGoogleAuthUrl", () => {
  it("requests offline access and forces consent so a refresh token is always returned", () => {
    const url = new URL(buildGoogleAuthUrl(config, "state-token"));

    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
  });
});

describe("exchangeAuthorizationCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a successful token response to ExchangedTokens", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_in: 3600,
        scope: "openid email",
      })
    );

    const result = await exchangeAuthorizationCode(config, "auth-code");

    expect(result.accessToken).toBe("access-1");
    expect(result.refreshToken).toBe("refresh-1");
    expect(result.grantedScopes).toEqual(["openid", "email"]);
  });

  it("returns a null refreshToken when Google omits it", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { access_token: "access-1", expires_in: 3600, scope: "openid" })
    );

    const result = await exchangeAuthorizationCode(config, "auth-code");

    expect(result.refreshToken).toBeNull();
  });

  it("throws GOOGLE_TOKEN_EXCHANGE_FAILED on a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { error: "invalid_request" }));

    await expect(exchangeAuthorizationCode(config, "bad-code")).rejects.toMatchObject({
      code: "GOOGLE_TOKEN_EXCHANGE_FAILED",
    });
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a refreshed access token on success", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { access_token: "access-2", expires_in: 3600 }));

    const result = await refreshAccessToken(config, "refresh-1");

    expect(result.accessToken).toBe("access-2");
  });

  it("throws GOOGLE_INVALID_GRANT specifically on HTTP 400 + error=invalid_grant", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { error: "invalid_grant" }));

    const error = await refreshAccessToken(config, "revoked-token").catch((e) => e);

    expect(error).toBeInstanceOf(GoogleOAuthError);
    expect(error.code).toBe("GOOGLE_INVALID_GRANT");
  });

  it("throws GOOGLE_TOKEN_REFRESH_FAILED for other non-OK responses", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, {}));

    const error = await refreshAccessToken(config, "refresh-1").catch((e) => e);

    expect(error).toBeInstanceOf(GoogleOAuthError);
    expect(error.code).toBe("GOOGLE_TOKEN_REFRESH_FAILED");
  });

  it("does not throw GOOGLE_INVALID_GRANT for a 400 with an unparsable body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 400 }));

    const error = await refreshAccessToken(config, "refresh-1").catch((e) => e);

    expect(error.code).toBe("GOOGLE_TOKEN_REFRESH_FAILED");
  });
});

describe("fetchGoogleEmail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the email on success", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { email: "user@example.com" }));

    await expect(fetchGoogleEmail("access-1")).resolves.toBe("user@example.com");
  });

  it("returns null instead of throwing when the userinfo request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, {}));

    await expect(fetchGoogleEmail("access-1")).resolves.toBeNull();
  });
});

describe("revokeGoogleToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never throws even when the network request rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(revokeGoogleToken("some-token")).resolves.toBeUndefined();
  });
});
