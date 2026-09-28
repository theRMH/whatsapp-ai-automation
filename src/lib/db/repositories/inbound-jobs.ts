import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { userEncryptionContext, type UserKeyRecord } from "@/lib/crypto/user-encryption";
import { logger } from "@/lib/logger";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/types";

/**
 * Inbound job queue (PRD 33.23, 36.2). Holds only the normalized fields
 * the pipeline needs, encrypted with the user's DEK, never the raw
 * webhook body (PRD 36.2.4).
 */

interface EncryptedJobPayload {
  type: NormalizedInboundMessage["type"];
  text?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  mediaUrl?: string;
  mediaReference?: string;
  providerMessageKey?: unknown;
  timestamp: string;
}

export interface InboundJob {
  id: string;
  messageIdHash: string;
  payload: EncryptedJobPayload | null;
  attempts: number;
  sideEffectsStarted: boolean;
  receivedAt: string;
}

export async function enqueueInboundJob(input: {
  userId: string;
  messageIdHash: string;
  message: NormalizedInboundMessage;
  userKeyRecord: UserKeyRecord;
}): Promise<void> {
  const { encrypt } = userEncryptionContext(input.userKeyRecord);

  const payload: EncryptedJobPayload = {
    type: input.message.type,
    text: input.message.text,
    caption: input.message.caption,
    filename: input.message.filename,
    mimeType: input.message.mimeType,
    mediaUrl: input.message.mediaUrl,
    mediaReference: input.message.mediaReference,
    providerMessageKey: input.message.providerMessageKey,
    timestamp: input.message.timestamp.toISOString(),
  };

  const payloadEnc = encrypt(JSON.stringify(payload));

  const db = getSupabaseAdminClient();
  const { error } = await db.from("inbound_jobs").insert({
    user_id: input.userId,
    message_id_hash: input.messageIdHash,
    payload_enc: payloadEnc,
    status: "QUEUED",
    received_at: input.message.timestamp.toISOString(),
  });

  if (error) {
    logger.error("inbound_job_enqueue_failed", { errorCode: error.code });
    throw new Error(`Failed to enqueue inbound job: ${error.message}`);
  }
}

interface ClaimedJobRow {
  id: string;
  message_id_hash: string;
  payload_enc: string | null;
  attempts: number;
  side_effects_started: boolean;
  received_at: string;
}

/**
 * Claims the oldest QUEUED job for a user via the claim_next_inbound_job
 * RPC (FOR UPDATE SKIP LOCKED), decrypting its payload with the user's
 * DEK. Returns null if there is no eligible job (PRD 36.2.2).
 */
export async function claimNextInboundJob(
  userId: string,
  lockSeconds: number,
  userKeyRecord: UserKeyRecord
): Promise<InboundJob | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("claim_next_inbound_job", {
    p_user_id: userId,
    p_lock_seconds: lockSeconds,
  });

  if (error) {
    logger.error("inbound_job_claim_failed", { errorCode: error.code });
    throw new Error(`Failed to claim inbound job: ${error.message}`);
  }

  const rows = data as ClaimedJobRow[] | null;
  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const { decrypt } = userEncryptionContext(userKeyRecord);
  const payload = row.payload_enc ? (JSON.parse(decrypt(row.payload_enc)) as EncryptedJobPayload) : null;

  return {
    id: row.id,
    messageIdHash: row.message_id_hash,
    payload,
    attempts: row.attempts,
    sideEffectsStarted: row.side_effects_started,
    receivedAt: row.received_at,
  };
}

export async function markJobSideEffectsStarted(jobId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("inbound_jobs")
    .update({ side_effects_started: true, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    logger.error("inbound_job_mark_side_effects_failed", { errorCode: error.code });
  }
}

export async function markJobDone(jobId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("inbound_jobs")
    .update({ status: "DONE", payload_enc: null, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    logger.error("inbound_job_mark_done_failed", { errorCode: error.code });
    throw new Error(`Failed to mark job done: ${error.message}`);
  }
}

export async function markJobFailed(jobId: string, errorCode: string, retryable: boolean): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("inbound_jobs")
    .update({
      status: retryable ? "QUEUED" : "FAILED",
      payload_enc: retryable ? undefined : null,
      last_error_code: errorCode,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    logger.error("inbound_job_mark_failed_failed", { errorCode: error.code });
    throw new Error(`Failed to mark job failed: ${error.message}`);
  }
}

/** Recovery sweep (PRD 36.2.3): reclaims expired PROCESSING locks. */
export async function reclaimStaleProcessingJobs(): Promise<string[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("reclaim_stale_processing_jobs");

  if (error) {
    logger.error("inbound_job_reclaim_failed", { errorCode: error.code });
    throw new Error(`Failed to reclaim stale jobs: ${error.message}`);
  }

  return (data as { reclaim_stale_processing_jobs: string }[] | string[] | null)?.map((r) =>
    typeof r === "string" ? r : r.reclaim_stale_processing_jobs
  ) ?? [];
}

/** Marks QUEUED jobs older than the cutoff as FAILED without processing (PRD 36.2.3). */
export async function failStaleQueuedJobs(cutoffMinutes: number): Promise<string[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("fail_stale_queued_jobs", { p_cutoff_minutes: cutoffMinutes });

  if (error) {
    logger.error("inbound_job_fail_stale_failed", { errorCode: error.code });
    throw new Error(`Failed to fail stale jobs: ${error.message}`);
  }

  return (data as { fail_stale_queued_jobs: string }[] | string[] | null)?.map((r) =>
    typeof r === "string" ? r : r.fail_stale_queued_jobs
  ) ?? [];
}

/** Distinct user ids with a QUEUED job older than the given age (PRD 36.2.3). */
export async function listUsersWithStaleQueuedJobs(minAgeSeconds: number): Promise<string[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("list_stale_queued_job_users", { p_min_age_seconds: minAgeSeconds });

  if (error) {
    logger.error("inbound_job_list_stale_users_failed", { errorCode: error.code });
    throw new Error(`Failed to list stale job users: ${error.message}`);
  }

  return (data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? [];
}
