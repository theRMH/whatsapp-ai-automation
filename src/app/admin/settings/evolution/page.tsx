import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin";
import { getSetting, getMaskedSecret, hasSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
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
    <main className="flex-1 p-8 flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Evolution API settings</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-black">
          Back to admin
        </Link>
      </div>

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

      <section className="flex flex-col gap-2 border-t pt-6">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase">Webhook</h2>
        <p className="text-sm text-neutral-600">
          {webhookUrl ? `Configured: ${webhookUrl}` : "No webhook token generated yet."}
        </p>
      </section>

      <EvolutionActionsPanel webhookTokenSet={webhookTokenSet} />
    </main>
  );
}
