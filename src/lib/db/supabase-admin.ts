import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 *
 * PRD 35: "The Supabase service role key: server only, never browser
 * bundle, never admin page source, never logs." This module must never
 * be imported from client components. All customer data access from
 * WhatsApp/webhook/cron code paths goes through this client, and every
 * repository function built on top of it must take a userId and scope
 * its query accordingly (never expose a getAllX() to callers).
 */

let cachedClient: SupabaseClient | null = null;

function assertServerEnvironment(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabase-admin.ts was imported in a browser context. The service role client must never run client-side."
    );
  }
}

export function getSupabaseAdminClient(): SupabaseClient {
  assertServerEnvironment();

  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
