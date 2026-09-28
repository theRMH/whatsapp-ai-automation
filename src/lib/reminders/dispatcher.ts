import { DateTime } from "luxon";
import { getSetting } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { getUserById, getUserKeyRecord } from "@/lib/db/repositories/users";
import { getTaskById } from "@/lib/db/repositories/tasks";
import {
  claimDueReminders,
  markReminderSent,
  markReminderFailed,
  markReminderCancelled,
  markReminderIneligible,
  type ClaimedReminder,
} from "@/lib/db/repositories/reminders";
import { isUserAllowedByStatusAndTrial } from "@/lib/security/access-control";
import { getEvolutionAdapter } from "@/lib/whatsapp/evolution-adapter";
import { logger } from "@/lib/logger";

/**
 * Reminder dispatcher (PRD 13, 73). Called every minute by Supabase Cron
 * via /api/internal/reminders/dispatch. Claims a batch of due reminders
 * (the claim RPC also marks stale PENDING reminders MISSED per PRD 13.6
 * rule 1), then for each claimed reminder: verifies the user/task are
 * still eligible, sends the WhatsApp message, and records the outcome.
 *
 * Retry policy (PRD 13.3): 1 immediate attempt + retries after 1/5/15
 * minutes, then final FAILED. A retry whose target time would fall past
 * scheduled_at + grace period is instead marked FAILED immediately (PRD
 * 13.6 rule 3) rather than scheduled past the point it could be useful.
 */

const LOCK_SECONDS = 90;

export interface DispatchSummary {
  claimed: number;
  sent: number;
  failed: number;
  cancelled: number;
  skippedIneligible: number;
}

export async function dispatchDueReminders(): Promise<DispatchSummary> {
  const dispatcherEnabled = await getSetting<boolean>(
    SettingsKeys.REMINDER_DISPATCHER_ENABLED,
    SettingsDefaults.REMINDER_DISPATCHER_ENABLED
  );
  if (!dispatcherEnabled) {
    return { claimed: 0, sent: 0, failed: 0, cancelled: 0, skippedIneligible: 0 };
  }

  const [batchSize, missedGraceMinutes, maxRetryAttempts, retryDelaysMinutes] = await Promise.all([
    getSetting<number>(SettingsKeys.REMINDER_BATCH_SIZE, SettingsDefaults.REMINDER_BATCH_SIZE),
    getSetting<number>(
      SettingsKeys.REMINDER_MISSED_GRACE_PERIOD_MINUTES,
      SettingsDefaults.REMINDER_MISSED_GRACE_PERIOD_MINUTES
    ),
    getSetting<number>(SettingsKeys.REMINDER_MAX_RETRY_ATTEMPTS, SettingsDefaults.REMINDER_MAX_RETRY_ATTEMPTS),
    getSetting<number[]>(SettingsKeys.REMINDER_RETRY_DELAYS_MINUTES, [
      ...SettingsDefaults.REMINDER_RETRY_DELAYS_MINUTES,
    ]),
  ]);

  const claimed = await claimDueReminders(batchSize, missedGraceMinutes, LOCK_SECONDS);

  const summary: DispatchSummary = { claimed: claimed.length, sent: 0, failed: 0, cancelled: 0, skippedIneligible: 0 };

  for (const reminder of claimed) {
    const outcome = await dispatchOne(reminder, missedGraceMinutes, maxRetryAttempts, retryDelaysMinutes);
    summary[outcome]++;
  }

  logger.info("reminder_dispatch_completed", { ...summary });

  return summary;
}

type Outcome = "sent" | "failed" | "cancelled" | "skippedIneligible";

async function dispatchOne(
  reminder: ClaimedReminder,
  missedGraceMinutes: number,
  maxRetryAttempts: number,
  retryDelaysMinutes: number[]
): Promise<Outcome> {
  try {
    // PRD 13.4: before sending, re-verify user exists/active, trial valid,
    // task not cancelled/completed - never trust state captured at claim time.
    const user = await getUserById(reminder.userId);
    if (!user) {
      await markReminderCancelled(reminder.id);
      return "cancelled";
    }

    const denialReason = isUserAllowedByStatusAndTrial(user);
    if (denialReason) {
      // PRD 13.6 rule 2: leave PENDING - the claim RPC will mark it MISSED
      // once the grace period elapses, or it will be retried by then if
      // the user becomes eligible again in time.
      await markReminderIneligible(reminder.id, denialReason);
      return "skippedIneligible";
    }

    if (!reminder.taskId) {
      // Standalone/series reminders are not yet supported (Milestone 7+).
      await markReminderCancelled(reminder.id);
      return "cancelled";
    }

    const userKeyRecord = await getUserKeyRecord(reminder.userId);
    if (!userKeyRecord) {
      await markReminderFailed(reminder.id, "MISSING_USER_KEY", null);
      return "failed";
    }

    const task = await getTaskById(reminder.taskId, reminder.userId, userKeyRecord);
    if (!task || task.status !== "PENDING") {
      await markReminderCancelled(reminder.id);
      return "cancelled";
    }

    const adapter = await getEvolutionAdapter();
    const result = await adapter.sendText(user.phoneE164, `Reminder: ${task.title}.`);

    if (!result.success) {
      const retryAt = computeRetryAt(reminder.attempts, maxRetryAttempts, retryDelaysMinutes, reminder.scheduledAt, missedGraceMinutes);
      await markReminderFailed(reminder.id, result.errorCode ?? "EVOLUTION_SEND_FAILED", retryAt);
      return "failed";
    }

    await markReminderSent(reminder.id);
    return "sent";
  } catch (err) {
    const errorCode = err instanceof Error ? err.name : "UNKNOWN_ERROR";
    logger.error("reminder_dispatch_one_failed", { reminderId: reminder.id, errorCode });
    try {
      const retryAt = computeRetryAt(
        reminder.attempts,
        maxRetryAttempts,
        retryDelaysMinutes,
        reminder.scheduledAt,
        missedGraceMinutes
      );
      await markReminderFailed(reminder.id, errorCode, retryAt);
    } catch {
      // best-effort; the stale-processing reclaim sweep will pick this up
    }
    return "failed";
  }
}

/**
 * Returns the next retry timestamp, or null for a final failure. Never
 * retries (PRD 13.3: max attempts) or past the missed-reminder grace
 * window relative to the original scheduled_at (PRD 13.6 rule 3).
 */
function computeRetryAt(
  attemptsSoFar: number,
  maxRetryAttempts: number,
  retryDelaysMinutes: number[],
  scheduledAt: string,
  missedGraceMinutes: number
): string | null {
  const retryIndex = attemptsSoFar - 1;
  if (retryIndex >= maxRetryAttempts || retryIndex >= retryDelaysMinutes.length) {
    return null;
  }

  const delayMinutes = retryDelaysMinutes[retryIndex];
  const retryAt = DateTime.utc().plus({ minutes: delayMinutes });
  const graceDeadline = DateTime.fromISO(scheduledAt, { zone: "utc" }).plus({ minutes: missedGraceMinutes });

  if (retryAt > graceDeadline) {
    return null;
  }

  return retryAt.toISO();
}
