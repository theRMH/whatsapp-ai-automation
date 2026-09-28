import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { getSetting } from "./settings";
import { SettingsKeys, SettingsDefaults } from "./settings-keys";
import { logger } from "@/lib/logger";

/**
 * Usage counters and rate limiting (PRD 45, 45.1, 33.17, 33.22). No Redis
 * for V1 - lightweight Postgres counters via atomic RPCs defined in
 * 0003_usage_and_rate_limit_functions.sql, so concurrent webhook
 * deliveries cannot race past a limit.
 */

const INBOUND_MSG_BUCKET = "inbound_msg";

/**
 * Atomically increments today's AI request count (in the user's local
 * timezone, so the daily limit resets at local midnight per PRD 45.1) and
 * returns whether the call is allowed under MAX_AI_REQUESTS_PER_USER_PER_DAY.
 */
export async function checkAndIncrementDailyAiRequests(
  userId: string,
  userTimezone: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const db = getSupabaseAdminClient();
  const usageDate = DateTime.now().setZone(userTimezone).toISODate();

  const { data, error } = await db.rpc("increment_daily_ai_requests", {
    p_user_id: userId,
    p_usage_date: usageDate,
  });

  if (error) {
    logger.error("usage_increment_failed", { errorCode: error.code });
    throw new Error(`Failed to increment daily AI usage: ${error.message}`);
  }

  const count = data as number;
  const limit = await getSetting<number>(
    SettingsKeys.MAX_AI_REQUESTS_PER_USER_PER_DAY,
    SettingsDefaults.MAX_AI_REQUESTS_PER_USER_PER_DAY
  );

  return { allowed: count <= limit, count, limit };
}

/**
 * Atomically increments the current UTC-minute inbound-message counter
 * for a user and returns whether this message is within
 * MAX_INBOUND_MESSAGES_PER_USER_PER_MINUTE. Per PRD 45.1: "Send the
 * rate-limit message at most once per window: reply only when the
 * returned count equals limit + 1" - callers should use
 * `shouldNotifyLimitReached` to decide whether to send the rate-limited
 * reply for this particular hit.
 */
export async function checkAndIncrementInboundRateLimit(
  userId: string
): Promise<{ allowed: boolean; shouldNotifyLimitReached: boolean; count: number; limit: number }> {
  const db = getSupabaseAdminClient();
  const windowStart = DateTime.utc().startOf("minute").toISO();

  const { data, error } = await db.rpc("rate_limit_hit", {
    p_user_id: userId,
    p_bucket: INBOUND_MSG_BUCKET,
    p_window_start: windowStart,
  });

  if (error) {
    logger.error("rate_limit_increment_failed", { errorCode: error.code });
    throw new Error(`Failed to check inbound rate limit: ${error.message}`);
  }

  const count = data as number;
  const limit = await getSetting<number>(
    SettingsKeys.MAX_INBOUND_MESSAGES_PER_USER_PER_MINUTE,
    SettingsDefaults.MAX_INBOUND_MESSAGES_PER_USER_PER_MINUTE
  );

  return {
    allowed: count <= limit,
    shouldNotifyLimitReached: count === limit + 1,
    count,
    limit,
  };
}

/** Atomically increments today's AI token counters (PRD 33.17, 45.1). */
export async function incrementDailyAiTokens(
  userId: string,
  userTimezone: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const db = getSupabaseAdminClient();
  const usageDate = DateTime.now().setZone(userTimezone).toISODate();

  const { error } = await db.rpc("increment_daily_ai_tokens", {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
  });

  if (error) {
    logger.error("usage_ai_tokens_increment_failed", { errorCode: error.code });
    throw new Error(`Failed to increment AI token usage: ${error.message}`);
  }
}

/** Atomically increments a non-AI usage counter for today (PRD 33.17). */
export async function incrementUsageCounter(
  userId: string,
  userTimezone: string,
  counter: "inbound_messages" | "outbound_messages" | "google_requests" | "reminders_sent",
  amount = 1
): Promise<void> {
  const db = getSupabaseAdminClient();
  const usageDate = DateTime.now().setZone(userTimezone).toISODate();

  const { error } = await db.rpc("increment_usage_counter", {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_counter: counter,
    p_amount: amount,
  });

  if (error) {
    logger.error("usage_counter_increment_failed", { errorCode: error.code });
    throw new Error(`Failed to increment usage counter: ${error.message}`);
  }
}

export interface UsageDailyRecord {
  usageDate: string;
  inboundMessages: number;
  outboundMessages: number;
  aiRequests: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  googleRequests: number;
  remindersSent: number;
}

/** Returns per-day usage rows for a user, most recent first (admin dashboard). */
export async function getUsageHistory(
  userId: string,
  limit = 30
): Promise<UsageDailyRecord[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("usage_daily")
    .select()
    .eq("user_id", userId)
    .order("usage_date", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("usage_history_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read usage history: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    usageDate: row.usage_date,
    inboundMessages: row.inbound_messages,
    outboundMessages: row.outbound_messages,
    aiRequests: row.ai_requests,
    aiInputTokens: row.ai_input_tokens,
    aiOutputTokens: row.ai_output_tokens,
    googleRequests: row.google_requests,
    remindersSent: row.reminders_sent,
  }));
}
