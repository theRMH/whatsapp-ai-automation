import { randomBytes, createHash } from "crypto";
import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * One-time connection tokens (PRD 33.16 one_time_tokens, PRD 19: "assistant
 * generates a one-time secure URL... token is random, stored hashed, tied
 * to user_id, purpose-specific, expires in 10 minutes by default, one-time
 * use"). Only the SHA-256 hash of the raw token is ever persisted - the raw
 * value exists only in the generated URL and the caller's memory for the
 * duration of this request.
 */

export const OneTimeTokenPurpose = {
  GOOGLE_CONNECT: "GOOGLE_CONNECT",
} as const;

export type OneTimeTokenPurposeType = (typeof OneTimeTokenPurpose)[keyof typeof OneTimeTokenPurpose];

const DEFAULT_TTL_MINUTES = 10;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface IssuedToken {
  rawToken: string;
  expiresAt: string;
}

/** Issues a new one-time token for a user/purpose (PRD 19). */
export async function issueOneTimeToken(
  userId: string,
  purpose: OneTimeTokenPurposeType,
  ttlMinutes: number = DEFAULT_TTL_MINUTES
): Promise<IssuedToken> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = DateTime.utc().plus({ minutes: ttlMinutes }).toISO();

  const db = getSupabaseAdminClient();
  const { error } = await db.from("one_time_tokens").insert({
    user_id: userId,
    purpose,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
  });

  if (error) {
    logger.error("one_time_token_issue_failed", { errorCode: error.code, purpose });
    throw new Error(`Failed to issue one-time token: ${error.message}`);
  }

  return { rawToken, expiresAt };
}

export interface ConsumedToken {
  userId: string;
}

/**
 * Validates and atomically consumes a one-time token (PRD 19: "one-time
 * use"). Returns null for any invalid/expired/already-used/wrong-purpose
 * token - callers must treat all of these identically (no information
 * leak about which specific reason applied).
 */
export async function consumeOneTimeToken(
  rawToken: string,
  purpose: OneTimeTokenPurposeType
): Promise<ConsumedToken | null> {
  const db = getSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);

  const { data, error } = await db
    .from("one_time_tokens")
    .update({ used_at: DateTime.utc().toISO() })
    .eq("token_hash", tokenHash)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", DateTime.utc().toISO())
    .select("user_id")
    .maybeSingle();

  if (error) {
    logger.error("one_time_token_consume_failed", { errorCode: error.code, purpose });
    throw new Error(`Failed to consume one-time token: ${error.message}`);
  }

  return data ? { userId: data.user_id } : null;
}
