"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
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
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={isPending}
        className="self-start"
        onClick={() =>
          startTransition(async () => {
            const res = await onRun();
            setResult(res);
            router.refresh();
          })
        }
      >
        {isPending ? "Running..." : label}
      </Button>
      {result?.error ? <Alert tone="danger">{result.error}</Alert> : null}
      {result?.success ? <Alert tone="success">{result.success}</Alert> : null}
    </div>
  );
}

export function EvolutionActionsPanel({ webhookTokenSet }: { webhookTokenSet: boolean }) {
  const [testState, testFormAction, testPending] = useActionState(sendTestMessageAction, initialState);

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-6">
        <h3 className="text-sm font-semibold text-text-primary">Send test message</h3>
        <form action={testFormAction} className="flex flex-col gap-3 max-w-sm">
          <TextField id="to" name="to" label="Destination number" placeholder="+919876543210" required />
          <TextField id="text" name="text" label="Message text" required />
          {testState.error ? <Alert tone="danger">{testState.error}</Alert> : null}
          {testState.success ? <Alert tone="success">{testState.success}</Alert> : null}
          <Button type="submit" variant="secondary" loading={testPending} className="self-start">
            {testPending ? "Sending..." : "Send test message"}
          </Button>
        </form>
      </div>
    </div>
  );
}
