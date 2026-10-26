import { logger } from "@/lib/logger";
import { GOOGLE_OAUTH_SCOPES, loadGoogleOAuthConfig, type GoogleOAuthConfig } from "./config";

/**
 * Google OAuth 2.0 client (PRD 19). All Google-endpoint-specific request/
 * response shapes live only in this file, mirroring how
 * lib/whatsapp/evolution-adapter.ts isolates Evolution's REST contract -
 * nothing outside lib/google/ should construct a Google OAuth/token
 * request directly.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export class GoogleOAuthError extends Error {
  constructor(
    public readonly code: "GOOGLE_TOKEN_EXCHANGE_FAILED" | "GOOGLE_TOKEN_REFRESH_FAILED" | "GOOGLE_INVALID_GRANT",
    message: string
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

/** Builds the URL to send the user's browser to for consent (PRD 19.1). */
export function buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  grantedScopes: string[];
}

/** Exchanges an authorization code for tokens (PRD 19.2). */
export async function exchangeAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string
): Promise<ExchangedTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    logger.error("google_token_exchange_failed", { httpStatus: response.status });
    throw new GoogleOAuthError("GOOGLE_TOKEN_EXCHANGE_FAILED", `Google token exchange returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    grantedScopes: data.scope ? data.scope.split(" ") : [],
  };
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: string;
}

/**
 * Refreshes an access token using the stored refresh token (PRD 41:
 * "refresh automatically server-side"). Throws GOOGLE_INVALID_GRANT when
 * Google reports the refresh token itself is no longer valid (revoked by
 * the user, expired, etc.) - callers must map that to REAUTH_REQUIRED and
 * never retry the same refresh token again.
 */
export async function refreshAccessToken(config: GoogleOAuthConfig, refreshToken: string): Promise<RefreshedTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    try {
      const body = (await response.json()) as { error?: string };
      errorCode = body.error;
    } catch {
      // ignore unparsable error body
    }

    if (response.status === 400 && errorCode === "invalid_grant") {
      throw new GoogleOAuthError("GOOGLE_INVALID_GRANT", "Google refresh token is no longer valid");
    }

    logger.error("google_token_refresh_failed", { httpStatus: response.status });
    throw new GoogleOAuthError("GOOGLE_TOKEN_REFRESH_FAILED", `Google token refresh returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

/** Fetches the connected Google account's email (PRD 19.2: "encrypted connected Google email"). */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    logger.error("google_userinfo_fetch_failed", { httpStatus: response.status });
    return null;
  }

  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

/**
 * Best-effort Google-side token revocation (PRD 19.4: "attempt Google-side
 * token revocation where appropriate"). Never throws - disconnect must
 * proceed locally even if Google's revoke endpoint is unreachable or the
 * token was already invalid.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    logger.error("google_token_revoke_failed", { errorCode: err instanceof Error ? err.name : "unknown" });
  }
}

export { loadGoogleOAuthConfig };
