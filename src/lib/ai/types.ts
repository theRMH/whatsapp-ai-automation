/**
 * AI provider abstraction (PRD 28.3, 38, 39). V1 ships only OpenRouter,
 * but nothing outside this module may depend on OpenRouter's specific
 * request/response shape - the same "adapter" discipline used for
 * Evolution (PRD 27.4).
 */

export interface ConversationTurnInput {
  direction: "INBOUND" | "OUTBOUND";
  content: string;
}

export interface AssistantContext {
  userName: string;
  userTimezone: string;
  nowIso: string;
  recentTurns: ConversationTurnInput[];
  connectedIntegrations: {
    google: boolean;
  };
}

/** One tool call the AI wants application code to validate and execute. */
export interface RequestedToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export type AssistantDecision =
  | { kind: "TOOL_CALLS"; toolCalls: RequestedToolCall[] }
  | { kind: "FINAL_REPLY"; text: string };

export interface ToolResultForModel {
  toolCallId: string;
  name: string;
  resultJson: string;
}

export interface AssistantInput {
  systemPrompt: string;
  userMessage: string;
  /** Prior tool calls + their results from earlier iterations of this same turn's loop. */
  priorToolExchanges: {
    toolCalls: RequestedToolCall[];
    toolResults: ToolResultForModel[];
  }[];
  toolSchemas: ToolSchemaForModel[];
}

export interface ToolSchemaForModel {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface AssistantUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AssistantRunResult {
  decision: AssistantDecision;
  usage: AssistantUsage;
}

export interface HealthResult {
  ok: boolean;
  detail?: string;
}

export class AIProviderError extends Error {
  constructor(
    public readonly code: "AI_NOT_CONFIGURED" | "AI_UNAVAILABLE" | "AI_INVALID_RESPONSE",
    message: string
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface AIProvider {
  runAssistant(input: AssistantInput): Promise<AssistantRunResult>;
  healthCheck(): Promise<HealthResult>;
}
