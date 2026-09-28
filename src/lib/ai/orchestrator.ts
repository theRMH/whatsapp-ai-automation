import { logger } from "@/lib/logger";
import type { UserRecord } from "@/lib/db/repositories/users";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { getRecentConversationTurns } from "@/lib/db/repositories/conversation-turns";
import { incrementDailyAiTokens, checkAndIncrementDailyAiRequests } from "@/lib/db/repositories/usage";
import { getSetting } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import type { UserKeyRecord } from "@/lib/crypto/user-encryption";
import { getAIProvider, AIProviderError } from "./openrouter-provider";
import { getToolSchemasForModel } from "./tools";
import { executeToolCall, nowIsoForUser } from "./tool-executor";
import { buildSystemPrompt, buildUserMessage } from "./system-prompt";
import type { AssistantContext, RequestedToolCall, ToolResultForModel } from "./types";

/**
 * AI orchestration loop (PRD 38): load recent context -> AI/tool decision
 * -> validate + execute tool calls -> repeat until the model returns a
 * final reply or the configured max-iterations safety limit is hit.
 *
 * Static/rule-based interception (PRD 40) for unauthorized/suspended/
 * expired/rate-limited senders already happens in the webhook route
 * before a job is ever enqueued, so everything reaching this function is
 * a message from an authorized, active user that must go through the AI.
 */

const HARD_MAX_ITERATIONS = 10;

export interface OrchestratorResult {
  replyText: string;
}

export async function runAssistantTurn(
  user: UserRecord,
  userKeyRecord: UserKeyRecord,
  inboundText: string,
  onSideEffectStarted: () => Promise<void>
): Promise<OrchestratorResult> {
  const dailyLimit = await checkAndIncrementDailyAiRequests(user.id, user.timezone);
  if (!dailyLimit.allowed) {
    return { replyText: "You've reached today's assistant usage limit. Please try again tomorrow." };
  }

  let provider;
  try {
    provider = await getAIProvider();
  } catch (err) {
    logger.error("ai_provider_unavailable", { errorCode: err instanceof Error ? err.name : "unknown" });
    return { replyText: "I couldn't process that right now. Please try again." };
  }

  const recentTurns = await getRecentConversationTurns(user.id, userKeyRecord);
  const connectedGoogle = await isGoogleConnected(user.id);

  const context: AssistantContext = {
    userName: user.name,
    userTimezone: user.timezone,
    nowIso: nowIsoForUser(user.timezone),
    recentTurns: recentTurns.map((turn) => ({ direction: turn.direction, content: turn.content })),
    connectedIntegrations: { google: connectedGoogle },
  };

  const systemPrompt = buildSystemPrompt(context);
  const userMessage = buildUserMessage(context.recentTurns, inboundText);
  const toolSchemas = getToolSchemasForModel();

  const priorToolExchanges: { toolCalls: RequestedToolCall[]; toolResults: ToolResultForModel[] }[] = [];
  const maxIterations = Math.min(HARD_MAX_ITERATIONS, await getMaxToolIterations());

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let runResult;
    try {
      runResult = await provider.runAssistant({
        systemPrompt,
        userMessage,
        priorToolExchanges,
        toolSchemas,
      });
    } catch (err) {
      logger.error("ai_run_failed", {
        errorCode: err instanceof AIProviderError ? err.code : err instanceof Error ? err.name : "unknown",
      });
      return { replyText: "I couldn't process that right now. Please try again." };
    }

    await incrementDailyAiTokens(
      user.id,
      user.timezone,
      runResult.usage.inputTokens,
      runResult.usage.outputTokens
    );

    if (runResult.decision.kind === "FINAL_REPLY") {
      return { replyText: runResult.decision.text || "OK." };
    }

    const toolResults: ToolResultForModel[] = [];
    for (const call of runResult.decision.toolCalls) {
      const result = await executeToolCall(user, userKeyRecord, call, onSideEffectStarted);
      toolResults.push(result);
    }

    priorToolExchanges.push({ toolCalls: runResult.decision.toolCalls, toolResults });
  }

  logger.warn("ai_max_tool_iterations_reached", { userId: user.id });
  return { replyText: "I couldn't finish processing that request. Please try rephrasing it." };
}

async function isGoogleConnected(userId: string): Promise<boolean> {
  const db = getSupabaseAdminClient();
  const { data } = await db.from("google_connections").select("status").eq("user_id", userId).maybeSingle();
  return data?.status === "CONNECTED";
}

async function getMaxToolIterations(): Promise<number> {
  return getSetting<number>(SettingsKeys.AI_MAX_TOOL_ITERATIONS, SettingsDefaults.AI_MAX_TOOL_ITERATIONS);
}
