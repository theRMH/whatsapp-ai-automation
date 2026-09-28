import { getSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { encryptConfigSecret, decryptConfigSecret, maskSecret } from "@/lib/crypto/config-encryption";
import { logger } from "@/lib/logger";

/**
 * Typed settings repository over the system_settings table (PRD 33.4,
 * 54). Every integration config (Evolution, AI, Google, reminders,
 * general, privacy, system messages) is read/written through this
 * module so callers never touch raw rows or secret encryption directly.
 *
 * PRD constraint: "Never store a secret both in plaintext and encrypted
 * form" - enforced by a DB check constraint in 0001_initial_schema.sql
 * and mirrored here by always routing secret fields through
 * encryptConfigSecret()/is_secret=true and non-secret fields through
 * value_json/is_secret=false.
 *
 * A short in-memory cache avoids a DB round trip on every request for
 * settings that rarely change, with manual invalidation after any admin
 * write (PRD 54: "Cache non-user settings briefly in memory where safe,
 * but support invalidation after admin changes").
 */

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function invalidate(key: string): void {
  cache.delete(key);
}

interface RawSettingValue {
  valueJson: unknown;
  encryptedSecret: string | null;
  isSecret: boolean;
}

async function getRawValue(key: string): Promise<RawSettingValue | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as RawSettingValue | null;
  }

  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("system_settings")
    .select("value_json, encrypted_secret, is_secret")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    logger.error("settings_read_failed", { key, errorCode: error.code });
    throw new Error(`Failed to read setting: ${key}`);
  }

  const result = data
    ? { valueJson: data.value_json, encryptedSecret: data.encrypted_secret, isSecret: data.is_secret }
    : null;

  cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/** Reads a non-secret JSON-valued setting. Returns fallback if unset. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await getRawValue(key);
  if (!raw || raw.valueJson === null || raw.valueJson === undefined) {
    return fallback;
  }
  return raw.valueJson as T;
}

/** Writes a non-secret JSON-valued setting. */
export async function setSetting(key: string, value: unknown, updatedByAdminId?: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from("system_settings").upsert(
    {
      key,
      value_json: value,
      encrypted_secret: null,
      is_secret: false,
      updated_at: new Date().toISOString(),
      updated_by: updatedByAdminId ?? null,
    },
    { onConflict: "key" }
  );

  if (error) {
    logger.error("settings_write_failed", { key, errorCode: error.code });
    throw new Error(`Failed to write setting: ${key}`);
  }

  invalidate(key);
}

/**
 * Reads and decrypts a secret setting server-side (e.g. for making an
 * actual API call to Evolution/OpenRouter/Google). Never expose the
 * return value of this function to the browser or to an admin UI
 * response - only use it to make the outbound request itself.
 */
export async function getSecret(key: string): Promise<string | null> {
  const raw = await getRawValue(key);
  if (!raw || !raw.encryptedSecret) {
    return null;
  }
  return decryptConfigSecret(raw.encryptedSecret);
}

/** Writes a secret setting, encrypting it before persistence. */
export async function setSecret(key: string, plaintext: string, updatedByAdminId?: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const encrypted = encryptConfigSecret(plaintext);

  const { error } = await db.from("system_settings").upsert(
    {
      key,
      value_json: null,
      encrypted_secret: encrypted,
      is_secret: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedByAdminId ?? null,
    },
    { onConflict: "key" }
  );

  if (error) {
    logger.error("settings_write_failed", { key, errorCode: error.code });
    throw new Error(`Failed to write secret: ${key}`);
  }

  invalidate(key);
}

/**
 * Returns a masked display value for a secret setting, safe to send to
 * the admin UI (PRD 27.1: "Never return the complete saved secret to the
 * browser again"). Returns null if unset.
 */
export async function getMaskedSecret(key: string): Promise<string | null> {
  const plaintext = await getSecret(key);
  if (plaintext === null) return null;
  return maskSecret(plaintext);
}

/** Whether a secret setting has been saved at all (without revealing it). */
export async function hasSecret(key: string): Promise<boolean> {
  const raw = await getRawValue(key);
  return !!raw?.encryptedSecret;
}

export function __clearSettingsCacheForTests(): void {
  cache.clear();
}
