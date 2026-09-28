import { getSetting, getSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { WhatsAppProviderError } from "./types";

export interface EvolutionConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  requestTimeoutMs: number;
}

/** Loads Evolution settings from system_settings (PRD 27: never hardcoded). */
export async function loadEvolutionConfig(): Promise<EvolutionConfig> {
  const enabled = await getSetting<boolean>(SettingsKeys.EVOLUTION_ENABLED, SettingsDefaults.EVOLUTION_ENABLED);
  const baseUrl = await getSetting<string | null>(SettingsKeys.EVOLUTION_BASE_URL, null);
  const instanceName = await getSetting<string | null>(SettingsKeys.EVOLUTION_INSTANCE_NAME, null);
  const requestTimeoutMs = await getSetting<number>(
    SettingsKeys.EVOLUTION_REQUEST_TIMEOUT_MS,
    SettingsDefaults.EVOLUTION_REQUEST_TIMEOUT_MS
  );
  const apiKey = await getSecret(SettingsKeys.EVOLUTION_API_KEY);

  if (!enabled || !baseUrl || !instanceName || !apiKey) {
    throw new WhatsAppProviderError(
      "EVOLUTION_NOT_CONFIGURED",
      "Evolution API is not fully configured"
    );
  }

  return { enabled, baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instanceName, requestTimeoutMs };
}
