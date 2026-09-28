import { logger } from "@/lib/logger";
import { loadAIConfig, type AIConfig } from "./config";
import {
  AIProviderError,
  type AIProvider,
  type AssistantInput,
  type AssistantRunResult,
  type HealthResult,
  type RequestedToolCall,
} from "./types";

/**
 * OpenRouter provider (PRD 28). Uses OpenRouter's OpenAI-compatible chat
 * completions REST API directly via fetch, so no extra SDK dependency is
 * needed. All OpenRouter-specific request/response shape stays in this
 * file - callers only see the AIProvider interface (PRD 28.3).
 */

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

interface OpenRouterToolCallResponse {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: OpenRouterToolCallResponse[];
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

function buildMessages(input: AssistantInput): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userMessage },
  ];

  for (const exchange of input.priorToolExchanges) {
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: exchange.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.argumentsJson },
      })),
    });
    for (const result of exchange.toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: result.toolCallId,
        name: result.name,
        content: result.resultJson,
      });
    }
  }

  return messages;
}

async function callModel(
  config: AIConfig,
  model: string,
  input: AssistantInput
): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        messages: buildMessages(input),
        tools: input.toolSchemas.map((schema) => ({
          type: "function",
          function: {
            name: schema.name,
            description: schema.description,
            parameters: schema.parametersJsonSchema,
          },
        })),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    logger.error("ai_request_failed", { errorCode: err instanceof Error ? err.name : "unknown" });
    throw new AIProviderError("AI_UNAVAILABLE", "AI provider request failed");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logger.error("ai_request_non_ok", { httpStatus: response.status });
    throw new AIProviderError("AI_UNAVAILABLE", `AI provider returned HTTP ${response.status}`);
  }

  try {
    return (await response.json()) as OpenRouterResponse;
  } catch {
    throw new AIProviderError("AI_INVALID_RESPONSE", "AI provider returned invalid JSON");
  }
}

export class OpenRouterProvider implements AIProvider {
  constructor(private readonly config: AIConfig) {}

  async runAssistant(input: AssistantInput): Promise<AssistantRunResult> {
    let raw: OpenRouterResponse;
    try {
      raw = await callModel(this.config, this.config.primaryModel, input);
    } catch (err) {
      if (this.config.fallbackModel) {
        logger.warn("ai_primary_model_failed_using_fallback");
        raw = await callModel(this.config, this.config.fallbackModel, input);
      } else {
        throw err;
      }
    }

    const choice = raw.choices?.[0]?.message;
    if (!choice) {
      throw new AIProviderError("AI_INVALID_RESPONSE", "AI provider returned no choices");
    }

    const usage = {
      inputTokens: raw.usage?.prompt_tokens ?? 0,
      outputTokens: raw.usage?.completion_tokens ?? 0,
    };

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCalls: RequestedToolCall[] = choice.tool_calls.map((call) => ({
        id: call.id,
        name: call.function.name,
        argumentsJson: call.function.arguments,
      }));
      return { decision: { kind: "TOOL_CALLS", toolCalls }, usage };
    }

    return {
      decision: { kind: "FINAL_REPLY", text: choice.content ?? "" },
      usage,
    };
  }

  async healthCheck(): Promise<HealthResult> {
    try {
      const raw = await callModel(this.config, this.config.primaryModel, {
        systemPrompt: "Respond only with JSON.",
        userMessage: 'Return the word OK as JSON, e.g. {"status":"OK"}.',
        priorToolExchanges: [],
        toolSchemas: [],
      });
      const content = raw.choices?.[0]?.message?.content ?? "";
      return { ok: content.length > 0, detail: content.slice(0, 200) };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "unknown error" };
    }
  }
}

export async function getAIProvider(): Promise<AIProvider> {
  const config = await loadAIConfig();
  return new OpenRouterProvider(config);
}

export { AIProviderError };
