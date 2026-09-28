import { encryptWithKey, decryptWithKey } from "./aes";
import { getConfigMasterKey } from "./master-keys";

/**
 * Encrypts/decrypts system integration secrets (Evolution API key, webhook
 * secret, OpenRouter API key, Google OAuth client secret) before they are
 * written to system_settings.encrypted_secret (PRD 34.3, table 33.4).
 *
 * These are distinct from per-user content encryption (user-encryption.ts):
 * config secrets are wrapped directly by CONFIG_MASTER_KEY, with no
 * per-user DEK involved.
 */

export function encryptConfigSecret(plaintext: string): string {
  return encryptWithKey(plaintext, getConfigMasterKey());
}

export function decryptConfigSecret(serialized: string): string {
  return decryptWithKey(serialized, getConfigMasterKey());
}

/**
 * Produces a masked display value for a saved secret, e.g. "••••••••abcd".
 * The admin UI must never display the full saved secret again after
 * initial save (PRD 27.1). This operates on the *plaintext* only at the
 * moment of masking (e.g. right after a fresh save, before it is
 * discarded) or on a value the caller has deliberately decrypted for this
 * purpose — never persist the plaintext itself.
 */
export function maskSecret(plaintext: string, visibleTailLength = 4): string {
  if (plaintext.length <= visibleTailLength) {
    return "•".repeat(Math.max(plaintext.length, 8));
  }
  const tail = plaintext.slice(-visibleTailLength);
  return "•".repeat(12) + tail;
}
