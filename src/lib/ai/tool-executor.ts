import { DateTime } from "luxon";
import type { UserRecord } from "@/lib/db/repositories/users";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";
import {
  createTask,
  listTasks,
  findTasksByReference,
  updateTask,
  completeTask,
  cancelTask,
  rescheduleTask,
  type TaskCategory,
  type TaskRecord,
  type TaskWhenFilter,
} from "@/lib/db/repositories/tasks";
import { createGoogleConnectLink, disconnectGoogleAccount } from "@/lib/google/connection-service";
import { getGoogleConnectionStatus } from "@/lib/db/repositories/google-connections";
import { GoogleNotConfiguredError } from "@/lib/google/config";
import { logger } from "@/lib/logger";
import { IMPLEMENTED_TOOLS, READ_ONLY_TOOLS, ToolName, validateToolArguments, ToolValidationError } from "./tools";
import type { RequestedToolCall, ToolResultForModel } from "./types";

/**
 * Executes one already-model-requested tool call: validate args (PRD 8.2
 * step 1), verify ownership (step 2 - every lookup here is scoped to the
 * user passed in, never a bare id from the model), perform the operation
 * (step 3), and return a structured result for the model to read back
 * (steps 4-5). The model is never told a mutation succeeded until this
 * function has actually performed it.
 *
 * `onSideEffectStarted` is invoked before any non-read-only tool runs, so
 * the caller can flag the enclosing job as side_effects_started (PRD
 * 36.2.3) before a mutation happens - never after, since a crash between
 * the mutation and the flag write would leave a mutating job looking
 * safe to retry.
 */
