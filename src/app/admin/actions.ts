"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
