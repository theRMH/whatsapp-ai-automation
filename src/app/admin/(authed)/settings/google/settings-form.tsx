"use client";

import { useActionState } from "react";
import { TextField, CheckboxField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveGoogleSettingsAction, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

export function GoogleSettingsForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    clientId: string;
    projectNumber: string;
    calendarEnabled: boolean;
    sheetsEnabled: boolean;
    clientSecretMasked: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveGoogleSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <CheckboxField name="enabled" label="Google integration enabled" defaultChecked={initial.enabled} />

      <TextField name="clientId" label="OAuth Client ID" defaultValue={initial.clientId} />

      <TextField
        name="clientSecret"
        label="OAuth Client Secret"
        type="password"
        hint={
          initial.clientSecretMasked
            ? `Saved: ${initial.clientSecretMasked}. Leave blank to keep current secret.`
            : "Not set."
        }
        placeholder={initial.clientSecretMasked ? "Leave blank to keep current secret" : ""}
      />

      <TextField
        name="projectNumber"
        label="Google Cloud project number / App ID"
        defaultValue={initial.projectNumber}
      />

      <CheckboxField name="calendarEnabled" label="Calendar enabled" defaultChecked={initial.calendarEnabled} />

      <CheckboxField name="sheetsEnabled" label="Sheets enabled" defaultChecked={initial.sheetsEnabled} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Button type="submit" variant="primary" loading={pending} className="self-start">
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
