import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "luxon";
import type { UserRecord } from "@/lib/db/repositories/users";
import type { TaskRecord } from "@/lib/db/repositories/tasks";
import type { ClaimedReminder } from "@/lib/db/repositories/reminders";

const getSetting = vi.fn();
vi.mock("@/lib/db/repositories/settings", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

const getUserById = vi.fn();
const getUserKeyRecord = vi.fn();
vi.mock("@/lib/db/repositories/users", () => ({
  getUserById: (...args: unknown[]) => getUserById(...args),
  getUserKeyRecord: (...args: unknown[]) => getUserKeyRecord(...args),
}));

const getTaskById = vi.fn();
vi.mock("@/lib/db/repositories/tasks", () => ({
  getTaskById: (...args: unknown[]) => getTaskById(...args),
}));

const claimDueReminders = vi.fn();
const markReminderSent = vi.fn();
const markReminderFailed = vi.fn();
const markReminderCancelled = vi.fn();
const markReminderIneligible = vi.fn();
vi.mock("@/lib/db/repositories/reminders", () => ({
  claimDueReminders: (...args: unknown[]) => claimDueReminders(...args),
  markReminderSent: (...args: unknown[]) => markReminderSent(...args),
  markReminderFailed: (...args: unknown[]) => markReminderFailed(...args),
  markReminderCancelled: (...args: unknown[]) => markReminderCancelled(...args),
  markReminderIneligible: (...args: unknown[]) => markReminderIneligible(...args),
}));

const sendText = vi.fn();
vi.mock("@/lib/whatsapp/evolution-adapter", () => ({
  getEvolutionAdapter: async () => ({ sendText: (...args: unknown[]) => sendText(...args) }),
}));

import { dispatchDueReminders } from "@/lib/reminders/dispatcher";

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    name: "Asha",
    phoneE164: "+919876543210",
    phoneJid: null,
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
    accessMode: "NO_EXPIRY",
    trialStartAt: null,
    trialEndAt: null,
    lastActiveAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    title: "Call the client",
    details: null,
    category: "PROFESSIONAL",
    status: "PENDING",
    dueAt: "2026-09-26T10:00:00Z",
    hasExplicitTime: true,
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeClaimed(overrides: Partial<ClaimedReminder> = {}): ClaimedReminder {
  return {
    id: "rem-1",
    userId: "user-1",
    taskId: "task-1",
    seriesId: null,
    scheduledAt: "2026-09-26T10:00:00Z",
    attempts: 1,
    ...overrides,
  };
}

const SETTINGS_DEFAULTS: Record<string, unknown> = {
  "reminders.dispatcher_enabled": true,
  "reminders.batch_size": 25,
  "reminders.missed_grace_period_minutes": 60,
  "reminders.max_retry_attempts": 3,
  "reminders.retry_delays_minutes": [1, 5, 15],
};

describe("dispatchDueReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSetting.mockImplementation(async (key: string, fallback: unknown) => SETTINGS_DEFAULTS[key] ?? fallback);
    getUserKeyRecord.mockResolvedValue({ encryptedDek: "enc", keyVersion: 1 });
  });

  it("does nothing when the dispatcher is disabled", async () => {
    getSetting.mockImplementation(async (key: string) =>
      key === "reminders.dispatcher_enabled" ? false : undefined
    );

    const summary = await dispatchDueReminders();

    expect(summary).toEqual({ claimed: 0, sent: 0, failed: 0, cancelled: 0, skippedIneligible: 0 });
    expect(claimDueReminders).not.toHaveBeenCalled();
  });

  it("sends a reminder and marks it SENT on success", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed()]);
    getUserById.mockResolvedValue(makeUser());
    getTaskById.mockResolvedValue(makeTask());
    sendText.mockResolvedValue({ success: true, providerMessageId: "wamid-1" });

    const summary = await dispatchDueReminders();

    expect(sendText).toHaveBeenCalledWith("+919876543210", "Reminder: Call the client.");
    expect(markReminderSent).toHaveBeenCalledWith("rem-1");
    expect(summary.sent).toBe(1);
  });

  it("cancels the reminder when the task is no longer PENDING", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed()]);
    getUserById.mockResolvedValue(makeUser());
    getTaskById.mockResolvedValue(makeTask({ status: "COMPLETED" }));

    const summary = await dispatchDueReminders();

    expect(sendText).not.toHaveBeenCalled();
    expect(markReminderCancelled).toHaveBeenCalledWith("rem-1");
    expect(summary.cancelled).toBe(1);
  });

  it("cancels the reminder when the user no longer exists", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed()]);
    getUserById.mockResolvedValue(null);

    const summary = await dispatchDueReminders();

    expect(markReminderCancelled).toHaveBeenCalledWith("rem-1");
    expect(summary.cancelled).toBe(1);
  });

  it("marks the reminder ineligible (not failed/retried) when the user is suspended", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed()]);
    getUserById.mockResolvedValue(makeUser({ status: "SUSPENDED" }));

    const summary = await dispatchDueReminders();

    expect(sendText).not.toHaveBeenCalled();
    expect(markReminderIneligible).toHaveBeenCalledWith("rem-1", "USER_SUSPENDED");
    expect(summary.skippedIneligible).toBe(1);
  });

  it("marks the reminder ineligible when the trial has expired", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed()]);
    getUserById.mockResolvedValue(
      makeUser({ accessMode: "TRIAL", trialEndAt: "2020-01-01T00:00:00Z" })
    );

    const summary = await dispatchDueReminders();

    expect(markReminderIneligible).toHaveBeenCalledWith("rem-1", "TRIAL_EXPIRED");
    expect(summary.skippedIneligible).toBe(1);
  });

  it("schedules a retry with the configured backoff on a retryable send failure", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed({ attempts: 1, scheduledAt: DateTime.utc().toISO()! })]);
    getUserById.mockResolvedValue(makeUser());
    getTaskById.mockResolvedValue(makeTask());
    sendText.mockResolvedValue({ success: false, errorCode: "EVOLUTION_UNAVAILABLE" });

    const before = DateTime.utc();
    const summary = await dispatchDueReminders();

    expect(markReminderFailed).toHaveBeenCalledTimes(1);
    const [reminderId, errorCode, retryAt] = markReminderFailed.mock.calls[0];
    expect(reminderId).toBe("rem-1");
    expect(errorCode).toBe("EVOLUTION_UNAVAILABLE");
    expect(retryAt).not.toBeNull();
    const retryDelta = DateTime.fromISO(retryAt as string).diff(before, "minutes").minutes;
    expect(retryDelta).toBeGreaterThan(0.9);
    expect(retryDelta).toBeLessThan(1.1);
    expect(summary.failed).toBe(1);
  });

  it("gives up (no retry) once max retry attempts is reached", async () => {
    claimDueReminders.mockResolvedValue([makeClaimed({ attempts: 4, scheduledAt: DateTime.utc().toISO()! })]);
    getUserById.mockResolvedValue(makeUser());
    getTaskById.mockResolvedValue(makeTask());
    sendText.mockResolvedValue({ success: false, errorCode: "EVOLUTION_UNAVAILABLE" });

    await dispatchDueReminders();

    const [, , retryAt] = markReminderFailed.mock.calls[0];
    expect(retryAt).toBeNull();
  });

  it("gives up (no retry) when the next retry would fall past the missed grace period", async () => {
    const scheduledAt = DateTime.utc().minus({ minutes: 59 }).toISO()!;
    claimDueReminders.mockResolvedValue([makeClaimed({ attempts: 3, scheduledAt })]);
    getUserById.mockResolvedValue(makeUser());
    getTaskById.mockResolvedValue(makeTask());
    sendText.mockResolvedValue({ success: false, errorCode: "EVOLUTION_UNAVAILABLE" });

    await dispatchDueReminders();

    // attempt 3 -> 15 minute delay, but grace deadline is scheduledAt+60min = 1 minute from now
    const [, , retryAt] = markReminderFailed.mock.calls[0];
    expect(retryAt).toBeNull();
  });
});
