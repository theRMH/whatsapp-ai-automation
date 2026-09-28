import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hashSenderPhone } from "@/lib/crypto/sender-hash";
import { __resetMasterKeyCacheForTests } from "@/lib/crypto/master-keys";

describe("hashSenderPhone", () => {
  const originalKey = process.env.CONFIG_MASTER_KEY;

  beforeEach(() => {
    process.env.CONFIG_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    __resetMasterKeyCacheForTests();
  });

  afterEach(() => {
    process.env.CONFIG_MASTER_KEY = originalKey;
    __resetMasterKeyCacheForTests();
  });

  it("is deterministic for the same phone number", () => {
    const a = hashSenderPhone("+919876543210");
    const b = hashSenderPhone("+919876543210");
    expect(a).toBe(b);
  });

  it("differs for different phone numbers", () => {
    const a = hashSenderPhone("+919876543210");
    const b = hashSenderPhone("+919876543211");
    expect(a).not.toBe(b);
  });

  it("never contains the plaintext phone number", () => {
    const hash = hashSenderPhone("+919876543210");
    expect(hash).not.toContain("919876543210");
  });

  it("produces a 64-character hex digest (SHA-256)", () => {
    const hash = hashSenderPhone("+919876543210");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
