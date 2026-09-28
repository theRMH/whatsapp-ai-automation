import { z } from "zod";
import type { ToolSchemaForModel } from "./types";

/**
 * Tool catalog (PRD 8.3). Every tool the AI can request is defined here
 * with a Zod schema, so application code always validates arguments
 * before executing anything (PRD 8.2: "validates tool arguments with
 * Zod... verifies user ownership... performs the operation").
 *
 * V1/Phase 4 note: Tasks, Reminders, Calendar, Memory, Prospects, Sheets,
 * Documents, and Google connect/disconnect are implemented in their own
 * later phases (Milestones 5-9). Their tool names are still declared here
 * so the model can see the full capability surface and so schema
 * validation tests can cover them now, but executeTool() returns a
 * deterministic "not yet available" result for any tool whose phase
 * hasn't landed, instead of pretending to perform the action (PRD 8.2:
 * never claim success before a real mutation happened).
 */

export const ToolName = {
  TASK_CREATE: "TASK_CREATE",
  TASK_LIST: "TASK_LIST",
  TASK_UPDATE: "TASK_UPDATE",
  TASK_COMPLETE: "TASK_COMPLETE",
  TASK_CANCEL: "TASK_CANCEL",
  TASK_SNOOZE: "TASK_SNOOZE",

  REMINDER_CREATE: "REMINDER_CREATE",
  REMINDER_RESCHEDULE: "REMINDER_RESCHEDULE",
  REMINDER_CANCEL: "REMINDER_CANCEL",
  RECURRING_TASK_CREATE: "RECURRING_TASK_CREATE",
  RECURRING_TASK_UPDATE: "RECURRING_TASK_UPDATE",
  RECURRING_TASK_CANCEL: "RECURRING_TASK_CANCEL",

  CALENDAR_LIST: "CALENDAR_LIST",
  CALENDAR_SEARCH: "CALENDAR_SEARCH",
  CALENDAR_CREATE: "CALENDAR_CREATE",
  CALENDAR_UPDATE: "CALENDAR_UPDATE",
  CALENDAR_DELETE: "CALENDAR_DELETE",
  CALENDAR_AVAILABILITY: "CALENDAR_AVAILABILITY",
  CALENDAR_CREATE_RECURRING: "CALENDAR_CREATE_RECURRING",
  CALENDAR_SET_DEFAULT: "CALENDAR_SET_DEFAULT",

  MEMORY_CREATE: "MEMORY_CREATE",
  MEMORY_UPDATE: "MEMORY_UPDATE",
  MEMORY_SEARCH: "MEMORY_SEARCH",
  MEMORY_DELETE: "MEMORY_DELETE",

  PROSPECT_CREATE: "PROSPECT_CREATE",
  PROSPECT_UPDATE: "PROSPECT_UPDATE",
  PROSPECT_SEARCH: "PROSPECT_SEARCH",
  PROSPECT_LIST: "PROSPECT_LIST",
  PROSPECT_DELETE: "PROSPECT_DELETE",

  SHEET_CREATE: "SHEET_CREATE",
  SHEET_LIST: "SHEET_LIST",
  SHEET_APPEND_ROW: "SHEET_APPEND_ROW",
  SHEET_SEARCH_ROWS: "SHEET_SEARCH_ROWS",
  SHEET_UPDATE_ROW: "SHEET_UPDATE_ROW",
  SHEET_GET_LINK: "SHEET_GET_LINK",
  SHEET_UNLINK: "SHEET_UNLINK",

  DOCUMENT_SEARCH: "DOCUMENT_SEARCH",
  DOCUMENT_RESEND: "DOCUMENT_RESEND",

  GOOGLE_CONNECT: "GOOGLE_CONNECT",
  GOOGLE_DISCONNECT: "GOOGLE_DISCONNECT",
  GOOGLE_STATUS: "GOOGLE_STATUS",

  HELP: "HELP",
  ACCOUNT_STATUS: "ACCOUNT_STATUS",

  PENDING_RESOLVE: "PENDING_RESOLVE",
} as const;

export type ToolNameType = (typeof ToolName)[keyof typeof ToolName];

