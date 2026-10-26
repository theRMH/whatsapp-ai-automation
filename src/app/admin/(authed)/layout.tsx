import { requireAdmin } from "@/lib/security/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { signOutAction } from "../actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <AdminShell adminEmail={admin.email} signOutAction={signOutAction}>
      {children}
    </AdminShell>
  );
}
