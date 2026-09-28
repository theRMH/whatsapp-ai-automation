import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { userEncryptionContext, type UserKeyRecord } from "@/lib/crypto/user-encryption";
import { logger } from "@/lib/logger";
import { setTaskReminder, cancelTaskReminders } from "@/lib/db/repositories/reminders";

/**
 * Task repository (PRD 11, 33.7). Titles/details are encrypted at rest
 * exactly like conversation turns; every function is scoped to a userId,
 * never exposing an unscoped getAllTasks().
 *
 * "Conversational references" (PRD 8.6, Milestone 5): the AI never sees or
 * invents a task's real id. Instead it passes a free-text `taskRef`
 * (e.g. "the dentist one", "the invoice task"), which findTaskByReference
 * resolves by decrypting and locally matching the user's own pending
 * tasks - content stays encrypted at rest and is never searched via SQL
 * LIKE (PRD: "do not weaken encryption merely to make V1 search easier").
 */

export type TaskCategory = "PERSONAL" | "PROFESSIONAL";
export type TaskStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface TaskRecord {
  id: string;
  title: string;
  details: string | null;
  category: TaskCategory;
  status: TaskStatus;
  dueAt: string | null;
  hasExplicitTime: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: string;
  title_enc: string;
  details_enc: string | null;
  category: TaskCategory;
  status: TaskStatus;
  due_at: string | null;
  has_explicit_time: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function toTaskRecord(row: TaskRow, decrypt: (value: string) => string): TaskRecord {
  return {
    id: row.id,
    title: decrypt(row.title_enc),
    details: row.details_enc ? decrypt(row.details_enc) : null,
    category: row.category,
    status: row.status,
    dueAt: row.due_at,
    hasExplicitTime: row.has_explicit_time,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TASK_COLUMNS =
  "id, title_enc, details_enc, category, status, due_at, has_explicit_time, completed_at, cancelled_at, created_at, updated_at";

export async function createTask(input: {
  userId: string;
  title: string;
  details?: string | null;
  category: TaskCategory;
  dueAt?: string | null;
  hasExplicitTime?: boolean;
  sourceMessageIdHash?: string | null;
  userKeyRecord: UserKeyRecord;
}): Promise<TaskRecord> {
  const { encrypt, decrypt } = userEncryptionContext(input.userKeyRecord);
  const db = getSupabaseAdminClient();

  const { data, error } = await db
    .from("tasks")
    .insert({
      user_id: input.userId,
      title_enc: encrypt(input.title),
      details_enc: input.details ? encrypt(input.details) : null,
      category: input.category,
      status: "PENDING",
      due_at: input.dueAt ?? null,
      has_explicit_time: input.hasExplicitTime ?? true,
      source_message_id_hash: input.sourceMessageIdHash ?? null,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error || !data) {
    logger.error("task_create_failed", { errorCode: error?.code });
    throw new Error(`Failed to create task: ${error?.message}`);
  }

  const task = toTaskRecord(data as TaskRow, decrypt);

  if (task.dueAt) {
    await setTaskReminder(task.id, input.userId, task.dueAt);
  }

  return task;
}

export type TaskWhenFilter = "OVERDUE" | "TODAY" | "TOMORROW" | "UPCOMING";

export async function listTasks(
  userId: string,
  userKeyRecord: UserKeyRecord,
  filter?: { status?: TaskStatus; category?: TaskCategory; when?: TaskWhenFilter; userTimezone?: string }
): Promise<TaskRecord[]> {
  const db = getSupabaseAdminClient();
  let query = db.from("tasks").select(TASK_COLUMNS).eq("user_id", userId);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.category) {
    query = query.eq("category", filter.category);
  }

  if (filter?.when) {
    const zone = filter.userTimezone ?? "UTC";
    const now = DateTime.now().setZone(zone);

    if (filter.when === "OVERDUE") {
      query = query.not("due_at", "is", null).lt("due_at", now.toISO());
    } else if (filter.when === "TODAY") {
      const start = now.startOf("day");
      const end = now.endOf("day");
      query = query.not("due_at", "is", null).gte("due_at", start.toISO()).lte("due_at", end.toISO());
    } else if (filter.when === "TOMORROW") {
      const start = now.plus({ days: 1 }).startOf("day");
      const end = now.plus({ days: 1 }).endOf("day");
      query = query.not("due_at", "is", null).gte("due_at", start.toISO()).lte("due_at", end.toISO());
    } else if (filter.when === "UPCOMING") {
      query = query.not("due_at", "is", null).gte("due_at", now.toISO());
    }
  }

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false });

  if (error) {
    logger.error("task_list_failed", { errorCode: error.code });
    throw new Error(`Failed to list tasks: ${error.message}`);
  }

  const { decrypt } = userEncryptionContext(userKeyRecord);
  return (data ?? []).map((row) => toTaskRecord(row as TaskRow, decrypt));
}

/**
 * Fetches a single task by id, scoped to its owning user (PRD: every
 * lookup must be user-scoped). Used by the reminder dispatcher (PRD 73:
 * "retrieves/decrypts task text for only the claimed user's reminder").
 */
export async function getTaskById(
  taskId: string,
  userId: string,
  userKeyRecord: UserKeyRecord
): Promise<TaskRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("task_get_by_id_failed", { errorCode: error.code });
    throw new Error(`Failed to get task: ${error.message}`);
  }

  if (!data) return null;

  const { decrypt } = userEncryptionContext(userKeyRecord);
  return toTaskRecord(data as TaskRow, decrypt);
}

