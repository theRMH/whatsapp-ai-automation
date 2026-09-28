"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

export interface LoginFormState {
  error: string | null;
}

export async function signInAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logger.warn("admin_login_failed", { errorCode: error.code ?? "unknown" });
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}
