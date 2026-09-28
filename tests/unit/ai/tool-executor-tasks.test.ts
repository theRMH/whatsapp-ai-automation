import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserRecord } from "@/lib/db/repositories/users";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";
import type { TaskRecord } from "@/lib/db/repositories/tasks";

const createTask = vi.fn();
const listTasks = vi.fn();
const findTasksByReference = vi.fn();
const updateTask = vi.fn();
const completeTask = vi.fn();
const cancelTask = vi.fn();
const rescheduleTask = vi.fn();

vi.mock("@/lib/db/repositories/tasks", () => ({
  createTask: (...args: unknown[]) => createTask(...args),
  listTasks: (...args: unknown[]) => listTasks(...args),
  findTasksByReference: (...args: unknown[]) => findTasksByReference(...args),
  updateTask: (...args: unknown[]) => updateTask(...args),
  completeTask: (...args: unknown[]) => completeTask(...args),
  cancelTask: (...args: unknown[]) => cancelTask(...args),
  rescheduleTask: (...args: unknown[]) => rescheduleTask(...args),
}));

import { executeToolCall } from "@/lib/ai/tool-executor";
import { ToolName } from "@/lib/ai/tools";

function makeUser(): UserRecord {
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
  };
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    title: "Book dentist",
    details: null,
    category: "PERSONAL",
    status: "PENDING",
    dueAt: null,
    hasExplicitTime: true,
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const userKeyRecord: UserKeyRecord = { encryptedDek: "enc", keyVersion: 1 };
const onSideEffectStarted = vi.fn();

describe("executeToolCall - task tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TASK_CREATE defaults to PERSONAL category when none is given", async () => {
    createTask.mockResolvedValue(makeTask());

    await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c1", name: ToolName.TASK_CREATE, argumentsJson: JSON.stringify({ title: "Book dentist" }) },
      onSideEffectStarted
    );

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ category: "PERSONAL" }));
    expect(onSideEffectStarted).toHaveBeenCalledTimes(1);
  });

  it("TASK_CREATE passes through an explicit category", async () => {
    createTask.mockResolvedValue(makeTask({ category: "PROFESSIONAL" }));

    await executeToolCall(
      makeUser(),
      userKeyRecord,
      {
        id: "c2",
        name: ToolName.TASK_CREATE,
        argumentsJson: JSON.stringify({ title: "Call client", category: "PROFESSIONAL" }),
      },
      onSideEffectStarted
    );

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ category: "PROFESSIONAL" }));
  });

  it("TASK_LIST does not trigger side-effect tracking (read-only)", async () => {
    listTasks.mockResolvedValue([makeTask()]);

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c3", name: ToolName.TASK_LIST, argumentsJson: "{}" },
      onSideEffectStarted
    );

    expect(onSideEffectStarted).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.tasks).toHaveLength(1);
  });

  it("TASK_LIST with when=OVERDUE defaults status to PENDING and passes the user's timezone", async () => {
    listTasks.mockResolvedValue([]);

    await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c3b", name: ToolName.TASK_LIST, argumentsJson: JSON.stringify({ when: "OVERDUE" }) },
      onSideEffectStarted
    );

    expect(listTasks).toHaveBeenCalledWith(
      "user-1",
      userKeyRecord,
      expect.objectContaining({ status: "PENDING", when: "OVERDUE", userTimezone: "Asia/Kolkata" })
    );
  });

  it("TASK_LIST with when=TODAY does not override an explicit status filter", async () => {
    listTasks.mockResolvedValue([]);

    await executeToolCall(
      makeUser(),
      userKeyRecord,
      {
        id: "c3c",
        name: ToolName.TASK_LIST,
        argumentsJson: JSON.stringify({ when: "TODAY", status: "COMPLETED" }),
      },
      onSideEffectStarted
    );

    expect(listTasks).toHaveBeenCalledWith(
      "user-1",
      userKeyRecord,
      expect.objectContaining({ status: "COMPLETED", when: "TODAY" })
    );
  });

  it("TASK_COMPLETE returns NOT_FOUND when no task matches the reference", async () => {
    findTasksByReference.mockResolvedValue([]);

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c4", name: ToolName.TASK_COMPLETE, argumentsJson: JSON.stringify({ taskRef: "nonexistent" }) },
      onSideEffectStarted
    );

    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("NOT_FOUND");
    expect(completeTask).not.toHaveBeenCalled();
  });

  it("TASK_COMPLETE returns AMBIGUOUS with candidates when multiple tasks match", async () => {
    findTasksByReference.mockResolvedValue([makeTask({ id: "a" }), makeTask({ id: "b", title: "Book dentist again" })]);

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c5", name: ToolName.TASK_COMPLETE, argumentsJson: JSON.stringify({ taskRef: "dentist" }) },
      onSideEffectStarted
    );

    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("AMBIGUOUS");
    expect(parsed.candidates).toHaveLength(2);
    expect(completeTask).not.toHaveBeenCalled();
  });

  it("TASK_COMPLETE completes the single matching task and flags side effects first", async () => {
    findTasksByReference.mockResolvedValue([makeTask({ id: "task-42" })]);
    completeTask.mockResolvedValue(makeTask({ id: "task-42", status: "COMPLETED" }));

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      { id: "c6", name: ToolName.TASK_COMPLETE, argumentsJson: JSON.stringify({ taskRef: "dentist" }) },
      onSideEffectStarted
    );

    expect(onSideEffectStarted).toHaveBeenCalledTimes(1);
    expect(completeTask).toHaveBeenCalledWith("user-1", "task-42", userKeyRecord);
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.task.status).toBe("COMPLETED");
  });

  it("TASK_SNOOZE reschedules the resolved task to the given time", async () => {
    findTasksByReference.mockResolvedValue([makeTask({ id: "task-9" })]);
    rescheduleTask.mockResolvedValue(makeTask({ id: "task-9", dueAt: "2026-09-26T09:00:00+05:30" }));

    const result = await executeToolCall(
      makeUser(),
      userKeyRecord,
      {
        id: "c7",
        name: ToolName.TASK_SNOOZE,
        argumentsJson: JSON.stringify({ taskRef: "dentist", untilAt: "2026-09-26T09:00:00+05:30" }),
      },
      onSideEffectStarted
    );

    expect(rescheduleTask).toHaveBeenCalledWith("user-1", "task-9", "2026-09-26T09:00:00+05:30", userKeyRecord);
    const parsed = JSON.parse(result.resultJson);
    expect(parsed.task.dueAt).toBe("2026-09-26T09:00:00+05:30");
  });
});
