import { DateTime } from "luxon";
import type { UserRecord } from "@/lib/db/repositories/users";
import { checkAndIncrementInboundRateLimit } from "@/lib/db/repositories/usage";

/**
 * Central access check (PRD 44: assertUserCanUseAssistant). Must gate
 * every AI call, Google action, and proactive reminder dispatch - not
 * only the WhatsApp webhook layer, because internal jobs (e.g. the
 * reminder dispatcher) also act on behalf of users without an inbound
 * message triggering them (PRD 44: "Do not enforce only at the WhatsApp
 * webhook layer because internal jobs also act for users.").
 */

export type AccessDenialReason = "USER_SUSPENDED" | "TRIAL_EXPIRED" | "RATE_LIMITED";

export class AccessDeniedError extends Error {
  constructor(public readonly reason: AccessDenialReason) {
    super(reason);
    this.name = "AccessDeniedError";
  }
}

/** Status/trial check only - no rate limiting or side effects (PRD 44). */
export function isUserAllowedByStatusAndTrial(user: UserRecord): AccessDenialReason | null {
  if (user.status === "SUSPENDED") {
    return "USER_SUSPENDED";
  }

  if (user.accessMode === "TRIAL") {
    if (!user.trialEndAt || DateTime.utc() > DateTime.fromISO(user.trialEndAt, { zone: "utc" })) {
      return "TRIAL_EXPIRED";
    }
  }

  return null;
}

/**
 * Full check including the per-minute inbound rate limit. Only call the
 * rate-limit-inclusive variant from the inbound webhook path (it
 * increments a counter as a side effect); use
 * isUserAllowedByStatusAndTrial alone for the reminder dispatcher, which
 * has no per-minute inbound counter to check.
 */
export async function assertUserCanUseAssistant(user: UserRecord): Promise<void> {
  const statusReason = isUserAllowedByStatusAndTrial(user);
  if (statusReason) {
    throw new AccessDeniedError(statusReason);
  }

  const rateLimit = await checkAndIncrementInboundRateLimit(user.id);
  if (!rateLimit.allowed) {
    throw new AccessDeniedError("RATE_LIMITED");
  }
}
