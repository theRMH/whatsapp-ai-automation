import { describe, it, expect } from "vitest";
import { normalizeToE164, normalizeJidToE164, InvalidPhoneNumberError } from "@/lib/phone/normalize";

describe("normalizeToE164", () => {
  it("normalizes a number that already has a country code", () => {
    expect(normalizeToE164("+91 98765 43210")).toBe("+919876543210");
  });

  it("normalizes using a default country when no + is given", () => {
    expect(normalizeToE164("9876543210", "IN")).toBe("+919876543210");
  });

  it("throws InvalidPhoneNumberError for garbage input", () => {
    expect(() => normalizeToE164("not a phone number")).toThrow(InvalidPhoneNumberError);
  });

  it("throws InvalidPhoneNumberError for a too-short number", () => {
    expect(() => normalizeToE164("+1234")).toThrow(InvalidPhoneNumberError);
  });
});

describe("normalizeJidToE164", () => {
  it("extracts and normalizes an individual WhatsApp JID", () => {
    expect(normalizeJidToE164("919876543210@s.whatsapp.net")).toBe("+919876543210");
  });

  it("returns null for a group JID", () => {
    expect(normalizeJidToE164("123456789-987654@g.us")).toBeNull();
  });

  it("returns null for an unparseable JID phone part", () => {
    expect(normalizeJidToE164("notaphone@s.whatsapp.net")).toBeNull();
  });
});
