import { requireAdmin } from "@/lib/security/admin";
import { getSetting, getMaskedSecret, hasSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EvolutionSettingsForm } from "./settings-form";
import { EvolutionActionsPanel } from "./actions-panel";

export default async function EvolutionSettingsPage() {
  await requireAdmin();

  const enabled = await getSetting<boolean>(SettingsKeys.EVOLUTION_ENABLED, SettingsDefaults.EVOLUTION_ENABLED);
  const baseUrl = await getSetting<string | null>(SettingsKeys.EVOLUTION_BASE_URL, null);
  const instanceName = await getSetting<string | null>(SettingsKeys.EVOLUTION_INSTANCE_NAME, null);
  const assistantNumber = await getSetting<string | null>(SettingsKeys.EVOLUTION_ASSISTANT_NUMBER, null);
  const requestTimeoutMs = await getSetting<number>(
    SettingsKeys.EVOLUTION_REQUEST_TIMEOUT_MS,
    SettingsDefaults.EVOLUTION_REQUEST_TIMEOUT_MS
  );
  const apiKeyMasked = await getMaskedSecret(SettingsKeys.EVOLUTION_API_KEY);
  const webhookTokenSet = await hasSecret(SettingsKeys.EVOLUTION_WEBHOOK_TOKEN);
  const webhookUrl =
    webhookTokenSet && process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/evolution/••••••••`
      : null;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-2xl">
      <PageHeader title="Evolution API" description="WhatsApp connectivity and webhook configuration." />

      <Card>
        <CardHeader title="Connection" description="Credentials used to reach your Evolution API instance." />
        <CardBody>
          <EvolutionSettingsForm
            initial={{
              enabled,
              baseUrl: baseUrl ?? "",
              instanceName: instanceName ?? "",
              assistantNumber: assistantNumber ?? "",
              requestTimeoutMs,
              apiKeyMasked,
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Webhook" />
        <CardBody>
          <p className="text-sm text-text-secondary break-all">
            {webhookUrl ? `Configured: ${webhookUrl}` : "No webhook token generated yet."}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Actions" />
        <CardBody>
          <EvolutionActionsPanel webhookTokenSet={webhookTokenSet} />
        </CardBody>
      </Card>
    </div>
  );
}
