import { encryptWithKey, decryptWithKey, generateKey } from "./aes";
import { getAppMasterKey } from "./master-keys";

/**
 * Per-user content encryption (PRD 34.2, table 33.3 user_keys).
 *
 * Flow:
 *   APP_MASTER_KEY --decrypt--> User DEK --encrypt/decrypt--> user's
 *   sensitive fields (task titles, memory content, prospect details,
 *   document metadata, conversation turns, etc.)
 *
 * This module only handles the DEK <-> master key wrapping and the
 * encrypt/decrypt-with-a-DEK primitives. It does NOT talk to the
 * database; callers (repositories) are responsible for reading/writing
 * user_keys.encrypted_dek and passing it in here.
 */

const CURRENT_KEY_VERSION = 1;

export interface UserKeyRecord {
  encryptedDek: string;
  keyVersion: number;
}

/**
 * Generates a brand-new DEK for a newly created user and wraps it with
 * the app master key, ready to be inserted into user_keys.
 */
export function createUserKeyRecord(): UserKeyRecord {
  const dek = generateKey();
  const encryptedDek = encryptWithKey(dek.toString("base64"), getAppMasterKey());
  return { encryptedDek, keyVersion: CURRENT_KEY_VERSION };
}

/**
 * Unwraps a user's DEK from its stored encrypted form. The returned
 * Buffer should be held only for the duration of the current request/job
 * and never cached across requests or logged.
 */
export function unwrapUserDek(record: UserKeyRecord): Buffer {
  const dekBase64 = decryptWithKey(record.encryptedDek, getAppMasterKey());
  return Buffer.from(dekBase64, "base64");
}

/** Encrypt a single user-content field with that user's DEK. */
export function encryptUserField(plaintext: string, dek: Buffer): string {
  return encryptWithKey(plaintext, dek);
}

/** Decrypt a single user-content field with that user's DEK. */
export function decryptUserField(serialized: string, dek: Buffer): string {
  return decryptWithKey(serialized, dek);
}

/**
 * Convenience wrapper: unwraps the DEK once and returns bound
 * encrypt/decrypt functions, useful when a request handler needs to
 * encrypt/decrypt several fields for the same user (e.g. a task's title
 * and details) without re-deriving the DEK each time.
 */
export function userEncryptionContext(record: UserKeyRecord) {
  const dek = unwrapUserDek(record);
  return {
    encrypt: (plaintext: string) => encryptUserField(plaintext, dek),
    decrypt: (serialized: string) => decryptUserField(serialized, dek),
  };
}

/**
 * Re-wraps an existing DEK under the current app master key. Used for key
 * rotation (rotating APP_MASTER_KEY without re-encrypting all user
 * content, only the wrapped DEKs). Not needed for V1 but kept here since
 * user_keys.rotated_at exists in the schema for this purpose.
 */
export function rewrapUserDek(dek: Buffer): UserKeyRecord {
  const encryptedDek = encryptWithKey(dek.toString("base64"), getAppMasterKey());
  return { encryptedDek, keyVersion: CURRENT_KEY_VERSION };
}
