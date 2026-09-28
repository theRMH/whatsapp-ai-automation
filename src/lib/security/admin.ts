import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";

/**
 * Authoritative admin authorization check. Middleware (PRD 23) redirects
 * unauthenticated requests away from /admin/* as a first gate, but PRD 23
 * also requires "server-side authorization on every admin action" and
 * "never rely only on hidden navigation" - so every admin server action
 * and every /api/admin/* route handler must call requireAdmin() itself.
 *
 * This checks two things: (1) a valid Supabase Auth session exists, and
 * (2) that session's user id has a row in the admins table. Having a
 * Supabase Auth account is not sufficient on its own - only rows in
 * `admins` are authorized (PRD 23: "admins table tied to auth.users.id").
 */

export class NotAuthenticatedError extends Error {
  constructor() {
    super("No authenticated session");
    this.name = "NotAuthenticatedError";
  }
}

export class NotAnAdminError extends Error {
  constructor() {
    super("Authenticated user is not an admin");
    this.name = "NotAnAdminError";
  }
}

export interface AuthorizedAdmin {
  id: string;
  email: string;
}

/**
 * Throws NotAuthenticatedError or NotAnAdminError if the current request
 * is not from an authorized admin. Call this at the top of every admin
 * server action and every /api/admin/* route handler before doing
 * anything else.
 */
export async function requireAdmin(): Promise<AuthorizedAdmin> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new NotAuthenticatedError();
  }

  // Use the service-role client for the admins lookup so it is not
  // subject to the anon-role RLS policy on the admins table (there is
  // deliberately no anon/authenticated SELECT policy on admins).
  const db = getSupabaseAdminClient();
  const { data: adminRow, error: adminError } = await db
    .from("admins")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    throw new NotAnAdminError();
  }

  return { id: adminRow.id, email: adminRow.email };
}
