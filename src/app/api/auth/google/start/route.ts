import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, loadGoogleOAuthConfig } from "@/lib/google/oauth-client";
import { logger } from "@/lib/logger";

/**
 * Begins the Google OAuth flow (PRD 19.1 "Connection page begins Google
 * OAuth"). The one-time token is passed through to Google unconsumed, as
 * the `state` parameter - it is consumed exactly once, atomically with the
 * authorization code exchange, in the callback route. Consuming it here
 * instead would burn the token on every redirect to Google even if the
 * user then abandons the consent screen.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  if (!token) {
    return NextResponse.redirect(new URL("/connect/google/error?reason=missing_token", request.url));
  }

  let config;
  try {
    config = await loadGoogleOAuthConfig();
  } catch (err) {
    logger.error("google_oauth_start_not_configured", { errorCode: err instanceof Error ? err.name : "unknown" });
    return NextResponse.redirect(new URL("/connect/google/error?reason=not_configured", request.url));
  }

  const authUrl = buildGoogleAuthUrl(config, token);
  return NextResponse.redirect(authUrl);
}
