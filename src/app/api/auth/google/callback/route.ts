import { NextResponse } from "next/server";
import { consumeOneTimeToken, OneTimeTokenPurpose } from "@/lib/db/repositories/one-time-tokens";
import { getUserById, getUserKeyRecord } from "@/lib/db/repositories/users";
import { completeGoogleConnection } from "@/lib/google/connection-service";
import { logger } from "@/lib/logger";

/**
 * Google OAuth callback (PRD 19.2). Unlike WhatsApp message handling, this
 * route has no session/user context of its own - the only trustworthy
 * link back to a user is the one-time token passed through as `state`
 * (PRD 19: "tied to user_id... one-time use"). The authorization `code`
 * itself proves nothing about which of our users initiated the flow, so
 * the token must be validated and consumed before the code is exchanged.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/connect/google/error?reason=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/connect/google/error?reason=missing_params", request.url));
  }

  const consumed = await consumeOneTimeToken(state, OneTimeTokenPurpose.GOOGLE_CONNECT);
  if (!consumed) {
    return NextResponse.redirect(new URL("/connect/google/error?reason=invalid_or_expired_token", request.url));
  }

  const user = await getUserById(consumed.userId);
  const userKeyRecord = await getUserKeyRecord(consumed.userId);

  if (!user || !userKeyRecord) {
    logger.error("google_oauth_callback_missing_user", { userId: consumed.userId });
    return NextResponse.redirect(new URL("/connect/google/error?reason=account_not_found", request.url));
  }

  try {
    await completeGoogleConnection({
      userId: user.id,
      userPhoneE164: user.phoneE164,
      authorizationCode: code,
      userKeyRecord,
    });
  } catch (err) {
    logger.error("google_oauth_callback_failed", {
      userId: user.id,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return NextResponse.redirect(new URL("/connect/google/error?reason=connection_failed", request.url));
  }

  return NextResponse.redirect(new URL("/connect/google/success", request.url));
}
