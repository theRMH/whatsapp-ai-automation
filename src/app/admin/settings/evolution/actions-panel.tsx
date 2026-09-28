"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  testConnectionAction,
  checkInstanceStatusAction,
  configureWebhookAction,
  verifyWebhookAction,
  generateWebhookTokenAction,
  sendTestMessageAction,
  type ActionResult,
} from "./actions";

const initialState: ActionResult = { error: null };

function ActionButton({
  label,
  onRun,
}: {
  label: string;
  onRun: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await onRun();
            setResult(res);
            router.refresh();
          })
        }
        className="border rounded-md px-3 py-1.5 text-sm self-start disabled:opacity-50"
      >
        {isPending ? "Running..." : label}
      </button>
      {result?.error ? <p className="text-xs text-red-600">{result.error}</p> : null}
      {result?.success ? <p className="text-xs text-green-700 break-all">{result.success}</p> : null}
    </div>
  );
}

export function EvolutionActionsPanel({ webhookTokenSet }: { webhookTokenSet: boolean }) {
  const [testState, testFormAction, testPending] = useActionState(sendTestMessageAction, initialState);

  return (
    <section className="flex flex-col gap-6 border-t pt-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase mb-3">Actions</h2>
        <div className="flex flex-col gap-3">
          <ActionButton label="Test API connection" onRun={testConnectionAction} />
          <ActionButton label="Check instance status" onRun={checkInstanceStatusAction} />
          <ActionButton
            label={webhookTokenSet ? "Regenerate webhook token" : "Generate webhook token"}
            onRun={generateWebhookTokenAction}
          />
          <ActionButton label="Configure webhook" onRun={configureWebhookAction} />
          <ActionButton label="Verify webhook configuration" onRun={verifyWebhookAction} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase mb-3">Send test message</h2>
        <form action={testFormAction} className="flex flex-col gap-3 max-w-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-sm font-medium">
              Destination number
            </label>
            <input
              id="to"
              name="to"
              placeholder="+919876543210"
              required
              className="border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="text" className="text-sm font-medium">
              Message text
            </label>
            <input id="text" name="text" required className="border rounded-md px-3 py-2 text-sm" />
          </div>
          {testState.error ? <p className="text-sm text-red-600">{testState.error}</p> : null}
          {testState.success ? <p className="text-sm text-green-700">{testState.success}</p> : null}
          <button
            type="submit"
            disabled={testPending}
            className="border rounded-md px-3 py-1.5 text-sm self-start disabled:opacity-50"
          >
            {testPending ? "Sending..." : "Send test message"}
          </button>
        </form>
      </div>
    </section>
  );
}
