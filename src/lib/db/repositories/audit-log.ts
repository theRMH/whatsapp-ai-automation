import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * Admin audit log (PRD 33.19, 25.4: "Operational audit records may retain
 * a pseudonymous user id and action timestamp but no content."). Every
 * admin mutation (user create/suspend/trial change/delete, integration
 * settings change) should be recorded here with safe metadata only -
 * never customer content or secret values.
 */

export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_SUSPENDED"
  | "USER_REACTIVATED"
  | "USER_DELETED"
  | "TRIAL_EXTENDED"
  | "TRIAL_SET_NO_EXPIRY"
  | "EVOLUTION_SETTINGS_UPDATED"
  | "AI_SETTINGS_UPDATED"
  | "GOOGLE_SETTINGS_UPDATED"
  | "GENERAL_SETTINGS_UPDATED";

export async function recordAuditLog(entry: {
  adminId: string;
  action: AuditAction;
  targetUserId?: string;
  safeMetadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from("admin_audit_logs").insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    safe_metadata: entry.safeMetadata ?? null,
  });

  if (error) {
    logger.error("audit_log_write_failed", { errorCode: error.code, action: entry.action });
    throw new Error(`Failed to record audit log: ${error.message}`);
  }
}

export interface AuditLogRecord {
  id: string;
  adminId: string;
  action: string;
  targetUserId: string | null;
  safeMetadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function listAuditLogs(params: {
  limit?: number;
  offset?: number;
  targetUserId?: string;
}): Promise<AuditLogRecord[]> {
  const db = getSupabaseAdminClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = db
    .from("admin_audit_logs")
    .select()
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.targetUserId) {
    query = query.eq("target_user_id", params.targetUserId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("audit_log_read_failed", { errorCode: error.code });
    throw new Error(`Failed to list audit logs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    action: row.action,
    targetUserId: row.target_user_id,
    safeMetadata: row.safe_metadata,
    createdAt: row.created_at,
  }));
}
