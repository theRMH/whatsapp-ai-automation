import { getSetting, getSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";

/**
 * Google OAuth scopes (PRD 19.3). Deliberately minimal - no broad drive/
 * drive.readonly scopes, no Gmail scopes, and no incremental-auth upgrade
 * mechanism: the full set below is requested in one consent at connect
 * time, even though Calendar/Sheets tool logic lands in later milestones.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export class GoogleNotConfiguredError extends Error {
  constructor(message = "Google integration is not fully configured") {
    super(message);
    this.name = "GoogleNotConfiguredError";
  }
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Loads Google OAuth settings from system_settings (PRD 29: never
 * hardcoded). The callback/redirect URI is not admin-editable (PRD 29: "a
 * read-only, generated value") - it is always derived from
 * NEXT_PUBLIC_APP_URL, mirroring the Evolution webhook URL pattern in
 * admin/settings/evolution/actions.ts.
 */
export async function loadGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
  const enabled = await getSetting<boolean>(SettingsKeys.GOOGLE_ENABLED, SettingsDefaults.GOOGLE_ENABLED);
  const clientId = await getSetting<string | null>(SettingsKeys.GOOGLE_CLIENT_ID, null);
  const clientSecret = await getSecret(SettingsKeys.GOOGLE_CLIENT_SECRET);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!enabled || !clientId || !clientSecret || !appUrl) {
    throw new GoogleNotConfiguredError();
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl.replace(/\/+$/, "")}/api/auth/google/callback`,
  };
}

/** Computes the redirect URI for display in the admin UI, without requiring full config to be valid. */
export function getGoogleRedirectUriForDisplay(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? `${appUrl.replace(/\/+$/, "")}/api/auth/google/callback` : null;
}
