import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/security/admin";
import { getUserById } from "@/lib/db/repositories/users";
import { getUsageHistory } from "@/lib/db/repositories/usage";
import { listAuditLogs } from "@/lib/db/repositories/audit-log";
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
    <main className="flex-1 p-8 flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.name}</h1>
        <Link href="/admin/users" className="text-sm text-neutral-500 hover:text-black">
          Back to users
        </Link>
      </div>

      <UserActions user={user} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase">Edit profile</h2>
        <EditUserForm user={user} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase">Usage (last 14 days)</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 pr-4">Date</th>
              <th className="py-1 pr-4">Inbound</th>
              <th className="py-1 pr-4">AI requests</th>
              <th className="py-1 pr-4">Google</th>
              <th className="py-1 pr-4">Reminders sent</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((day) => (
              <tr key={day.usageDate} className="border-b">
                <td className="py-1 pr-4">{day.usageDate}</td>
                <td className="py-1 pr-4">{day.inboundMessages}</td>
                <td className="py-1 pr-4">{day.aiRequests}</td>
                <td className="py-1 pr-4">{day.googleRequests}</td>
                <td className="py-1 pr-4">{day.remindersSent}</td>
              </tr>
            ))}
            {usage.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-400">
                  No usage recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase">Audit history</h2>
        <ul className="text-sm flex flex-col gap-1">
          {auditLogs.map((log) => (
            <li key={log.id} className="text-neutral-600">
              {new Date(log.createdAt).toLocaleString()} — {log.action}
            </li>
          ))}
          {auditLogs.length === 0 ? (
            <li className="text-neutral-400">No audit events yet.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
