import { requireAdmin } from "@/lib/security/admin";
import { getSetting, getMaskedSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { AISettingsForm } from "./settings-form";
import { AIActionsPanel } from "./actions-panel";

export default async function AISettingsPage() {
  await requireAdmin();

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
  const apiKeyMasked = await getMaskedSecret(SettingsKeys.AI_API_KEY);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-2xl">
      <PageHeader title="AI" description="Model provider, prompts, and generation limits." />

      <Card>
        <CardHeader title="Model configuration" />
        <CardBody>
          <AISettingsForm
            initial={{
              provider,
              apiBaseUrl,
              primaryModel: primaryModel ?? "",
              fallbackModel: fallbackModel ?? "",
              enableFallback,
              temperature,
              maxOutputTokens,
              requestTimeoutMs,
              maxToolIterations,
              apiKeyMasked,
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Actions" />
        <CardBody>
          <AIActionsPanel />
        </CardBody>
      </Card>
    </div>
  );
}
