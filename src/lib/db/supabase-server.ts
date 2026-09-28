import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the admin dashboard's server-rendered pages and
 * server actions, bound to the current request's auth cookies. Uses the
 * anon key + RLS (not the service role key) so admin session auth is
 * enforced by Supabase Auth itself.
 *
 * This is for ADMIN AUTH ONLY (PRD 23, 28: "Use Supabase Auth only for
 * the private admin dashboard"). Customer data access never goes through
 * this client - use lib/db/supabase-admin.ts + a repository function.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component without a mutable response;
          // safe to ignore because middleware refreshes the session.
        }
      },
    },
  });
}
