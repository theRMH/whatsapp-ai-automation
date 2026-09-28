import { getSetting } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { getUserById, getUserKeyRecord } from "@/lib/db/repositories/users";
import {
  claimNextInboundJob,
  markJobDone,
  markJobFailed,
  markJobSideEffectsStarted,
} from "@/lib/db/repositories/inbound-jobs";
import { recordConversationTurn } from "@/lib/db/repositories/conversation-turns";
import { incrementUsageCounter } from "@/lib/db/repositories/usage";
import { getEvolutionAdapter } from "@/lib/whatsapp/evolution-adapter";
import { runAssistantTurn } from "@/lib/ai/orchestrator";
import { logger } from "@/lib/logger";

/**
 * Inbound job worker (PRD 36.2.2): claims and runs steps 12-17 of the
 * pipeline for one user's queued jobs in order, one at a time, until
 * there are none left or an unexpected error occurs.
 */
export async function processInboundJobs(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    logger.error("inbound_job_process_missing_user", { userId });
    return;
  }

  const userKeyRecord = await getUserKeyRecord(userId);
  if (!userKeyRecord) {
    logger.error("inbound_job_process_missing_key", { userId });
    return;
  }

  const lockSeconds = await getSetting<number>(
    SettingsKeys.INBOUND_JOB_TIMEOUT_SECONDS,
    SettingsDefaults.INBOUND_JOB_TIMEOUT_SECONDS
  );

  // Loop while there are more queued jobs for this user; claimNextInboundJob
  // refuses to claim if a job for this user is already PROCESSING, which
  // cannot happen here since we hold that slot for the loop's duration.
  for (;;) {
    const job = await claimNextInboundJob(userId, lockSeconds, userKeyRecord);
    if (!job) return;

    try {
      await runJob(userId, job, userKeyRecord);
      await markJobDone(job.id);
    } catch (err) {
      const errorCode = err instanceof Error ? err.name : "UNKNOWN_ERROR";
      logger.error("inbound_job_failed", { userId, jobId: job.id, errorCode });

      if (job.sideEffectsStarted) {
        // PRD 36.2.3: never re-run the AI turn after a mutating tool ran.
        await markJobFailed(job.id, errorCode, false);
        await sendGenericFailureOnce(user.phoneE164);
      } else {
        const retryable = job.attempts < 3;
        await markJobFailed(job.id, errorCode, retryable);
        if (!retryable) {
          await sendGenericFailureOnce(user.phoneE164);
        }
      }
    }
  }
}

async function runJob(
  userId: string,
  job: { id: string; payload: { type: string; text?: string } | null },
  userKeyRecord: Awaited<ReturnType<typeof getUserKeyRecord>>
): Promise<void> {
  if (!job.payload || !userKeyRecord) return;

  const user = await getUserById(userId);
  if (!user) return;

  if (job.payload.text) {
    await recordConversationTurn({
      userId,
      direction: "INBOUND",
      content: job.payload.text,
      userKeyRecord,
    });
  }

  const markSideEffectsStarted = () => markJobSideEffectsStarted(job.id);

  const replyText =
    job.payload.type === "text" && job.payload.text
      ? (await runAssistantTurn(user, userKeyRecord, job.payload.text, markSideEffectsStarted)).replyText
      : "I received your file, but media handling isn't wired up yet.";

  const adapter = await getEvolutionAdapter();
  await markJobSideEffectsStarted(job.id);
  const result = await adapter.sendText(user.phoneE164, replyText);

  if (!result.success) {
    throw new Error(result.errorCode ?? "EVOLUTION_SEND_FAILED");
  }

  await recordConversationTurn({
    userId,
    direction: "OUTBOUND",
    content: replyText,
    userKeyRecord,
  });

  await incrementUsageCounter(userId, user.timezone, "outbound_messages");
}

async function sendGenericFailureOnce(phoneE164: string): Promise<void> {
  try {
    const message = await getSetting<string>(
      SettingsKeys.MESSAGE_GENERIC_FAILURE,
      SettingsDefaults.MESSAGE_GENERIC_FAILURE
    );
    const adapter = await getEvolutionAdapter();
    await adapter.sendText(phoneE164, message);
  } catch (err) {
    logger.error("generic_failure_reply_send_failed", {
      errorCode: err instanceof Error ? err.name : "unknown",
    });
  }
}
