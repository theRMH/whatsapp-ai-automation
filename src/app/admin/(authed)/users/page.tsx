import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin";
import { listUsers } from "@/lib/db/repositories/users";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "./new-user-form";

function formatTrial(user: Awaited<ReturnType<typeof listUsers>>["users"][number]): string {
  if (user.accessMode === "NO_EXPIRY") return "No expiry";
  if (!user.trialEndAt) return "Trial (no end date set)";
  const end = new Date(user.trialEndAt);
  const expired = end.getTime() < Date.now();
  return `${expired ? "Expired" : "Trial ends"} ${end.toLocaleDateString()}`;
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const { users, total } = await listUsers({ limit: 100 });

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <PageHeader title="Users" description={`${total} total`} />

      <NewUserForm />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-border-subtle">
              <th className="py-3 px-5 font-medium text-text-secondary">Name</th>
              <th className="py-3 px-5 font-medium text-text-secondary">Phone</th>
              <th className="py-3 px-5 font-medium text-text-secondary">Status</th>
              <th className="py-3 px-5 font-medium text-text-secondary">Access</th>
              <th className="py-3 px-5 font-medium text-text-secondary">Timezone</th>
              <th className="py-3 px-5 font-medium text-text-secondary">Last active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-muted">
                <td className="py-3 px-5">
                  <Link href={`/admin/users/${user.id}`} className="font-medium text-accent hover:text-accent-hover">
                    {user.name}
                  </Link>
                </td>
                <td className="py-3 px-5 font-mono text-xs text-text-secondary">
                  {user.phoneE164.slice(0, -4).replace(/\d/g, "•")}
                  {user.phoneE164.slice(-4)}
                </td>
                <td className="py-3 px-5">
                  <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>
                </td>
                <td className="py-3 px-5 text-text-secondary">{formatTrial(user)}</td>
                <td className="py-3 px-5 text-text-secondary">{user.timezone}</td>
                <td className="py-3 px-5 text-text-secondary">
                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "Never"}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-text-tertiary">
                  No users yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
