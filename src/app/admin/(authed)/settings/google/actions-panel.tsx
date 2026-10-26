"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { validateConfigurationAction, type ActionResult } from "./actions";

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

export function GoogleActionsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <ActionButton label="Validate configuration" onRun={validateConfigurationAction} />
    </div>
  );
}
