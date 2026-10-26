import { cn } from "@/lib/cn";

type AlertTone = "success" | "danger";

const TONE_CLASSES: Record<AlertTone, string> = {
  success: "bg-success-bg text-success border-success/20",
  danger: "bg-danger-bg text-danger border-danger/20",
};

const ICONS: Record<AlertTone, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.345 11.29c.75 1.334-.213 2.98-1.742 2.98H3.654c-1.53 0-2.492-1.646-1.743-2.98l6.346-11.29zM10 8a1 1 0 011 1v3a1 1 0 11-2 0V9a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export function Alert({ tone, children }: { tone: AlertTone; children: React.ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm", TONE_CLASSES[tone])}
    >
      {ICONS[tone]}
      <span>{children}</span>
    </div>
  );
}
