import { DateTime } from "luxon";
import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createUserKeyRecord, type UserKeyRecord } from "@/lib/crypto/user-encryption";
import { normalizeToE164 } from "@/lib/phone/normalize";
import { getSetting } from "./settings";
import { SettingsKeys, SettingsDefaults } from "./settings-keys";
import { logger } from "@/lib/logger";

/**
 * Users repository (PRD 33.2, 25). Admin-manual allowlist only - there is
 * no self-serve signup, so every user row here originates from an admin
 * action (PRD 6.1: "The admin creates users... There is no customer
 * registration.").
 *
 * Every function that reads/writes customer-scoped data elsewhere in this
 * app must take a userId; this repository is the one place userId values
 * themselves come from, keyed off the E.164 phone (PRD 25.2: "Normalize
 * and validate phone to E.164. Phone must be unique.").
 */

export type UserStatus = "ACTIVE" | "SUSPENDED";
export type AccessMode = "TRIAL" | "NO_EXPIRY";

export interface UserRecord {
  id: string;
  name: string;
  phoneE164: string;
  phoneJid: string | null;
  timezone: string;
  status: UserStatus;
  accessMode: AccessMode;
  trialStartAt: string | null;
  trialEndAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  name: string;
  phone_e164: string;
  phone_jid: string | null;
  timezone: string;
  status: UserStatus;
  access_mode: AccessMode;
  trial_start_at: string | null;
  trial_end_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phone_e164,
    phoneJid: row.phone_jid,
    timezone: row.timezone,
    status: row.status,
    accessMode: row.access_mode,
    trialStartAt: row.trial_start_at,
    trialEndAt: row.trial_end_at,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TrialOption =
  | { kind: "DEFAULT" }
  | { kind: "CUSTOM_END_DATE"; trialEndAt: string }
  | { kind: "NO_EXPIRY" };

export interface CreateUserInput {
  name: string;
  phone: string;
  timezone: string;
  trialOption: TrialOption;
  defaultCountry?: string;
}

/**
 * Creates a new authorized user (PRD 25.2). Also provisions the user's
 * per-user data encryption key record (PRD 34.2) so every other
 * repository can encrypt that user's content immediately.
 */
export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const phoneE164 = normalizeToE164(input.phone, input.defaultCountry);
  const db = getSupabaseAdminClient();

  let accessMode: AccessMode;
  let trialStartAt: string | null;
  let trialEndAt: string | null;

  if (input.trialOption.kind === "NO_EXPIRY") {
    accessMode = "NO_EXPIRY";
    trialStartAt = null;
    trialEndAt = null;
  } else {
    accessMode = "TRIAL";
    trialStartAt = DateTime.utc().toISO();
    if (input.trialOption.kind === "CUSTOM_END_DATE") {
      trialEndAt = input.trialOption.trialEndAt;
    } else {
      const defaultTrialDays = await getSetting<number>(
        SettingsKeys.DEFAULT_TRIAL_DAYS,
        SettingsDefaults.DEFAULT_TRIAL_DAYS
      );
      trialEndAt = DateTime.utc().plus({ days: defaultTrialDays }).toISO();
    }
  }

  const { data, error } = await db
    .from("users")
    .insert({
      name: input.name,
      phone_e164: phoneE164,
      timezone: input.timezone,
      status: "ACTIVE",
      access_mode: accessMode,
      trial_start_at: trialStartAt,
      trial_end_at: trialEndAt,
    })
    .select()
    .single();

  if (error) {
    logger.error("user_create_failed", { errorCode: error.code });
    throw new Error(`Failed to create user: ${error.message}`);
  }

  const row = data as UserRow;

  const keyRecord = await createUserKeyRecord();
  const { error: keyError } = await db.from("user_keys").insert({
    user_id: row.id,
    encrypted_dek: keyRecord.encryptedDek,
    key_version: keyRecord.keyVersion,
  });

