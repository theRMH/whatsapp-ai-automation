"use client";

import { useActionState } from "react";
import { TextField, CheckboxField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveAISettingsAction, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

export function AISettingsForm({
  initial,
}: {
  initial: {
    provider: string;
    apiBaseUrl: string;
    primaryModel: string;
    fallbackModel: string;
    enableFallback: boolean;
    temperature: number;
    maxOutputTokens: number;
    requestTimeoutMs: number;
    maxToolIterations: number;
    apiKeyMasked: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveAISettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField name="provider" label="Provider" defaultValue={initial.provider} required />

      <TextField
        name="apiBaseUrl"
        label="API base URL"
        defaultValue={initial.apiBaseUrl}
        placeholder="https://openrouter.ai/api/v1"
        required
      />

      <TextField
        name="primaryModel"
        label="Primary model"
        defaultValue={initial.primaryModel}
        placeholder="openai/gpt-4o-mini"
        required
      />

      <TextField
        name="fallbackModel"
        label="Fallback model"
        defaultValue={initial.fallbackModel}
        placeholder="anthropic/claude-haiku-4-5"
      />

      <CheckboxField name="enableFallback" label="Enable fallback model" defaultChecked={initial.enableFallback} />

      <TextField
        name="temperature"
        label="Temperature"
        type="number"
        step="0.1"
        min="0"
        max="2"
        defaultValue={initial.temperature}
      />

      <TextField
        name="maxOutputTokens"
        label="Maximum output tokens"
        type="number"
        defaultValue={initial.maxOutputTokens}
      />

      <TextField
        name="requestTimeoutMs"
        label="Request timeout (ms)"
        type="number"
        defaultValue={initial.requestTimeoutMs}
      />

      <TextField
        name="maxToolIterations"
        label="Maximum tool iterations"
        type="number"
        defaultValue={initial.maxToolIterations}
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
