"use client";

import { useActionState } from "react";
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
      <div className="flex flex-col gap-1">
        <label htmlFor="provider" className="text-sm font-medium">
          Provider
        </label>
        <input
          id="provider"
          name="provider"
          defaultValue={initial.provider}
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="apiBaseUrl" className="text-sm font-medium">
          API base URL
        </label>
        <input
          id="apiBaseUrl"
          name="apiBaseUrl"
          defaultValue={initial.apiBaseUrl}
          placeholder="https://openrouter.ai/api/v1"
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="primaryModel" className="text-sm font-medium">
          Primary model
        </label>
        <input
          id="primaryModel"
          name="primaryModel"
          defaultValue={initial.primaryModel}
          placeholder="openai/gpt-4o-mini"
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fallbackModel" className="text-sm font-medium">
          Fallback model
        </label>
        <input
          id="fallbackModel"
          name="fallbackModel"
          defaultValue={initial.fallbackModel}
          placeholder="anthropic/claude-haiku-4-5"
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enableFallback" defaultChecked={initial.enableFallback} />
        Enable fallback model
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="temperature" className="text-sm font-medium">
          Temperature
        </label>
        <input
          id="temperature"
          name="temperature"
          type="number"
          step="0.1"
          min="0"
          max="2"
          defaultValue={initial.temperature}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="maxOutputTokens" className="text-sm font-medium">
          Maximum output tokens
        </label>
        <input
          id="maxOutputTokens"
          name="maxOutputTokens"
          type="number"
          defaultValue={initial.maxOutputTokens}
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
        <label htmlFor="maxToolIterations" className="text-sm font-medium">
          Maximum tool iterations
        </label>
        <input
          id="maxToolIterations"
          name="maxToolIterations"
          type="number"
          defaultValue={initial.maxToolIterations}
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
