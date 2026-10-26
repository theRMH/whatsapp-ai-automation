import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin";
import { listUsers } from "@/lib/db/repositories/users";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";

const QUICK_LINKS = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Add, suspend, and manage customer access.",
  },
  {
    href: "/admin/settings/evolution",
    title: "Evolution API",
    description: "WhatsApp connectivity and webhook configuration.",
  },
  {
    href: "/admin/settings/ai",
    title: "AI",
    description: "Model provider, prompts, and generation limits.",
  },
  {
    href: "/admin/settings/google",
    title: "Google",
    description: "OAuth credentials for Calendar and Sheets access.",
  },
];

export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const { users, total } = await listUsers({ limit: 100 });
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const suspendedCount = total - activeCount;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <PageHeader title="Dashboard" description={`Signed in as ${admin.email}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={total} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Suspended" value={suspendedCount} tone={suspendedCount > 0 ? "warning" : undefined} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Quick links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="block">
              <Card className="h-full transition-colors duration-150 hover:border-accent/40">
                <CardBody className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text-primary">{link.title}</span>
                    <span className="text-sm text-text-secondary">{link.description}</span>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-text-primary";
  return (
    <Card>
      <CardBody className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</span>
      </CardBody>
    </Card>
  );
}
