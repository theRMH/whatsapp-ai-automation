import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin";
import { signOutAction } from "./actions";

export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="flex-1 p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Admin dashboard</h1>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-neutral-500 hover:text-black">
            Sign out
          </button>
        </form>
      </div>
      <p className="text-sm text-neutral-600 mb-6">Signed in as {admin.email}.</p>
      <div className="flex flex-col gap-2">
        <Link href="/admin/users" className="underline text-sm">
          Manage users
        </Link>
        <Link href="/admin/settings/evolution" className="underline text-sm">
          Evolution API settings
        </Link>
        <Link href="/admin/settings/ai" className="underline text-sm">
          AI settings
        </Link>
      </div>
    </main>
  );
}
