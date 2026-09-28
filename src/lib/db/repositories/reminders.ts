import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * Reminder repository (PRD 13, 33.9, 33.9.1). The reminders table holds no
 * user content (no _enc columns) - only structural/timing metadata - so no
 * encryption context is needed here. Task/reminder text is read from the
 * tasks repository (encrypted) only at dispatch time, for exactly the
 * claimed reminder's task (PRD 73: "The server then retrieves/decrypts
 * task text for only the claimed user's reminder.").
 */

export type ReminderStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED" | "MISSED";

export interface ReminderRecord {
  id: string;
  userId: string;
  taskId: string | null;
  seriesId: string | null;
  scheduledAt: string;
  status: ReminderStatus;
  attempts: number;
  nextAttemptAt: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
}

interface ReminderRow {
  id: string;
  user_id: string;
  task_id: string | null;
  series_id: string | null;
  scheduled_at: string;
  status: ReminderStatus;
  attempts: number;
  next_attempt_at: string | null;
  sent_at: string | null;
  last_error_code: string | null;
}

function toReminderRecord(row: ReminderRow): ReminderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    seriesId: row.series_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    lastErrorCode: row.last_error_code,
  };
}

const REMINDER_COLUMNS =
  "id, user_id, task_id, series_id, scheduled_at, status, attempts, next_attempt_at, sent_at, last_error_code";

/**
 * Atomically (re)schedules a task's primary reminder: cancels any existing
 * PENDING/PROCESSING reminder for the task, bumps tasks.reminder_revision,
 * and inserts a new PENDING reminder keyed task:<task_id>:v<revision> (PRD
 * 33.9.1). Used both when a task is first created with a due date and
 * whenever it is rescheduled/snoozed.
 */
export async function setTaskReminder(
  taskId: string,
  userId: string,
  scheduledAt: string
): Promise<{ reminderId: string; revision: number }> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("set_task_reminder", {
    p_task_id: taskId,
    p_user_id: userId,
    p_scheduled_at: scheduledAt,
  });

  if (error) {
    logger.error("reminder_set_task_reminder_failed", { errorCode: error.code });
    throw new Error(`Failed to set task reminder: ${error.message}`);
  }

  const rows = data as { reminder_id: string; revision: number }[] | null;
  if (!rows || rows.length === 0) {
    throw new Error("set_task_reminder returned no row");
  }

  return { reminderId: rows[0].reminder_id, revision: rows[0].revision };
}

/** Cancels all active (PENDING/PROCESSING) reminders for a task (PRD 13.6 rule 4). */
export async function cancelTaskReminders(taskId: string): Promise<string[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("cancel_task_reminders", { p_task_id: taskId });

  if (error) {
    logger.error("reminder_cancel_task_reminders_failed", { errorCode: error.code });
    throw new Error(`Failed to cancel task reminders: ${error.message}`);
  }

  return (data as { cancel_task_reminders: string }[] | string[] | null)?.map((r) =>
    typeof r === "string" ? r : r.cancel_task_reminders
  ) ?? [];
}

export interface ClaimedReminder {
  id: string;
  userId: string;
  taskId: string | null;
  seriesId: string | null;
  scheduledAt: string;
  attempts: number;
}

/**
 * Claims up to batchSize due reminders for dispatch (PRD 73). Also marks
 * stale PENDING reminders MISSED as a side effect (PRD 13.6 rule 1). Uses
 * FOR UPDATE SKIP LOCKED under the hood so concurrent dispatcher runs
 * never double-send.
 */
