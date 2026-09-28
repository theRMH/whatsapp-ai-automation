/**
 * Shared bearer-token check for internal cron-triggered routes (PRD 49:
 * "Internal protected route... Require internal secret", 72). Used by
 * /api/internal/jobs/sweep, and will be reused by
 * /api/internal/reminders/dispatch in a later phase.
 */
export function isAuthorizedInternalRequest(request: Request): boolean {
  const expected = process.env.INTERNAL_CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  return header.slice("Bearer ".length) === expected;
}
