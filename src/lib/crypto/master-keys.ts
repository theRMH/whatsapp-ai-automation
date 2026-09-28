import { AES_KEY_LENGTH_BYTES, EncryptionError } from "./aes";

/**
 * Loads and validates the two master keys from environment variables.
 * Per PRD 34.2/34.3, these are environment secrets and are never stored
 * in Supabase:
 *
 *   APP_MASTER_KEY    - wraps each user's per-user DEK (user_keys table)
 *   CONFIG_MASTER_KEY - encrypts system integration secrets (system_settings)
 *
 * Keys are provided as base64-encoded 32-byte (256-bit) values.
 * Generate with: openssl rand -base64 32
 */

let cachedAppMasterKey: Buffer | null = null;
let cachedConfigMasterKey: Buffer | null = null;

function loadKeyFromEnv(envVarName: string): Buffer {
  const raw = process.env[envVarName];
  if (!raw) {
    throw new EncryptionError(
      `${envVarName} is not set. Generate one with: openssl rand -base64 32`
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new EncryptionError(`${envVarName} is not valid base64`);
  }

  if (key.length !== AES_KEY_LENGTH_BYTES) {
    throw new EncryptionError(
      `${envVarName} must decode to exactly ${AES_KEY_LENGTH_BYTES} bytes, got ${key.length}. ` +
        `Generate one with: openssl rand -base64 32`
    );
  }

  return key;
}

/** Returns the cached APP_MASTER_KEY, loading and validating it on first use. */
export function getAppMasterKey(): Buffer {
  if (!cachedAppMasterKey) {
    cachedAppMasterKey = loadKeyFromEnv("APP_MASTER_KEY");
  }
  return cachedAppMasterKey;
}

/** Returns the cached CONFIG_MASTER_KEY, loading and validating it on first use. */
export function getConfigMasterKey(): Buffer {
  if (!cachedConfigMasterKey) {
    cachedConfigMasterKey = loadKeyFromEnv("CONFIG_MASTER_KEY");
  }
  return cachedConfigMasterKey;
}

/** Test-only: reset cached keys so tests can swap env vars between cases. */
export function __resetMasterKeyCacheForTests(): void {
  cachedAppMasterKey = null;
  cachedConfigMasterKey = null;
}