  if (keyError) {
    logger.error("user_key_provision_failed", { errorCode: keyError.code });
    throw new Error(`Failed to provision encryption key for new user: ${keyError.message}`);
  }

  return mapRow(row);
}

/** Reads a user's wrapped DEK record (PRD 34.2), needed to encrypt/decrypt their content. */
export async function getUserKeyRecord(userId: string): Promise<UserKeyRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("user_keys")
    .select("encrypted_dek, key_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("user_key_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read user key: ${error.message}`);
  }

  return data ? { encryptedDek: data.encrypted_dek, keyVersion: data.key_version } : null;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("users").select().eq("id", userId).maybeSingle();

  if (error) {
    logger.error("user_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read user: ${error.message}`);
  }

  return data ? mapRow(data as UserRow) : null;
}

/** Looks up an authorized user by normalized E.164 phone (PRD 36.1 step 10). */
export async function getUserByPhone(phoneE164: string): Promise<UserRecord | null> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("users")
    .select()
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (error) {
    logger.error("user_read_failed", { errorCode: error.code });
    throw new Error(`Failed to read user: ${error.message}`);
  }

  return data ? mapRow(data as UserRow) : null;
}

export interface ListUsersResult {
  users: UserRecord[];
  total: number;
}

export async function listUsers(params: {
  limit?: number;
  offset?: number;
}): Promise<ListUsersResult> {
  const db = getSupabaseAdminClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const { data, error, count } = await db
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("user_list_failed", { errorCode: error.code });
    throw new Error(`Failed to list users: ${error.message}`);
  }

  return {
    users: (data as UserRow[]).map(mapRow),
    total: count ?? 0,
  };
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  timezone?: string;
  defaultCountry?: string;
}

/** Edits mutable profile fields (PRD 25.3). */
export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserRecord> {
  const db = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.phone !== undefined) {
    patch.phone_e164 = normalizeToE164(input.phone, input.defaultCountry);
  }

  const { data, error } = await db
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    logger.error("user_update_failed", { errorCode: error.code });
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return mapRow(data as UserRow);
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<UserRecord> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("users")
    .update({ status })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    logger.error("user_status_update_failed", { errorCode: error.code });
    throw new Error(`Failed to update user status: ${error.message}`);
  }

  return mapRow(data as UserRow);
}

export type TrialUpdate =
  | { kind: "EXTEND_TRIAL"; trialEndAt: string }
  | { kind: "SET_NO_EXPIRY" };

/** Extends a trial or switches a user to no-expiry (PRD 25.3, 6.4). */
export async function updateUserTrial(
  userId: string,
  update: TrialUpdate
): Promise<UserRecord> {
  const db = getSupabaseAdminClient();

  const patch =
    update.kind === "SET_NO_EXPIRY"
      ? { access_mode: "NO_EXPIRY" as const, trial_end_at: null }
      : { access_mode: "TRIAL" as const, trial_end_at: update.trialEndAt };

  const { data, error } = await db
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    logger.error("user_trial_update_failed", { errorCode: error.code });
    throw new Error(`Failed to update trial: ${error.message}`);
  }

  return mapRow(data as UserRow);
}

export async function touchLastActive(userId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    logger.error("user_touch_last_active_failed", { errorCode: error.code });
  }
}

/**
 * Deletes a user and all owned content (PRD 25.4: "Deletion should
 * remove: tasks, reminders, recurrence series, memories, prospects,
 * recent conversation context, document references, sheet references,
 * Google tokens, per-user encryption key record, usage details where
 * privacy requires."). Every listed table has `on delete cascade` on its
 * user_id FK (see 0001_initial_schema.sql), so deleting the users row is
 * sufficient; nothing else needs to be deleted manually.
 */
export async function deleteUser(userId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from("users").delete().eq("id", userId);

  if (error) {
    logger.error("user_delete_failed", { errorCode: error.code });
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}
