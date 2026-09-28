import { createHmac } from "crypto";
import { getConfigMasterKey } from "./master-keys";

/**
 * Hashes a WhatsApp provider message id for webhook idempotency (PRD 68,
 * 33.5, 33.23). Never store the raw provider message id or webhook body -
 * only this hash, so processed_messages/inbound_jobs rows reveal nothing
 * about message content or identity on their own.
 */
export function hashProviderMessageId(providerMessageId: string): string {
  return createHmac("sha256", getConfigMasterKey()).update(providerMessageId).digest("hex");
}
