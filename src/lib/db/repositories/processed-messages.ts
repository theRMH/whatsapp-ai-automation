import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * Webhook idempotency ledger (PRD 33.5, 68). Keyed by a hash of the
 * provider message id, never the raw id or webhook body.
 */

export type ProcessedMessageStatus = "IGNORED" | "UNAUTHORIZED" | "DENIED" | "QUEUED" | "PROCESSED";

/** Returns true if this message hash has already been recorded (PRD 68). */
export async function wasMessageProcessed(messageIdHash: string): Promise<boolean> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("processed_messages")
    .select("message_id_hash")
    .eq("message_id_hash", messageIdHash)
    .maybeSingle();

  if (error) {
    logger.error("processed_messages_read_failed", { errorCode: error.code });
    throw new Error(`Failed to check processed message: ${error.message}`);
  }

  return !!data;
}

/**
 * Records a message hash as seen. Uses upsert with ignoreDuplicates so a
 * race between two concurrent deliveries of the same message id cannot
 * throw a unique-violation error up to the caller.
 */
export async function recordProcessedMessage(input: {
  messageIdHash: string;
  userId: string | null;
  eventType: string;
  status: ProcessedMessageStatus;
}): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from("processed_messages").upsert(
    {
      message_id_hash: input.messageIdHash,
      user_id: input.userId,
      event_type: input.eventType,
      status: input.status,
    },
    { onConflict: "message_id_hash", ignoreDuplicates: true }
  );

  if (error) {
    logger.error("processed_messages_write_failed", { errorCode: error.code });
    throw new Error(`Failed to record processed message: ${error.message}`);
  }
}
