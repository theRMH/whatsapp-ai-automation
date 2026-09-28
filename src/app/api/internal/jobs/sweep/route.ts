import { getSetting } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import {
  reclaimStaleProcessingJobs,
  failStaleQueuedJobs,
  listUsersWithStaleQueuedJobs,
} from "@/lib/db/repositories/inbound-jobs";
import { reclaimStaleProcessingReminders } from "@/lib/db/repositories/reminders";
import { processInboundJobs } from "@/lib/pipeline/process-inbound-jobs";
import { isAuthorizedInternalRequest } from "@/lib/security/internal-auth";
import { logger } from "@/lib/logger";

/**
 * Recovery sweeper (PRD 36.2.3). Called every minute by Supabase Cron.
 * Reclaims PROCESSING jobs whose lock expired, fails jobs older than the
 * stale cutoff, then processes any remaining QUEUED jobs older than 30s
 * (covers the case where the webhook's after() callback never ran). Also
 * reclaims reminders stuck PROCESSING past their lock timeout (e.g. a
 * dispatch run that crashed mid-batch), returning them to PENDING so the
 * next dispatch pass retries them.
 */

export const maxDuration = 60;

const STALE_QUEUED_MIN_AGE_SECONDS = 30;
const REMINDER_STALE_PROCESSING_MINUTES = 5;

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedInternalRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const reclaimed = await reclaimStaleProcessingJobs();
  const reclaimedReminders = await reclaimStaleProcessingReminders(REMINDER_STALE_PROCESSING_MINUTES);

  const staleCutoffMinutes = await getSetting<number>(
    SettingsKeys.STALE_INBOUND_JOB_CUTOFF_MINUTES,
    SettingsDefaults.STALE_INBOUND_JOB_CUTOFF_MINUTES
  );
  const failedStale = await failStaleQueuedJobs(staleCutoffMinutes);

  const userIds = await listUsersWithStaleQueuedJobs(STALE_QUEUED_MIN_AGE_SECONDS);
  for (const userId of userIds) {
    try {
      await processInboundJobs(userId);
    } catch (err) {
      logger.error("job_sweep_process_failed", {
        userId,
        errorCode: err instanceof Error ? err.name : "unknown",
      });
    }
  }

  logger.info("job_sweep_completed", {
    reclaimedCount: reclaimed.length,
    reclaimedReminderCount: reclaimedReminders.length,
    failedStaleCount: failedStale.length,
    processedUserCount: userIds.length,
  });

  return Response.json({
    reclaimed: reclaimed.length,
    reclaimedReminders: reclaimedReminders.length,
    failedStale: failedStale.length,
    processedUsers: userIds.length,
  });
}
