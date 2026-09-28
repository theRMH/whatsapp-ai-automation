import { getSetting, getSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { AIProviderError } from "./types";

export interface AIConfig {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  primaryModel: string;
  fallbackModel: string | null;
  enableFallback: boolean;
  temperature: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  maxToolIterations: number;
}

/** Loads AI provider settings from system_settings (PRD 28: never hardcoded). */
export async function loadAIConfig(): Promise<AIConfig> {
  const provider = await getSetting<string>(SettingsKeys.AI_PROVIDER, SettingsDefaults.AI_PROVIDER);
  const apiBaseUrl = await getSetting<string>(SettingsKeys.AI_API_BASE_URL, SettingsDefaults.AI_API_BASE_URL);
  const primaryModel = await getSetting<string | null>(SettingsKeys.AI_PRIMARY_MODEL, null);
  const fallbackModel = await getSetting<string | null>(SettingsKeys.AI_FALLBACK_MODEL, null);
  const enableFallback = await getSetting<boolean>(
    SettingsKeys.AI_ENABLE_FALLBACK,
    SettingsDefaults.AI_ENABLE_FALLBACK
  );
  const temperature = await getSetting<number>(SettingsKeys.AI_TEMPERATURE, SettingsDefaults.AI_TEMPERATURE);
  const maxOutputTokens = await getSetting<number>(
    SettingsKeys.AI_MAX_OUTPUT_TOKENS,
    SettingsDefaults.AI_MAX_OUTPUT_TOKENS
  );
  const requestTimeoutMs = await getSetting<number>(
    SettingsKeys.AI_REQUEST_TIMEOUT_MS,
    SettingsDefaults.AI_REQUEST_TIMEOUT_MS
  );
  const maxToolIterations = await getSetting<number>(
    SettingsKeys.AI_MAX_TOOL_ITERATIONS,
    SettingsDefaults.AI_MAX_TOOL_ITERATIONS
  );
  const apiKey = await getSecret(SettingsKeys.AI_API_KEY);

  if (!apiKey || !primaryModel) {
    throw new AIProviderError("AI_NOT_CONFIGURED", "AI provider is not fully configured");
  }

  return {
    provider,
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    apiKey,
    primaryModel,
    fallbackModel: enableFallback ? fallbackModel : null,
    enableFallback,
    temperature,
    maxOutputTokens,
    requestTimeoutMs,
    maxToolIterations,
  };
}
