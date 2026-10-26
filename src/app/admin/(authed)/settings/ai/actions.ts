"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/admin";
import { setSetting, setSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { recordAuditLog } from "@/lib/db/repositories/audit-log";
import { getAIProvider, AIProviderError } from "@/lib/ai/openrouter-provider";

export interface ActionResult {
  error: string | null;
  success?: string;
}

export async function saveAISettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const provider = String(formData.get("provider") ?? "").trim();
  const apiBaseUrl = String(formData.get("apiBaseUrl") ?? "").trim();
  const primaryModel = String(formData.get("primaryModel") ?? "").trim();
  const fallbackModel = String(formData.get("fallbackModel") ?? "").trim();
  const enableFallback = formData.get("enableFallback") === "on";
  const temperatureRaw = Number(formData.get("temperature"));
  const maxOutputTokensRaw = Number(formData.get("maxOutputTokens"));
  const requestTimeoutMsRaw = Number(formData.get("requestTimeoutMs"));
  const maxToolIterationsRaw = Number(formData.get("maxToolIterations"));
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!provider || !apiBaseUrl || !primaryModel) {
    return { error: "Provider, API base URL, and primary model are required." };
  }

  if (enableFallback && !fallbackModel) {
    return { error: "A fallback model is required when fallback is enabled." };
  }

  if (!Number.isFinite(temperatureRaw) || temperatureRaw < 0 || temperatureRaw > 2) {
    return { error: "Temperature must be a number between 0 and 2." };
  }

  await setSetting(SettingsKeys.AI_PROVIDER, provider, admin.id);
  await setSetting(SettingsKeys.AI_API_BASE_URL, apiBaseUrl, admin.id);
  await setSetting(SettingsKeys.AI_PRIMARY_MODEL, primaryModel, admin.id);
  await setSetting(SettingsKeys.AI_FALLBACK_MODEL, fallbackModel || null, admin.id);
  await setSetting(SettingsKeys.AI_ENABLE_FALLBACK, enableFallback, admin.id);
  await setSetting(SettingsKeys.AI_TEMPERATURE, temperatureRaw, admin.id);
  await setSetting(
    SettingsKeys.AI_MAX_OUTPUT_TOKENS,
    Number.isFinite(maxOutputTokensRaw) && maxOutputTokensRaw > 0
      ? maxOutputTokensRaw
      : SettingsDefaults.AI_MAX_OUTPUT_TOKENS,
    admin.id
  );
  await setSetting(
    SettingsKeys.AI_REQUEST_TIMEOUT_MS,
    Number.isFinite(requestTimeoutMsRaw) && requestTimeoutMsRaw > 0
      ? requestTimeoutMsRaw
      : SettingsDefaults.AI_REQUEST_TIMEOUT_MS,
    admin.id
  );
  await setSetting(
    SettingsKeys.AI_MAX_TOOL_ITERATIONS,
    Number.isFinite(maxToolIterationsRaw) && maxToolIterationsRaw > 0
      ? maxToolIterationsRaw
      : SettingsDefaults.AI_MAX_TOOL_ITERATIONS,
    admin.id
  );

  if (apiKey) {
    await setSecret(SettingsKeys.AI_API_KEY, apiKey, admin.id);
  }

  await recordAuditLog({ adminId: admin.id, action: "AI_SETTINGS_UPDATED" });
  revalidatePath("/admin/settings/ai");

  return { error: null, success: "Settings saved." };
}

export async function testAIConnectionAction(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const provider = await getAIProvider();
    const result = await provider.healthCheck();
    return result.ok
      ? { error: null, success: "AI provider is reachable." }
      : { error: `AI provider check failed: ${result.detail ?? "unknown error"}` };
  } catch (err) {
    return { error: describeProviderError(err) };
  }
}

function describeProviderError(err: unknown): string {
  if (err instanceof AIProviderError) {
    if (err.code === "AI_NOT_CONFIGURED") {
      return "AI provider is not fully configured. Save settings first.";
    }
    return "AI provider is currently unavailable. Please try again later.";
  }
  return "An unexpected error occurred.";
}
