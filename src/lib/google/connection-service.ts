import type { UserKeyRecord } from "@/lib/crypto/user-encryption";
import { issueOneTimeToken, OneTimeTokenPurpose } from "@/lib/db/repositories/one-time-tokens";
import {
  disconnectGoogleConnection,
  getGoogleConnection,
  markGoogleConnectionReauthRequired,
  upsertGoogleConnection,
} from "@/lib/db/repositories/google-connections";
import { getEvolutionAdapter } from "@/lib/whatsapp/evolution-adapter";
import { getSetting } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { logger } from "@/lib/logger";
import {
  exchangeAuthorizationCode,
  fetchGoogleEmail,
  loadGoogleOAuthConfig,
  revokeGoogleToken,
} from "./oauth-client";

/**
 * Orchestrates the Google connect/disconnect flow (PRD 19) on top of the
 * one_time_tokens and google_connections repositories and the OAuth
 * client. Used by both the GOOGLE_CONNECT/GOOGLE_DISCONNECT tool
 * implementations (tool-executor.ts) and the /api/auth/google/* routes,
 * so the two entry points (AI tool call vs. browser callback) can never
 * drift into different behavior.
 */

/**
 * Generates the one-time "Connect Google" link (PRD 19.1). Requires Google
 * to be fully configured (loadGoogleOAuthConfig throws
 * GoogleNotConfiguredError otherwise) - there is no point issuing a token
 * for a flow that would fail at the OAuth start step.
 */
export async function createGoogleConnectLink(userId: string): Promise<string> {
  await loadGoogleOAuthConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL as string;

  const { rawToken } = await issueOneTimeToken(userId, OneTimeTokenPurpose.GOOGLE_CONNECT);
  return `${appUrl.replace(/\/+$/, "")}/connect/google?t=${rawToken}`;
}

/**
 * Completes the OAuth callback: exchanges the code, fetches the connected
 * email, and stores the encrypted connection (PRD 19.2). Also sends the
 * WhatsApp confirmation message, matching PRD 19.2's "Shows... plus sends
 * a WhatsApp confirmation message" - the callback route has no user's
 * WhatsApp session context of its own, so this is the one place that
 * completion is known and can trigger it.
 */
export async function completeGoogleConnection(input: {
  userId: string;
  userPhoneE164: string;
  authorizationCode: string;
  userKeyRecord: UserKeyRecord;
}): Promise<void> {
  const config = await loadGoogleOAuthConfig();
  const tokens = await exchangeAuthorizationCode(config, input.authorizationCode);

  if (!tokens.refreshToken) {
    // Google omits refresh_token on repeat consents without prompt=consent
    // forcing a fresh grant; buildGoogleAuthUrl always sets prompt=consent,
    // so this should not happen in practice, but a stored connection with
    // no refresh token would be useless (PRD 41: refresh token is what's
    // persisted long-term), so treat it as a failed exchange rather than
    // silently degrading a future user's automatic token refresh.
    logger.error("google_oauth_missing_refresh_token", { userId: input.userId });
    throw new Error("Google did not return a refresh token");
  }

  const googleEmail = await fetchGoogleEmail(tokens.accessToken);

  await upsertGoogleConnection({
    userId: input.userId,
    googleEmail,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiryAt: tokens.expiresAt,
    scopes: tokens.grantedScopes,
    userKeyRecord: input.userKeyRecord,
  });

  await sendWhatsAppConfirmation(input.userPhoneE164, "Google connected successfully. You can return to WhatsApp.");
}

/**
 * Disconnects a user's Google account (PRD 19.4): attempts Google-side
 * revocation first (best-effort, using the still-present refresh token),
 * then clears local tokens and marks DISCONNECTED regardless of whether
 * revocation succeeded.
 */
export async function disconnectGoogleAccount(userId: string, userKeyRecord: UserKeyRecord): Promise<void> {
  const connection = await getGoogleConnection(userId, userKeyRecord);

  if (connection?.refreshToken) {
    await revokeGoogleToken(connection.refreshToken);
  }

  await disconnectGoogleConnection(userId, userKeyRecord);
}

/** Flags a connection for reauth after a revoked/invalid grant is detected elsewhere (PRD 41). */
export async function flagGoogleConnectionForReauth(userId: string): Promise<void> {
  await markGoogleConnectionReauthRequired(userId);
}

async function sendWhatsAppConfirmation(phoneE164: string, text: string): Promise<void> {
  try {
    const evolutionEnabled = await getSetting<boolean>(
      SettingsKeys.EVOLUTION_ENABLED,
      SettingsDefaults.EVOLUTION_ENABLED
    );
    if (!evolutionEnabled) return;

    const adapter = await getEvolutionAdapter();
    await adapter.sendText(phoneE164, text);
  } catch (err) {
    // Best-effort: the connect page itself already confirms success to the
    // user in-browser, so a failed WhatsApp notification must not fail the
    // whole connection flow.
    logger.error("google_connect_whatsapp_confirmation_failed", {
      errorCode: err instanceof Error ? err.name : "unknown",
    });
  }
}