/** Tools with a real implementation in the current phase. */
export const IMPLEMENTED_TOOLS: ReadonlySet<string> = new Set([
  ToolName.HELP,
  ToolName.ACCOUNT_STATUS,
  ToolName.GOOGLE_STATUS,
  ToolName.TASK_CREATE,
  ToolName.TASK_LIST,
  ToolName.TASK_UPDATE,
  ToolName.TASK_COMPLETE,
  ToolName.TASK_CANCEL,
  ToolName.TASK_SNOOZE,
]);

/**
 * Tools that only read data, never mutate anything. Used to decide when
 * a job must be flagged side_effects_started (PRD 36.2.3: once a
 * mutating tool has run, the job can never be silently retried, since
 * that could repeat the mutation). Every tool NOT in this set is treated
 * as potentially mutating, including tools not yet implemented, so a
 * future phase that adds a real implementation is safe by default even
 * if this set is not updated in the same change.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  ToolName.HELP,
  ToolName.ACCOUNT_STATUS,
  ToolName.GOOGLE_STATUS,
  ToolName.TASK_LIST,
  ToolName.CALENDAR_LIST,
  ToolName.CALENDAR_SEARCH,
  ToolName.CALENDAR_AVAILABILITY,
  ToolName.MEMORY_SEARCH,
  ToolName.PROSPECT_SEARCH,
  ToolName.PROSPECT_LIST,
  ToolName.SHEET_LIST,
  ToolName.SHEET_SEARCH_ROWS,
  ToolName.SHEET_GET_LINK,
  ToolName.DOCUMENT_SEARCH,
]);

const emptyArgsSchema = z.object({});

const pendingResolveSchema = z.object({
  resolution: z.string().min(1).max(500).describe("How the user resolved a previous ambiguous/pending request"),
});

/**
 * Zod schemas for every tool's arguments. Tools not yet implemented still
 * get a real schema (usually a minimal one) so the model can be told
 * about them and so validation tests exercise the full catalog now,
 * ahead of their phases landing.
 */
