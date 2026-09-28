import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { hashSenderPhone } from "@/lib/crypto/sender-hash";
import { getSetting } from "./settings";
import { SettingsKeys, SettingsDefaults } from "./settings-keys";
import { logger } from "@/lib/logger";

/**
 * Unknown-sender reply cooldown tracking (PRD 6.2.1, 33.20). Never stores
 * the plaintext phone number, message content, or message count of an
 * unknown sender - only an HMAC hash and the last-replied timestamp, so
 * an unauthorized number cannot trigger more than one reply per cooldown
 * period (default 24h) and cannot be used to reconstruct who messaged.
 */

/**
 * Atomically checks whether an unknown sender should receive the
 * unauthorized-number reply right now, and if so, marks them as replied.
 * Uses a single INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING so
 * concurrent webhook deliveries for the same sender cannot both reply
 * (PRD 6.2.1: "Use a single statement so concurrent webhooks cannot both
 * reply.").
 */
export async function shouldReplyToUnknownSender(phoneE164: string): Promise<boolean> {
  const senderHash = hashSenderPhone(phoneE164);
  const cooldownHours = await getSetting<number>(
    SettingsKeys.UNKNOWN_NUMBER_REPLY_COOLDOWN_HOURS,
    SettingsDefaults.UNKNOWN_NUMBER_REPLY_COOLDOWN_HOURS
  );

  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("unknown_sender_reply_hit", {
    p_sender_hash: senderHash,
    p_cooldown_hours: cooldownHours,
  });

  if (error) {
    logger.error("unknown_sender_check_failed", { errorCode: error.code });
    throw new Error(`Failed to check unknown sender cooldown: ${error.message}`);
  }

  return data as boolean;
}
