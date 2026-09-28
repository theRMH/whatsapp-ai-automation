import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * Core AES-256-GCM primitives shared by the two encryption utilities
 * (user-encryption.ts and config-encryption.ts). Do not use this module
 * directly outside of lib/crypto — callers must go through one of those
 * two higher-level wrappers so keys are resolved consistently.
 *
 * Serialized format (PRD 34.2):
 *   v1:<iv-base64>:<ciphertext-base64>:<tag-base64>
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for GCM
const KEY_LENGTH_BYTES = 32; // 256-bit key
const FORMAT_VERSION = "v1";

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

function assertKeyLength(key: Buffer, context: string): void {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EncryptionError(
      `${context}: expected a ${KEY_LENGTH_BYTES}-byte key, got ${key.length} bytes`
    );
  }
}

/**
 * Encrypt plaintext with a 256-bit key. Returns the versioned serialized
 * string format. Never throws on empty string input; callers deciding
 * whether a field is nullable should check before calling.
 */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  assertKeyLength(key, "encryptWithKey");

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a versioned serialized string with a 256-bit key.
 * Throws DecryptionError on wrong key, tampered ciphertext, or malformed
 * input. Never leaks whether failure was due to format vs. auth tag
 * mismatch, to avoid oracle-style information leaks in error messages
 * that might end up in logs.
 */
export function decryptWithKey(serialized: string, key: Buffer): string {
  assertKeyLength(key, "decryptWithKey");

  const parts = serialized.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new DecryptionError("Malformed encrypted value: unexpected format or version");
  }

  const [, ivB64, ciphertextB64, tagB64] = parts;

  let iv: Buffer, ciphertext: Buffer, authTag: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    ciphertext = Buffer.from(ciphertextB64, "base64");
    authTag = Buffer.from(tagB64, "base64");
  } catch {
    throw new DecryptionError("Malformed encrypted value: invalid base64 segment");
  }

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new DecryptionError("Malformed encrypted value: invalid IV length");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext both surface here (GCM auth tag
    // verification failure). Do not distinguish in the error message.
    throw new DecryptionError("Decryption failed: wrong key or corrupted/tampered value");
  }
}

/** Generate a new random 256-bit key, e.g. for a fresh per-user DEK. */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH_BYTES);
}

export const AES_KEY_LENGTH_BYTES = KEY_LENGTH_BYTES;