export const toolArgumentSchemas: Record<ToolNameType, z.ZodTypeAny> = {
  TASK_CREATE: z.object({
    title: z.string().min(1).max(500),
    dueAt: z.string().optional(),
    category: z.enum(["PERSONAL", "PROFESSIONAL"]).optional(),
    details: z.string().max(2000).optional(),
  }),
  TASK_LIST: z.object({
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
    category: z.enum(["PERSONAL", "PROFESSIONAL"]).optional(),
    when: z.enum(["OVERDUE", "TODAY", "TOMORROW", "UPCOMING"]).optional(),
  }),
  TASK_UPDATE: z.object({
    taskRef: z.string().min(1),
    title: z.string().optional(),
    details: z.string().max(2000).optional(),
    category: z.enum(["PERSONAL", "PROFESSIONAL"]).optional(),
    dueAt: z.string().optional(),
  }),
  TASK_COMPLETE: z.object({ taskRef: z.string().min(1) }),
  TASK_CANCEL: z.object({ taskRef: z.string().min(1) }),
  TASK_SNOOZE: z.object({ taskRef: z.string().min(1), untilAt: z.string().min(1) }),

  REMINDER_CREATE: z.object({ text: z.string().min(1).max(500), atIso: z.string().min(1) }),
  REMINDER_RESCHEDULE: z.object({ reminderRef: z.string().min(1), atIso: z.string().min(1) }),
  REMINDER_CANCEL: z.object({ reminderRef: z.string().min(1) }),
  RECURRING_TASK_CREATE: z.object({ title: z.string().min(1).max(500), rrule: z.string().min(1) }),
  RECURRING_TASK_UPDATE: z.object({ seriesRef: z.string().min(1), rrule: z.string().optional() }),
  RECURRING_TASK_CANCEL: z.object({ seriesRef: z.string().min(1) }),

  CALENDAR_LIST: z.object({ fromIso: z.string().optional(), toIso: z.string().optional() }),
  CALENDAR_SEARCH: z.object({ query: z.string().min(1) }),
  CALENDAR_CREATE: z.object({
    title: z.string().min(1).max(500),
    startIso: z.string().min(1),
    endIso: z.string().min(1),
  }),
  CALENDAR_UPDATE: z.object({ eventRef: z.string().min(1) }),
  CALENDAR_DELETE: z.object({ eventRef: z.string().min(1) }),
  CALENDAR_AVAILABILITY: z.object({ fromIso: z.string().min(1), toIso: z.string().min(1) }),
  CALENDAR_CREATE_RECURRING: z.object({
    title: z.string().min(1).max(500),
    startIso: z.string().min(1),
    rrule: z.string().min(1),
  }),
  CALENDAR_SET_DEFAULT: z.object({ calendarRef: z.string().min(1) }),

  MEMORY_CREATE: z.object({ fact: z.string().min(1).max(1000), category: z.enum(["PERSONAL", "PROFESSIONAL"]) }),
  MEMORY_UPDATE: z.object({ memoryRef: z.string().min(1), fact: z.string().min(1).max(1000) }),
  MEMORY_SEARCH: z.object({ query: z.string().min(1) }),
  MEMORY_DELETE: z.object({ memoryRef: z.string().min(1) }),

  PROSPECT_CREATE: z.object({ name: z.string().min(1).max(200) }),
  PROSPECT_UPDATE: z.object({ prospectRef: z.string().min(1) }),
  PROSPECT_SEARCH: z.object({ query: z.string().min(1) }),
  PROSPECT_LIST: emptyArgsSchema,
  PROSPECT_DELETE: z.object({ prospectRef: z.string().min(1) }),

  SHEET_CREATE: z.object({ name: z.string().min(1).max(200) }),
  SHEET_LIST: emptyArgsSchema,
  SHEET_APPEND_ROW: z.object({ sheetRef: z.string().min(1), values: z.array(z.string()) }),
  SHEET_SEARCH_ROWS: z.object({ sheetRef: z.string().min(1), query: z.string().min(1) }),
  SHEET_UPDATE_ROW: z.object({ sheetRef: z.string().min(1), rowRef: z.string().min(1) }),
  SHEET_GET_LINK: z.object({ sheetRef: z.string().min(1) }),
  SHEET_UNLINK: z.object({ sheetRef: z.string().min(1) }),

  DOCUMENT_SEARCH: z.object({ query: z.string().min(1) }),
  DOCUMENT_RESEND: z.object({ documentRef: z.string().min(1) }),

  GOOGLE_CONNECT: emptyArgsSchema,
  GOOGLE_DISCONNECT: emptyArgsSchema,
  GOOGLE_STATUS: emptyArgsSchema,

  HELP: emptyArgsSchema,
  ACCOUNT_STATUS: emptyArgsSchema,

  PENDING_RESOLVE: pendingResolveSchema,
};