export async function executeToolCall(
  user: UserRecord,
  userKeyRecord: UserKeyRecord,
  call: RequestedToolCall,
  onSideEffectStarted: () => Promise<void>
): Promise<ToolResultForModel> {
  let args: unknown;
  try {
    args = validateToolArguments(call.name, call.argumentsJson);
  } catch (err) {
    const message = err instanceof ToolValidationError ? err.message : "Invalid tool arguments";
    return {
      toolCallId: call.id,
      name: call.name,
      resultJson: JSON.stringify({ ok: false, error: "INVALID_ARGUMENTS", message }),
    };
  }

  if (!READ_ONLY_TOOLS.has(call.name)) {
    await onSideEffectStarted();
  }

  if (!IMPLEMENTED_TOOLS.has(call.name)) {
    return {
      toolCallId: call.id,
      name: call.name,
      resultJson: JSON.stringify({
        ok: false,
        error: "NOT_AVAILABLE",
        message: "This capability is not available yet in this deployment.",
      }),
    };
  }

  switch (call.name) {
    case ToolName.HELP:
      return {
        toolCallId: call.id,
        name: call.name,
        resultJson: JSON.stringify({
          ok: true,
          capabilities: [
            "Creating, listing, updating, completing, cancelling, and snoozing tasks",
            "Answering questions about your account status",
            "Connecting, disconnecting, and checking the status of your Google account",
          ],
          comingSoon: [
            "Reminders and recurring tasks",
            "Calendar scheduling",
            "Long-term memory of facts about you",
            "Prospect tracking",
            "Google Sheets integration",
          ],
        }),
      };

    case ToolName.ACCOUNT_STATUS:
      return {
        toolCallId: call.id,
        name: call.name,
        resultJson: JSON.stringify({
          ok: true,
          status: user.status,
          accessMode: user.accessMode,
          trialEndAt: user.trialEndAt,
        }),
      };

    case ToolName.GOOGLE_STATUS: {
      const status = await getGoogleConnectionStatus(user.id);
      return toolResult(call, { ok: true, connected: status === "CONNECTED", status });
    }

    case ToolName.GOOGLE_CONNECT: {
      try {
        const link = await createGoogleConnectLink(user.id);
        return toolResult(call, {
          ok: true,
          connectUrl: link,
          message: "Send the user this one-time link to connect their Google account. It expires in 10 minutes.",
        });
      } catch (err) {
        if (err instanceof GoogleNotConfiguredError) {
          return toolResult(call, {
            ok: false,
            error: "NOT_AVAILABLE",
            message: "Google connection is not available in this deployment yet.",
          });
        }
        logger.error("google_connect_tool_failed", { userId: user.id, errorCode: err instanceof Error ? err.name : "unknown" });
        return toolResult(call, { ok: false, error: "INTERNAL_ERROR", message: "Could not start the Google connection." });
      }
    }

    case ToolName.GOOGLE_DISCONNECT: {
      await disconnectGoogleAccount(user.id, userKeyRecord);
      return toolResult(call, { ok: true, status: "DISCONNECTED" });
    }

    case ToolName.TASK_CREATE: {
      const parsed = args as { title: string; dueAt?: string; category?: TaskCategory; details?: string };
      const task = await createTask({
        userId: user.id,
        title: parsed.title,
        details: parsed.details ?? null,
        category: parsed.category ?? "PERSONAL",
        dueAt: parsed.dueAt ?? null,
        userKeyRecord,
      });
      return toolResult(call, { ok: true, task: formatTask(task) });
    }

    case ToolName.TASK_LIST: {
      const parsed = args as { status?: TaskRecord["status"]; category?: TaskCategory; when?: TaskWhenFilter };
      const tasks = await listTasks(user.id, userKeyRecord, {
        status: parsed.status ?? (parsed.when === "OVERDUE" ? "PENDING" : undefined),
        category: parsed.category,
        when: parsed.when,
        userTimezone: user.timezone,
      });
      return toolResult(call, { ok: true, tasks: tasks.map(formatTask) });
    }

    case ToolName.TASK_UPDATE: {
      const parsed = args as {
        taskRef: string;
        title?: string;
        details?: string;
        category?: TaskCategory;
        dueAt?: string;
      };
      const resolved = await resolveTaskRef(user.id, userKeyRecord, parsed.taskRef);
      if (!resolved.ok) return toolResult(call, resolved.result);

      const task = await updateTask(
        user.id,
        resolved.task.id,
        { title: parsed.title, details: parsed.details, category: parsed.category, dueAt: parsed.dueAt },
        userKeyRecord
      );
      return toolResult(call, { ok: true, task: formatTask(task) });
    }

    case ToolName.TASK_COMPLETE: {
      const parsed = args as { taskRef: string };
      const resolved = await resolveTaskRef(user.id, userKeyRecord, parsed.taskRef);
      if (!resolved.ok) return toolResult(call, resolved.result);

      const task = await completeTask(user.id, resolved.task.id, userKeyRecord);
      return toolResult(call, { ok: true, task: formatTask(task) });
    }

    case ToolName.TASK_CANCEL: {
      const parsed = args as { taskRef: string };
      const resolved = await resolveTaskRef(user.id, userKeyRecord, parsed.taskRef);
      if (!resolved.ok) return toolResult(call, resolved.result);

      const task = await cancelTask(user.id, resolved.task.id, userKeyRecord);
      return toolResult(call, { ok: true, task: formatTask(task) });
    }

    case ToolName.TASK_SNOOZE: {
      const parsed = args as { taskRef: string; untilAt: string };
      const resolved = await resolveTaskRef(user.id, userKeyRecord, parsed.taskRef);
      if (!resolved.ok) return toolResult(call, resolved.result);

      const task = await rescheduleTask(user.id, resolved.task.id, parsed.untilAt, userKeyRecord);
      return toolResult(call, { ok: true, task: formatTask(task) });
    }

    default:
      return {
        toolCallId: call.id,
        name: call.name,
        resultJson: JSON.stringify({ ok: false, error: "NOT_AVAILABLE" }),
      };
  }
}

function toolResult(call: RequestedToolCall, payload: Record<string, unknown>): ToolResultForModel {
  return { toolCallId: call.id, name: call.name, resultJson: JSON.stringify(payload) };
}

function formatTask(task: TaskRecord) {
  return {
    title: task.title,
    details: task.details,
    category: task.category,
    status: task.status,
    dueAt: task.dueAt,
  };
}

/**
 * Resolves a free-text taskRef against the user's PENDING tasks (PRD 8.6:
 * conversational references). Zero matches or more than one match returns
 * a structured, non-throwing result so the model asks the user to clarify
 * instead of the tool guessing which task was meant.
 */
async function resolveTaskRef(
  userId: string,
  userKeyRecord: UserKeyRecord,
  taskRef: string
): Promise<{ ok: true; task: TaskRecord } | { ok: false; result: Record<string, unknown> }> {
  const matches = await findTasksByReference(userId, userKeyRecord, taskRef);

  if (matches.length === 0) {
    return { ok: false, result: { ok: false, error: "NOT_FOUND", message: "No matching pending task was found." } };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      result: {
        ok: false,
        error: "AMBIGUOUS",
        message: "More than one pending task matches that description.",
        candidates: matches.map((task) => ({ title: task.title, dueAt: task.dueAt })),
      },
    };
  }

  return { ok: true, task: matches[0] };
}

export function nowIsoForUser(userTimezone: string): string {
  return DateTime.now().setZone(userTimezone).toISO() ?? DateTime.now().toISO()!;
}
