import { describe, it, expect } from "vitest";
import { encryptWithKey, decryptWithKey, generateKey, DecryptionError } from "@/lib/crypto/aes";

describe("aes encrypt/decrypt", () => {
  it("round-trips plaintext with the same key", () => {
    const key = generateKey();
    const plaintext = "Ravi is my accountant.";
    const serialized = encryptWithKey(plaintext, key);
    expect(decryptWithKey(serialized, key)).toBe(plaintext);
  });

  it("round-trips empty string", () => {
    const key = generateKey();
    const serialized = encryptWithKey("", key);
    expect(decryptWithKey(serialized, key)).toBe("");
  });

  it("round-trips unicode content", () => {
    const key = generateKey();
    const plaintext = "₹4,500 for hosting — call Karthik 📞";
    const serialized = encryptWithKey(plaintext, key);
    expect(decryptWithKey(serialized, key)).toBe(plaintext);
  });

  it("produces the versioned serialized format", () => {
    const key = generateKey();
    const serialized = encryptWithKey("hello", key);
    const parts = serialized.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const key = generateKey();
    const a = encryptWithKey("same input", key);
    const b = encryptWithKey("same input", key);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const serialized = encryptWithKey("secret content", key1);
    expect(() => decryptWithKey(serialized, key2)).toThrow(DecryptionError);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const key = generateKey();
    const serialized = encryptWithKey("secret content", key);
    const [v, iv, ciphertext, tag] = serialized.split(":");
    const tamperedCiphertext = Buffer.from(ciphertext, "base64");
    tamperedCiphertext[0] ^= 0xff;
    const tampered = [v, iv, tamperedCiphertext.toString("base64"), tag].join(":");
    expect(() => decryptWithKey(tampered, key)).toThrow(DecryptionError);
  });

  it("fails on malformed input", () => {
    const key = generateKey();
    expect(() => decryptWithKey("not-a-valid-format", key)).toThrow(DecryptionError);
    expect(() => decryptWithKey("v2:a:b:c", key)).toThrow(DecryptionError);
    expect(() => decryptWithKey("v1:a:b", key)).toThrow(DecryptionError);
  });

  it("rejects keys that are not 32 bytes", () => {
    const shortKey = Buffer.alloc(16);
    expect(() => encryptWithKey("hello", shortKey)).toThrow();
  });
});
