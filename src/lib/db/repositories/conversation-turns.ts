import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { userEncryptionContext, type UserKeyRecord } from "@/lib/crypto/user-encryption";
import { getSetting } from "./settings";
import { SettingsKeys, SettingsDefaults } from "./settings-keys";
import { logger } from "@/lib/logger";

/**
 * Small encrypted rolling conversation context (PRD 16, 33.6) - not an
 * unlimited chat archive. Only the pipeline reads this, to let the
 * assistant resolve references like "actually make it 11". The admin
 * dashboard only ever sees counts (PRD 16: "never message text").
 */

export type TurnDirection = "INBOUND" | "OUTBOUND";

export interface ConversationTurn {
  id: string;
  direction: TurnDirection;
  content: string;
  createdAt: string;
}

export async function recordConversationTurn(input: {
  userId: string;
  direction: TurnDirection;
  content: string;
  messageIdHash?: string;
  userKeyRecord: UserKeyRecord;
}): Promise<void> {
  const retentionDays = await getSetting<number>(
    SettingsKeys.RETENTION_CONVERSATION_DAYS,
    SettingsDefaults.RETENTION_CONVERSATION_DAYS
  );
  const { encrypt } = userEncryptionContext(input.userKeyRecord);

  const db = getSupabaseAdminClient();
  const { error } = await db.from("conversation_turns").insert({
    user_id: input.userId,
    direction: input.direction,
    content_enc: encrypt(input.content),
    message_id_hash: input.messageIdHash ?? null,
    expires_at: DateTime.utc().plus({ days: retentionDays }).toISO(),
  });

  if (error) {
    logger.error("conversation_turn_write_failed", { errorCode: error.code });
    throw new Error(`Failed to record conversation turn: ${error.message}`);
  }

  await trimOldTurns(input.userId);
}

/** Keeps only the most recent RETENTION_MAX_RECENT_TURNS rows for a user (PRD 16). */
async function trimOldTurns(userId: string): Promise<void> {
  const maxTurns = await getSetting<number>(
    SettingsKeys.RETENTION_MAX_RECENT_TURNS,
    SettingsDefaults.RETENTION_MAX_RECENT_TURNS
  );

  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("conversation_turns")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(maxTurns, maxTurns + 500);

  if (error) {
    logger.error("conversation_turn_trim_read_failed", { errorCode: error.code });
    return;
  }

  const idsToDelete = (data ?? []).map((row) => row.id as string);
  if (idsToDelete.length === 0) return;

  const { error: deleteError } = await db.from("conversation_turns").delete().in("id", idsToDelete);
  if (deleteError) {
    logger.error("conversation_turn_trim_delete_failed", { errorCode: deleteError.code });
  }
}

/** Returns the most recent turns for a user, oldest first, for AI context (PRD 16, 38). */
export async function getRecentConversationTurns(
  userId: string,
  userKeyRecord: UserKeyRecord,
  limit?: number
): Promise<ConversationTurn[]> {
  const effectiveLimit =
    limit ??
    (await getSetting<number>(SettingsKeys.RETENTION_MAX_RECENT_TURNS, SettingsDefaults.RETENTION_MAX_RECENT_TURNS));

  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("conversation_turns")
    .select("id, direction, content_enc, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(effectiveLimit);

  if (error) {
    logger.error("conversation_turn_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read conversation turns: ${error.message}`);
  }

  const { decrypt } = userEncryptionContext(userKeyRecord);
  return (data ?? [])
    .map((row) => ({
      id: row.id as string,
      direction: row.direction as TurnDirection,
      content: decrypt(row.content_enc as string),
      createdAt: row.created_at as string,
    }))
    .reverse();
}

/** Admin-safe count only (PRD 16: "admin dashboard only shows counts, never message text"). */
export async function countConversationTurns(userId: string): Promise<number> {
  const db = getSupabaseAdminClient();
  const { count, error } = await db
    .from("conversation_turns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    logger.error("conversation_turn_count_failed", { errorCode: error.code });
    throw new Error(`Failed to count conversation turns: ${error.message}`);
  }

  return count ?? 0;
}
