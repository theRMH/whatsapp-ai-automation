"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { testAIConnectionAction, type ActionResult } from "./actions";

export function AIActionsPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-sm font-semibold text-neutral-500 uppercase">Actions</h2>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await testAIConnectionAction();
            setResult(res);
            router.refresh();
          })
        }
        className="border rounded-md px-3 py-1.5 text-sm self-start disabled:opacity-50"
      >
        {isPending ? "Testing..." : "Test AI connection"}
      </button>
      {result?.error ? <p className="text-xs text-red-600">{result.error}</p> : null}
      {result?.success ? <p className="text-xs text-green-700 break-all">{result.success}</p> : null}
    </section>
  );
}
