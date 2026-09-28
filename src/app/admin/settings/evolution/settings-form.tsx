"use client";

import { useActionState } from "react";
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
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} />
        Enabled
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="baseUrl" className="text-sm font-medium">
          Base URL
        </label>
        <input
          id="baseUrl"
          name="baseUrl"
          defaultValue={initial.baseUrl}
          placeholder="https://evolution.example.com"
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="instanceName" className="text-sm font-medium">
          Instance name
        </label>
        <input
          id="instanceName"
          name="instanceName"
          defaultValue={initial.instanceName}
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="assistantNumber" className="text-sm font-medium">
          Assistant WhatsApp number
        </label>
        <input
          id="assistantNumber"
          name="assistantNumber"
          defaultValue={initial.assistantNumber}
          placeholder="+919876543210"
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="requestTimeoutMs" className="text-sm font-medium">
          Request timeout (ms)
        </label>
        <input
          id="requestTimeoutMs"
          name="requestTimeoutMs"
          type="number"
          defaultValue={initial.requestTimeoutMs}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="apiKey" className="text-sm font-medium">
          API key {initial.apiKeyMasked ? `(saved: ${initial.apiKeyMasked})` : "(not set)"}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder={initial.apiKeyMasked ? "Leave blank to keep current key" : ""}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 self-start"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
