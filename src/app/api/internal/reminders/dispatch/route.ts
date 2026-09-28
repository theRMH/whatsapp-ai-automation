import { dispatchDueReminders } from "@/lib/reminders/dispatcher";
import { isAuthorizedInternalRequest } from "@/lib/security/internal-auth";

/**
 * Reminder dispatch endpoint (PRD 13, 72). Called every minute by
 * Supabase Cron (pg_cron + pg_net, see supabase/migrations/0007). Protected
 * by the same INTERNAL_CRON_SECRET bearer token as /api/internal/jobs/sweep.
 */

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedInternalRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const summary = await dispatchDueReminders();

  return Response.json(summary);
}
