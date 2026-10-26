"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/admin";
import { setSetting, setSecret, getSecret, hasSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { recordAuditLog } from "@/lib/db/repositories/audit-log";
import { getEvolutionAdapter, WhatsAppProviderError } from "@/lib/whatsapp/evolution-adapter";
import { normalizeToE164, InvalidPhoneNumberError } from "@/lib/phone/normalize";
import { logger } from "@/lib/logger";

export interface ActionResult {
  error: string | null;
  success?: string;
}

export async function saveEvolutionSettingsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const enabled = formData.get("enabled") === "on";
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const instanceName = String(formData.get("instanceName") ?? "").trim();
  const assistantNumberRaw = String(formData.get("assistantNumber") ?? "").trim();
  const requestTimeoutMs = Number(formData.get("requestTimeoutMs"));
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!baseUrl || !instanceName) {
    return { error: "Base URL and instance name are required." };
  }

  let assistantNumber: string | null = null;
  if (assistantNumberRaw) {
    try {
      assistantNumber = normalizeToE164(assistantNumberRaw);
    } catch (err) {
      if (err instanceof InvalidPhoneNumberError) {
        return { error: "Assistant WhatsApp number is not a valid phone number." };
      }
      throw err;
    }
  }

  await setSetting(SettingsKeys.EVOLUTION_ENABLED, enabled, admin.id);
  await setSetting(SettingsKeys.EVOLUTION_BASE_URL, baseUrl, admin.id);
  await setSetting(SettingsKeys.EVOLUTION_INSTANCE_NAME, instanceName, admin.id);
  await setSetting(SettingsKeys.EVOLUTION_ASSISTANT_NUMBER, assistantNumber, admin.id);
  await setSetting(
    SettingsKeys.EVOLUTION_REQUEST_TIMEOUT_MS,
    Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs
      : SettingsDefaults.EVOLUTION_REQUEST_TIMEOUT_MS,
    admin.id
  );

  if (apiKey) {
    await setSecret(SettingsKeys.EVOLUTION_API_KEY, apiKey, admin.id);
  }

  await recordAuditLog({ adminId: admin.id, action: "EVOLUTION_SETTINGS_UPDATED" });
  revalidatePath("/admin/settings/evolution");

  return { error: null, success: "Settings saved." };
}

export async function generateWebhookTokenAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const token = randomBytes(32).toString("hex");
  await setSecret(SettingsKeys.EVOLUTION_WEBHOOK_TOKEN, token, admin.id);
  await recordAuditLog({ adminId: admin.id, action: "EVOLUTION_SETTINGS_UPDATED" });
  revalidatePath("/admin/settings/evolution");
  return { error: null, success: "New webhook token generated." };
}

export async function testConnectionAction(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const adapter = await getEvolutionAdapter();
    const status = await adapter.getConnectionStatus();
    return { error: null, success: `Connected: ${status.connected} (state: ${status.state})` };
  } catch (err) {
    return { error: describeProviderError(err) };
  }
}

export async function checkInstanceStatusAction(): Promise<ActionResult> {
  return testConnectionAction();
}

export async function configureWebhookAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { error: "NEXT_PUBLIC_APP_URL is not set." };
  }

  const tokenIsSet = await hasSecret(SettingsKeys.EVOLUTION_WEBHOOK_TOKEN);
  if (!tokenIsSet) {
    return { error: "Generate a webhook token first." };
  }

  try {
    const adapter = await getEvolutionAdapter();
    const token = await getSecret(SettingsKeys.EVOLUTION_WEBHOOK_TOKEN);
    const webhookUrl = `${appUrl.replace(/\/+$/, "")}/api/webhooks/evolution/${token}`;
    await adapter.configureWebhook(webhookUrl);
    await recordAuditLog({ adminId: admin.id, action: "EVOLUTION_SETTINGS_UPDATED" });
    return { error: null, success: "Webhook configured." };
  } catch (err) {
    return { error: describeProviderError(err) };
  }
}

export async function verifyWebhookAction(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const adapter = await getEvolutionAdapter();
    const config = await adapter.getWebhookConfig();
    return { error: null, success: `Webhook config: ${JSON.stringify(config)}` };
  } catch (err) {
    return { error: describeProviderError(err) };
  }
}

export async function sendTestMessageAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const to = String(formData.get("to") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!to || !text) {
    return { error: "Destination number and message text are required." };
  }

  let normalized: string;
  try {
    normalized = normalizeToE164(to);
  } catch {
    return { error: "Destination number is not a valid phone number." };
  }

  try {
    const adapter = await getEvolutionAdapter();
    const result = await adapter.sendText(normalized, text);
    // PRD 27.2: do not save test message content in logs.
    logger.info("evolution_test_message_sent", { success: result.success });
    return result.success
      ? { error: null, success: "Test message sent." }
      : { error: `Send failed: ${result.errorCode}` };
  } catch (err) {
    return { error: describeProviderError(err) };
  }
}

function describeProviderError(err: unknown): string {
  if (err instanceof WhatsAppProviderError) {
    if (err.code === "EVOLUTION_NOT_CONFIGURED") {
      return "Evolution API is not fully configured. Save settings first.";
    }
    return "Evolution API is currently unavailable. Please try again later.";
  }
  return "An unexpected error occurred.";
}
