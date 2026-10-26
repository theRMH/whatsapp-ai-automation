"use client";

import { useActionState } from "react";
import { TextField, CheckboxField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveEvolutionSettingsAction, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

export function EvolutionSettingsForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    baseUrl: string;
    instanceName: string;
    assistantNumber: string;
    requestTimeoutMs: number;
    apiKeyMasked: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveEvolutionSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <CheckboxField name="enabled" label="Enabled" defaultChecked={initial.enabled} />

      <TextField
        name="baseUrl"
        label="Base URL"
        defaultValue={initial.baseUrl}
        placeholder="https://evolution.example.com"
        required
      />

      <TextField name="instanceName" label="Instance name" defaultValue={initial.instanceName} required />

      <TextField
        name="assistantNumber"
        label="Assistant WhatsApp number"
        defaultValue={initial.assistantNumber}
        placeholder="+919876543210"
      />

      <TextField
        name="requestTimeoutMs"
        label="Request timeout (ms)"
        type="number"
        defaultValue={initial.requestTimeoutMs}
      />

      <TextField
        name="apiKey"
        label="API key"
        type="password"
        hint={initial.apiKeyMasked ? `Saved: ${initial.apiKeyMasked}. Leave blank to keep current key.` : "Not set."}
        placeholder={initial.apiKeyMasked ? "Leave blank to keep current key" : ""}
      />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Button type="submit" variant="primary" loading={pending} className="self-start">
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
