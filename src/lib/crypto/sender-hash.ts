import { createHmac } from "crypto";
import { getConfigMasterKey } from "./master-keys";

/**
 * Derives a stable, non-reversible hash of a normalized E.164 phone
 * number for tracking unknown-sender reply cooldowns (PRD 6.2.1):
 * "Key the row by sender_hash = HMAC-SHA256(CONFIG_MASTER_KEY-derived
 * key, normalized E.164 phone). Never store the plaintext phone number
 * of an unknown sender."
 */
export function hashSenderPhone(phoneE164: string): string {
  return createHmac("sha256", getConfigMasterKey()).update(phoneE164).digest("hex");
}
