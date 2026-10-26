"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { testAIConnectionAction, type ActionResult } from "./actions";

export function AIActionsPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={isPending}
        className="self-start"
        onClick={() =>
          startTransition(async () => {
            const res = await testAIConnectionAction();
            setResult(res);
            router.refresh();
          })
        }
      >
        {isPending ? "Testing..." : "Test AI connection"}
      </Button>
      {result?.error ? <Alert tone="danger">{result.error}</Alert> : null}
      {result?.success ? <Alert tone="success">{result.success}</Alert> : null}
    </div>
  );
}
