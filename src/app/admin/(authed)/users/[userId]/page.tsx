import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/security/admin";
import { getUserById } from "@/lib/db/repositories/users";
import { getUsageHistory } from "@/lib/db/repositories/usage";
import { listAuditLogs } from "@/lib/db/repositories/audit-log";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EditUserForm } from "./edit-user-form";
import { UserActions } from "./user-actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;

  const user = await getUserById(userId);
  if (!user) notFound();

  const [usage, auditLogs] = await Promise.all([
    getUsageHistory(userId, 14),
    listAuditLogs({ targetUserId: userId, limit: 20 }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-2xl">
      <PageHeader title={user.name} description={user.phoneE164} />

      <UserActions user={user} />

      <Card>
        <CardHeader title="Edit profile" />
        <CardBody>
          <EditUserForm user={user} />
        </CardBody>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader title="Usage" description="Last 14 days" />
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-border-subtle">
              <th className="py-2 px-5 font-medium text-text-secondary">Date</th>
              <th className="py-2 px-5 font-medium text-text-secondary">Inbound</th>
              <th className="py-2 px-5 font-medium text-text-secondary">AI requests</th>
              <th className="py-2 px-5 font-medium text-text-secondary">Google</th>
              <th className="py-2 px-5 font-medium text-text-secondary">Reminders sent</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((day) => (
              <tr key={day.usageDate} className="border-b border-border-subtle last:border-0">
                <td className="py-2 px-5 text-text-primary">{day.usageDate}</td>
                <td className="py-2 px-5 text-text-secondary tabular-nums">{day.inboundMessages}</td>
                <td className="py-2 px-5 text-text-secondary tabular-nums">{day.aiRequests}</td>
                <td className="py-2 px-5 text-text-secondary tabular-nums">{day.googleRequests}</td>
                <td className="py-2 px-5 text-text-secondary tabular-nums">{day.remindersSent}</td>
              </tr>
            ))}
            {usage.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-tertiary">
                  No usage recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Audit history" />
        <CardBody>
          <ul className="flex flex-col gap-2 text-sm">
            {auditLogs.map((log) => (
              <li key={log.id} className="text-text-secondary">
                <span className="text-text-tertiary">{new Date(log.createdAt).toLocaleString()}</span> — {log.action}
              </li>
            ))}
            {auditLogs.length === 0 ? <li className="text-text-tertiary">No audit events yet.</li> : null}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
