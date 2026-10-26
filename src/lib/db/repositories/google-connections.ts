import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { userEncryptionContext, type UserKeyRecord } from "@/lib/crypto/user-encryption";
import { logger } from "@/lib/logger";

/**
 * Google connections repository (PRD 33.13 google_connections, PRD 19,
 * 41). Tokens and the connected Google email are per-user content, so they
 * are encrypted with that user's own DEK (userEncryptionContext) exactly
 * like tasks.ts - never with the system config key, which is reserved for
 * admin-entered integration secrets (Client ID/Secret) in settings.ts.
 *
 * Every function here is scoped by userId; there is no lookup by a bare
 * connection id, matching the PRD 41/42 rule that Google operations always
 * resolve as userId -> google_connections -> decrypted token, never a
 * client-supplied connection id.
 */

export type GoogleConnectionStatus = "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED";

export interface GoogleConnectionRecord {
  userId: string;
  googleEmail: string | null;
  accessToken: string | null;
  refreshToken: string;
  tokenExpiryAt: string | null;
  scopes: string[];
  status: GoogleConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

interface GoogleConnectionRow {
  user_id: string;
  google_email_enc: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string;
  token_expiry_at: string | null;
  scopes: string[];
  status: GoogleConnectionStatus;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "user_id, google_email_enc, access_token_enc, refresh_token_enc, token_expiry_at, scopes, status, created_at, updated_at";

function toRecord(row: GoogleConnectionRow, decrypt: (value: string) => string): GoogleConnectionRecord {
  return {
    userId: row.user_id,
    googleEmail: row.google_email_enc ? decrypt(row.google_email_enc) : null,
    accessToken: row.access_token_enc ? decrypt(row.access_token_enc) : null,
    refreshToken: decrypt(row.refresh_token_enc),
    tokenExpiryAt: row.token_expiry_at,
    scopes: row.scopes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Reads a user's Google connection status only, without decrypting tokens (used by GOOGLE_STATUS). */
export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("google_connections")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("google_connection_status_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read Google connection status: ${error.message}`);
  }

  return (data?.status as GoogleConnectionStatus | undefined) ?? "DISCONNECTED";
}

export async function getGoogleConnection(
  userId: string,
  userKeyRecord: UserKeyRecord
): Promise<GoogleConnectionRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("google_connections").select(COLUMNS).eq("user_id", userId).maybeSingle();

  if (error) {
    logger.error("google_connection_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read Google connection: ${error.message}`);
  }

  if (!data) return null;

  const { decrypt } = userEncryptionContext(userKeyRecord);
  return toRecord(data as GoogleConnectionRow, decrypt);
}

export interface UpsertGoogleConnectionInput {
  userId: string;
  googleEmail: string | null;
  accessToken: string | null;
  refreshToken: string;
  tokenExpiryAt: string | null;
  scopes: string[];
  userKeyRecord: UserKeyRecord;
}

/**
 * Creates or replaces a user's Google connection on successful OAuth
 * callback (PRD 19.2). Upserted by user_id (unique) so a reconnect after
 * REAUTH_REQUIRED/DISCONNECTED cleanly replaces the old tokens.
 */
export async function upsertGoogleConnection(input: UpsertGoogleConnectionInput): Promise<GoogleConnectionRecord> {
  const { encrypt, decrypt } = userEncryptionContext(input.userKeyRecord);
  const db = getSupabaseAdminClient();

  const { data, error } = await db
    .from("google_connections")
    .upsert(
      {
        user_id: input.userId,
        google_email_enc: input.googleEmail ? encrypt(input.googleEmail) : null,
        access_token_enc: input.accessToken ? encrypt(input.accessToken) : null,
        refresh_token_enc: encrypt(input.refreshToken),
        token_expiry_at: input.tokenExpiryAt,
        scopes: input.scopes,
        status: "CONNECTED" as const,
        updated_at: DateTime.utc().toISO(),
      },
      { onConflict: "user_id" }
    )
    .select(COLUMNS)
    .single();

  if (error || !data) {
    logger.error("google_connection_upsert_failed", { errorCode: error?.code });
    throw new Error(`Failed to save Google connection: ${error?.message}`);
  }

  return toRecord(data as GoogleConnectionRow, decrypt);
}

/**
 * Updates just the access token/expiry after a server-side refresh (PRD
 * 41: "refresh automatically server-side"). Leaves the refresh token and
 * status untouched.
 */
export async function updateGoogleAccessToken(
  userId: string,
  accessToken: string,
  tokenExpiryAt: string,
  userKeyRecord: UserKeyRecord
): Promise<void> {
  const { encrypt } = userEncryptionContext(userKeyRecord);
  const db = getSupabaseAdminClient();

  const { error } = await db
    .from("google_connections")
    .update({
      access_token_enc: encrypt(accessToken),
      token_expiry_at: tokenExpiryAt,
      updated_at: DateTime.utc().toISO(),
    })
    .eq("user_id", userId);

  if (error) {
    logger.error("google_access_token_update_failed", { errorCode: error.code });
    throw new Error(`Failed to update Google access token: ${error.message}`);
  }
}

/**
 * Marks a connection REAUTH_REQUIRED after a revoked/invalid grant (PRD
 * 41: "never repeatedly retry a revoked token"). The stale refresh token
 * is left in place (harmless once Google has revoked it) until the user
 * reconnects and upsertGoogleConnection replaces it.
 */
export async function markGoogleConnectionReauthRequired(userId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("google_connections")
    .update({ status: "REAUTH_REQUIRED", updated_at: DateTime.utc().toISO() })
    .eq("user_id", userId);

  if (error) {
    logger.error("google_connection_reauth_flag_failed", { errorCode: error.code });
    throw new Error(`Failed to flag Google connection for reauth: ${error.message}`);
  }
}

/**
 * Disconnects a user's Google account (PRD 19.4): clears stored tokens
 * locally and marks DISCONNECTED. Google-side revocation is attempted by
 * the caller (lib/google/oauth-client.ts) before this is called, since
 * that needs the still-present refresh token. Local tasks/memories/
 * prospects are untouched - this repository never has scope over them.
 *
 * refresh_token_enc is `not null` in the schema, so it is set to an
 * encrypted empty string rather than a raw one, keeping the column's
 * invariant that its contents are always validly-encrypted (any later
 * accidental read still goes through decrypt() instead of yielding a raw
 * plaintext empty string).
 */
export async function disconnectGoogleConnection(userId: string, userKeyRecord: UserKeyRecord): Promise<void> {
  const { encrypt } = userEncryptionContext(userKeyRecord);
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("google_connections")
    .update({
      google_email_enc: null,
      access_token_enc: null,
      refresh_token_enc: encrypt(""),
      token_expiry_at: null,
      scopes: [],
      status: "DISCONNECTED",
      updated_at: DateTime.utc().toISO(),
    })
    .eq("user_id", userId);

  if (error) {
    logger.error("google_connection_disconnect_failed", { errorCode: error.code });
    throw new Error(`Failed to disconnect Google connection: ${error.message}`);
  }
}
