"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/admin";
import { setSetting, setSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys } from "@/lib/db/repositories/settings-keys";
import { recordAuditLog } from "@/lib/db/repositories/audit-log";
import { loadGoogleOAuthConfig, GoogleNotConfiguredError } from "@/lib/google/config";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/google/config";

export interface ActionResult {
  error: string | null;
  success?: string;
}

export async function saveGoogleSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const enabled = formData.get("enabled") === "on";
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const projectNumber = String(formData.get("projectNumber") ?? "").trim();
  const calendarEnabled = formData.get("calendarEnabled") === "on";
  const sheetsEnabled = formData.get("sheetsEnabled") === "on";

  if (enabled && !clientId) {
    return { error: "OAuth Client ID is required to enable Google integration." };
  }

  await setSetting(SettingsKeys.GOOGLE_ENABLED, enabled, admin.id);
  await setSetting(SettingsKeys.GOOGLE_CLIENT_ID, clientId || null, admin.id);
  await setSetting(SettingsKeys.GOOGLE_PROJECT_NUMBER, projectNumber || null, admin.id);
  await setSetting(SettingsKeys.GOOGLE_CALENDAR_ENABLED, calendarEnabled, admin.id);
  await setSetting(SettingsKeys.GOOGLE_SHEETS_ENABLED, sheetsEnabled, admin.id);

  if (clientSecret) {
    await setSecret(SettingsKeys.GOOGLE_CLIENT_SECRET, clientSecret, admin.id);
  }

  await recordAuditLog({ adminId: admin.id, action: "GOOGLE_SETTINGS_UPDATED" });
  revalidatePath("/admin/settings/google");

  return { error: null, success: "Settings saved." };
}

/**
 * Checks config completeness and that a real OAuth URL can be generated,
 * without touching any real user's Google data (PRD 29: "Validate
 * configuration" action).
 */
export async function validateConfigurationAction(): Promise<ActionResult> {
  await requireAdmin();

  try {
    const config = await loadGoogleOAuthConfig();
    return {
      error: null,
      success: `Configuration looks valid. Redirect URI: ${config.redirectUri}. Scopes: ${GOOGLE_OAUTH_SCOPES.join(", ")}`,
    };
  } catch (err) {
    if (err instanceof GoogleNotConfiguredError) {
      return { error: "Google integration is not fully configured. Enable it and set a Client ID/Secret." };
    }
    return { error: "An unexpected error occurred validating the configuration." };
  }
}