export async function claimDueReminders(
  batchSize: number,
  missedGraceMinutes: number,
  lockSeconds: number
): Promise<ClaimedReminder[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("claim_due_reminders", {
    p_batch_size: batchSize,
    p_missed_grace_minutes: missedGraceMinutes,
    p_lock_seconds: lockSeconds,
  });

  if (error) {
    logger.error("reminder_claim_due_failed", { errorCode: error.code });
    throw new Error(`Failed to claim due reminders: ${error.message}`);
  }

  type ClaimedRow = {
    out_id: string;
    out_user_id: string;
    out_task_id: string | null;
    out_series_id: string | null;
    out_scheduled_at: string;
    out_attempts: number;
  };

  return ((data as ClaimedRow[] | null) ?? []).map((row) => ({
    id: row.out_id,
    userId: row.out_user_id,
    taskId: row.out_task_id,
    seriesId: row.out_series_id,
    scheduledAt: row.out_scheduled_at,
    attempts: row.out_attempts,
  }));
}

export async function markReminderSent(reminderId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("reminders")
    .update({ status: "SENT", sent_at: now, updated_at: now })
    .eq("id", reminderId);

  if (error) {
    logger.error("reminder_mark_sent_failed", { errorCode: error.code });
    throw new Error(`Failed to mark reminder sent: ${error.message}`);
  }
}

/**
 * Marks a claimed reminder FAILED. If retryable and nextAttemptAt is
 * still within the grace window (checked by the caller per PRD 13.6 rule
 * 3), it goes back to PENDING with next_attempt_at set so the next
 * dispatcher pass picks it up again; otherwise it is a final FAILED.
 */
export async function markReminderFailed(
  reminderId: string,
  errorCode: string,
  retryAt: string | null
): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("reminders")
    .update({
      status: retryAt ? "PENDING" : "FAILED",
      next_attempt_at: retryAt,
      scheduled_at: retryAt ?? undefined,
      last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) {
    logger.error("reminder_mark_failed_failed", { errorCode: error.code });
    throw new Error(`Failed to mark reminder failed: ${error.message}`);
  }
}

/**
 * Reverts a claimed reminder back to PENDING without consuming a retry
 * attempt or moving scheduled_at (PRD 13.6 rule 2: an ineligible user's
 * reminder stays PENDING - the claim RPC's own grace-period check is what
 * eventually turns it MISSED, not the dispatcher's retry/backoff policy).
 */
export async function markReminderIneligible(reminderId: string, reasonCode: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("reminders")
    .update({ status: "PENDING", last_error_code: reasonCode, updated_at: new Date().toISOString() })
    .eq("id", reminderId);

  if (error) {
    logger.error("reminder_mark_ineligible_failed", { errorCode: error.code });
    throw new Error(`Failed to mark reminder ineligible: ${error.message}`);
  }
}

/** Marks a claimed reminder CANCELLED (task was completed/cancelled between claim and send). */
export async function markReminderCancelled(reminderId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("reminders")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", reminderId);

  if (error) {
    logger.error("reminder_mark_cancelled_failed", { errorCode: error.code });
    throw new Error(`Failed to mark reminder cancelled: ${error.message}`);
  }
}

/** Recovery sweep: reclaims reminders stuck PROCESSING past a lock timeout. */
export async function reclaimStaleProcessingReminders(lockTimeoutMinutes: number): Promise<string[]> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("reclaim_stale_processing_reminders", {
    p_lock_timeout_minutes: lockTimeoutMinutes,
  });

  if (error) {
    logger.error("reminder_reclaim_stale_failed", { errorCode: error.code });
    throw new Error(`Failed to reclaim stale reminders: ${error.message}`);
  }

  return (data as { reclaim_stale_processing_reminders: string }[] | string[] | null)?.map((r) =>
    typeof r === "string" ? r : r.reclaim_stale_processing_reminders
  ) ?? [];
}

export async function getReminderById(reminderId: string): Promise<ReminderRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("reminders").select(REMINDER_COLUMNS).eq("id", reminderId).maybeSingle();

  if (error) {
    logger.error("reminder_get_by_id_failed", { errorCode: error.code });
    throw new Error(`Failed to get reminder: ${error.message}`);
  }

  return data ? toReminderRecord(data as ReminderRow) : null;
}
