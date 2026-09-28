import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin";
import { listUsers } from "@/lib/db/repositories/users";
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
    <main className="flex-1 p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-neutral-500">{total} total</p>
        </div>
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-black">
          Back to dashboard
        </Link>
      </div>

      <NewUserForm />

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Phone</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Access</th>
            <th className="py-2 pr-4">Timezone</th>
            <th className="py-2 pr-4">Last active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b hover:bg-neutral-50">
              <td className="py-2 pr-4">
                <Link href={`/admin/users/${user.id}`} className="underline">
                  {user.name}
                </Link>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">
                {user.phoneE164.slice(0, -4).replace(/\d/g, "•")}
                {user.phoneE164.slice(-4)}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={
                    user.status === "ACTIVE" ? "text-green-700" : "text-red-700"
                  }
                >
                  {user.status}
                </span>
              </td>
              <td className="py-2 pr-4">{formatTrial(user)}</td>
              <td className="py-2 pr-4">{user.timezone}</td>
              <td className="py-2 pr-4">
                {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "Never"}
              </td>
            </tr>
          ))}
          {users.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-neutral-400">
                No users yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