const toolDescriptions: Record<ToolNameType, string> = {
  TASK_CREATE:
    "Create a new task for the user, with an optional due date/time, category (PERSONAL or PROFESSIONAL - omit to let the system classify it automatically), and details.",
  TASK_LIST:
    "List the user's tasks, optionally filtered by status and/or category, and/or by when they are due: OVERDUE (pending tasks past their due time), TODAY, TOMORROW, or UPCOMING (any future due date). Use these instead of asking the user for exact dates when they ask things like 'what's overdue' or 'what do I have today'.",
  TASK_UPDATE:
    "Update an existing task's title, details, category, or due date. taskRef is a short natural-language description of the task (e.g. 'the dentist one'), not an internal id.",
  TASK_COMPLETE: "Mark a task complete. taskRef is a short natural-language description of the task, not an internal id.",
  TASK_CANCEL: "Cancel/delete a task. taskRef is a short natural-language description of the task, not an internal id.",
  TASK_SNOOZE:
    "Reschedule a task's reminder to a later time. taskRef is a short natural-language description of the task, not an internal id.",

  REMINDER_CREATE: "Create a one-off reminder. Not yet available in this deployment.",
  REMINDER_RESCHEDULE: "Reschedule an existing reminder. Not yet available in this deployment.",
  REMINDER_CANCEL: "Cancel a reminder. Not yet available in this deployment.",
  RECURRING_TASK_CREATE: "Create a recurring task series. Not yet available in this deployment.",
  RECURRING_TASK_UPDATE: "Update a recurring task series. Not yet available in this deployment.",
  RECURRING_TASK_CANCEL: "Cancel a recurring task series. Not yet available in this deployment.",

  CALENDAR_LIST: "List upcoming calendar events. Not yet available in this deployment.",
  CALENDAR_SEARCH: "Search calendar events. Not yet available in this deployment.",
  CALENDAR_CREATE: "Create a calendar event. Not yet available in this deployment.",
  CALENDAR_UPDATE: "Update a calendar event. Not yet available in this deployment.",
  CALENDAR_DELETE: "Delete a calendar event. Not yet available in this deployment.",
  CALENDAR_AVAILABILITY: "Check free/busy availability. Not yet available in this deployment.",
  CALENDAR_CREATE_RECURRING: "Create a recurring calendar event. Not yet available in this deployment.",
  CALENDAR_SET_DEFAULT: "Set the user's default calendar. Not yet available in this deployment.",

  MEMORY_CREATE: "Store a long-term fact about the user. Not yet available in this deployment.",
  MEMORY_UPDATE: "Update a stored memory. Not yet available in this deployment.",
  MEMORY_SEARCH: "Search the user's stored memories. Not yet available in this deployment.",
  MEMORY_DELETE: "Delete a stored memory. Not yet available in this deployment.",

  PROSPECT_CREATE: "Create a sales/networking prospect record. Not yet available in this deployment.",
  PROSPECT_UPDATE: "Update a prospect record. Not yet available in this deployment.",
  PROSPECT_SEARCH: "Search prospect records. Not yet available in this deployment.",
  PROSPECT_LIST: "List prospect records. Not yet available in this deployment.",
  PROSPECT_DELETE: "Delete a prospect record. Not yet available in this deployment.",

  SHEET_CREATE: "Create a linked Google Sheet. Not yet available in this deployment.",
  SHEET_LIST: "List linked Google Sheets. Not yet available in this deployment.",
  SHEET_APPEND_ROW: "Append a row to a linked Sheet. Not yet available in this deployment.",
  SHEET_SEARCH_ROWS: "Search rows in a linked Sheet. Not yet available in this deployment.",
  SHEET_UPDATE_ROW: "Update a row in a linked Sheet. Not yet available in this deployment.",
  SHEET_GET_LINK: "Get the shareable link for a linked Sheet. Not yet available in this deployment.",
  SHEET_UNLINK: "Unlink a Google Sheet. Not yet available in this deployment.",

  DOCUMENT_SEARCH: "Search stored document references by metadata. Not yet available in this deployment.",
  DOCUMENT_RESEND: "Resend a previously received file if still available. Not yet available in this deployment.",

  GOOGLE_CONNECT: "Start the Google account connection flow. Not yet available in this deployment.",
  GOOGLE_DISCONNECT: "Disconnect the user's Google account. Not yet available in this deployment.",
  GOOGLE_STATUS: "Check whether the user's Google account is connected.",

  HELP: "Explain what this assistant can currently do.",
  ACCOUNT_STATUS: "Report the user's account status (trial/active, expiry).",

  PENDING_RESOLVE: "Resolve a previously asked clarifying question using the user's latest reply.",
};

export function getToolSchemasForModel(): ToolSchemaForModel[] {
  return Object.values(ToolName).map((name) => {
    const schema = toolArgumentSchemas[name];
    return {
      name,
      description: toolDescriptions[name],
      parametersJsonSchema: z.toJSONSchema(schema) as Record<string, unknown>,
    };
  });
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

/** Validates a tool call's arguments JSON against its Zod schema (PRD 8.2). */
export function validateToolArguments(name: string, argumentsJson: string): unknown {
  const schema = toolArgumentSchemas[name as ToolNameType];
  if (!schema) {
    throw new ToolValidationError(`Unknown tool: ${name}`);
  }

  let parsed: unknown;
  try {
    parsed = argumentsJson ? JSON.parse(argumentsJson) : {};
  } catch {
    throw new ToolValidationError(`Invalid JSON arguments for tool ${name}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ToolValidationError(`Invalid arguments for tool ${name}: ${result.error.message}`);
  }

  return result.data;
}