/**
 * Resolves a free-text conversational reference (e.g. "the dentist one")
 * against the user's own PENDING tasks by decrypting and locally matching
 * on title/details substring (case-insensitive). Returns every match so
 * the caller can ask a clarifying question (PRD 8.6) when there's more
 * than one, instead of guessing.
 */
export async function findTasksByReference(
  userId: string,
  userKeyRecord: UserKeyRecord,
  reference: string
): Promise<TaskRecord[]> {
  const tasks = await listTasks(userId, userKeyRecord, { status: "PENDING" });
  const needle = reference.trim().toLowerCase();
  if (!needle) return [];

  return tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(needle) || (task.details?.toLowerCase().includes(needle) ?? false)
  );
}

export async function updateTask(
  userId: string,
  taskId: string,
  updates: {
    title?: string;
    details?: string | null;
    category?: TaskCategory;
    dueAt?: string | null;
    hasExplicitTime?: boolean;
  },
  userKeyRecord: UserKeyRecord
): Promise<TaskRecord> {
  const { encrypt, decrypt } = userEncryptionContext(userKeyRecord);
  const db = getSupabaseAdminClient();

  const patch: Record<string, unknown> = { updated_at: DateTime.utc().toISO() };
  if (updates.title !== undefined) patch.title_enc = encrypt(updates.title);
  if (updates.details !== undefined) patch.details_enc = updates.details ? encrypt(updates.details) : null;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.dueAt !== undefined) patch.due_at = updates.dueAt;
  if (updates.hasExplicitTime !== undefined) patch.has_explicit_time = updates.hasExplicitTime;

  const { data, error } = await db
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(TASK_COLUMNS)
    .single();

  if (error || !data) {
    logger.error("task_update_failed", { errorCode: error?.code });
    throw new Error(`Failed to update task: ${error?.message}`);
  }

  const task = toTaskRecord(data as TaskRow, decrypt);

  if (updates.dueAt !== undefined) {
    if (task.dueAt) {
      await setTaskReminder(task.id, userId, task.dueAt);
    } else {
      await cancelTaskReminders(task.id);
    }
  }

  return task;
}

async function setTaskStatus(
  userId: string,
  taskId: string,
  status: "COMPLETED" | "CANCELLED",
  userKeyRecord: UserKeyRecord
): Promise<TaskRecord> {
  const { decrypt } = userEncryptionContext(userKeyRecord);
  const db = getSupabaseAdminClient();
  const now = DateTime.utc().toISO();

  const patch: Record<string, unknown> =
    status === "COMPLETED" ? { status, completed_at: now, updated_at: now } : { status, cancelled_at: now, updated_at: now };

  const { data, error } = await db
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .select(TASK_COLUMNS)
    .single();

  if (error || !data) {
    logger.error("task_status_update_failed", { errorCode: error?.code, status });
    throw new Error(`Failed to set task status to ${status}: ${error?.message}`);
  }

  // PRD 13.6 rule 4: reminders for a completed/cancelled task are
  // cancelled, not left to fire or to become MISSED.
  await cancelTaskReminders(taskId);

  return toTaskRecord(data as TaskRow, decrypt);
}

export async function completeTask(userId: string, taskId: string, userKeyRecord: UserKeyRecord): Promise<TaskRecord> {
  return setTaskStatus(userId, taskId, "COMPLETED", userKeyRecord);
}

export async function cancelTask(userId: string, taskId: string, userKeyRecord: UserKeyRecord): Promise<TaskRecord> {
  return setTaskStatus(userId, taskId, "CANCELLED", userKeyRecord);
}

/**
 * Reschedules a task's due time (PRD 11.1 "snooze"). Bumps
 * reminder_revision and atomically replaces the task's active reminder
 * (PRD 33.9.1) via setTaskReminder.
 */
export async function rescheduleTask(
  userId: string,
  taskId: string,
  dueAt: string,
  userKeyRecord: UserKeyRecord
): Promise<TaskRecord> {
  const { decrypt } = userEncryptionContext(userKeyRecord);
  const db = getSupabaseAdminClient();

  const { data, error } = await db
    .from("tasks")
    .update({
      due_at: dueAt,
      has_explicit_time: true,
      updated_at: DateTime.utc().toISO(),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .select(TASK_COLUMNS)
    .single();

  if (error || !data) {
    logger.error("task_reschedule_failed", { errorCode: error?.code });
    throw new Error(`Failed to reschedule task: ${error?.message}`);
  }

  const task = toTaskRecord(data as TaskRow, decrypt);
  await setTaskReminder(task.id, userId, dueAt);

  return task;
}
