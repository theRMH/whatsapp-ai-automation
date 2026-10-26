import { requireAdmin } from "@/lib/security/admin";
import { getSetting, getMaskedSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { GOOGLE_OAUTH_SCOPES, getGoogleRedirectUriForDisplay } from "@/lib/google/config";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { GoogleSettingsForm } from "./settings-form";
import { GoogleActionsPanel } from "./actions-panel";

export default async function GoogleSettingsPage() {
  await requireAdmin();

  const enabled = await getSetting<boolean>(SettingsKeys.GOOGLE_ENABLED, SettingsDefaults.GOOGLE_ENABLED);
  const clientId = await getSetting<string | null>(SettingsKeys.GOOGLE_CLIENT_ID, null);
  const projectNumber = await getSetting<string | null>(SettingsKeys.GOOGLE_PROJECT_NUMBER, null);
  const calendarEnabled = await getSetting<boolean>(
    SettingsKeys.GOOGLE_CALENDAR_ENABLED,
    SettingsDefaults.GOOGLE_CALENDAR_ENABLED
  );
  const sheetsEnabled = await getSetting<boolean>(
    SettingsKeys.GOOGLE_SHEETS_ENABLED,
    SettingsDefaults.GOOGLE_SHEETS_ENABLED
  );
  const clientSecretMasked = await getMaskedSecret(SettingsKeys.GOOGLE_CLIENT_SECRET);
  const redirectUri = getGoogleRedirectUriForDisplay();

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-2xl">
      <PageHeader title="Google" description="OAuth credentials for Calendar and Sheets access." />

      <Card>
        <CardHeader title="OAuth configuration" />
        <CardBody>
          <GoogleSettingsForm
            initial={{
              enabled,
              clientId: clientId ?? "",
              projectNumber: projectNumber ?? "",
              calendarEnabled,
              sheetsEnabled,
              clientSecretMasked,
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="OAuth callback URL"
          description="Add this exact URL as an authorized redirect URI in the Google Cloud Console."
        />
        <CardBody>
          <p className="text-sm text-text-secondary break-all">
            {redirectUri ?? "NEXT_PUBLIC_APP_URL is not set."}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Requested scopes" description="Fixed by the application; not admin-editable." />
        <CardBody>
          <ul className="list-disc list-inside text-sm text-text-secondary flex flex-col gap-1">
            {GOOGLE_OAUTH_SCOPES.map((scope) => (
              <li key={scope} className="break-all">
                {scope}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Actions" />
        <CardBody>
          <GoogleActionsPanel />
        </CardBody>
      </Card>
    </div>
  );
}
