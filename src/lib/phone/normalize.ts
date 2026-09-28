import { parsePhoneNumberWithError, ParseError } from "libphonenumber-js";

/**
 * Phone normalization (PRD 25.2: "Normalize and validate phone to E.164.
 * Phone must be unique.", PRD 36.1 step 7: "normalize sender number").
 *
 * `phone_e164` is the sole identity/authorization key for a user; a
 * WhatsApp JID (`phone_jid`, e.g. "91987xxxxxxx@s.whatsapp.net") is only
 * ever stored as metadata, never used for lookups.
 */

export class InvalidPhoneNumberError extends Error {
  constructor(input: string) {
    super(`Not a valid phone number: ${input}`);
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Normalizes a phone number (admin-entered, in any reasonable format, or
 * extracted from a WhatsApp JID) to E.164, e.g. "+919876543210".
 *
 * `defaultCountry` is used only when the input has no leading "+" and no
 * country code can otherwise be inferred.
 */
export function normalizeToE164(input: string, defaultCountry?: string): string {
  const cleaned = input.trim();

  try {
    const parsed = parsePhoneNumberWithError(
      cleaned,
      defaultCountry as Parameters<typeof parsePhoneNumberWithError>[1]
    );
    if (!parsed.isValid()) {
      throw new InvalidPhoneNumberError(input);
    }
    return parsed.number;
  } catch (err) {
    if (err instanceof ParseError) {
      throw new InvalidPhoneNumberError(input);
    }
    throw err;
  }
}

/**
 * Extracts the phone portion of a WhatsApp JID (e.g.
 * "919876543210@s.whatsapp.net" -> "919876543210") and normalizes it to
 * E.164. Returns null for JIDs that are not individual user JIDs (e.g.
 * group JIDs ending in "@g.us"), since those never map to a single phone.
 */
export function normalizeJidToE164(jid: string): string | null {
  if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@c.us")) {
    return null;
  }
  const phonePart = jid.split("@")[0];
  try {
    return normalizeToE164(`+${phonePart.replace(/^\+/, "")}`);
  } catch {
    return null;
  }
}
