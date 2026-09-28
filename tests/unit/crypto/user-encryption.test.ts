import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  createUserKeyRecord,
  unwrapUserDek,
  encryptUserField,
  decryptUserField,
  userEncryptionContext,
} from "@/lib/crypto/user-encryption";
import { __resetMasterKeyCacheForTests } from "@/lib/crypto/master-keys";

describe("user-encryption", () => {
  beforeEach(() => {
    process.env.APP_MASTER_KEY = randomBytes(32).toString("base64");
    process.env.CONFIG_MASTER_KEY = randomBytes(32).toString("base64");
    __resetMasterKeyCacheForTests();
  });

  afterEach(() => {
    delete process.env.APP_MASTER_KEY;
    delete process.env.CONFIG_MASTER_KEY;
    __resetMasterKeyCacheForTests();
  });

  it("creates a wrapped DEK that can be unwrapped", () => {
    const record = createUserKeyRecord();
    expect(record.keyVersion).toBe(1);
    const dek = unwrapUserDek(record);
    expect(dek).toHaveLength(32);
  });

  it("encrypts and decrypts a field with a user's DEK", () => {
    const record = createUserKeyRecord();
    const dek = unwrapUserDek(record);
    const serialized = encryptUserField("Call Karthik about the proposal", dek);
    expect(decryptUserField(serialized, dek)).toBe("Call Karthik about the proposal");
  });

  it("two different users get different DEKs", () => {
    const recordA = createUserKeyRecord();
    const recordB = createUserKeyRecord();
    expect(recordA.encryptedDek).not.toBe(recordB.encryptedDek);
    const dekA = unwrapUserDek(recordA);
    const dekB = unwrapUserDek(recordB);
    expect(dekA.equals(dekB)).toBe(false);
  });

  it("user A's DEK cannot decrypt user B's content (cross-user isolation)", () => {
    const recordA = createUserKeyRecord();
    const recordB = createUserKeyRecord();
    const dekA = unwrapUserDek(recordA);
    const dekB = unwrapUserDek(recordB);

    const bContent = encryptUserField("User B's private memory", dekB);
    expect(() => decryptUserField(bContent, dekA)).toThrow();
  });

  it("fails to unwrap DEK with wrong app master key", () => {
    const record = createUserKeyRecord();
    process.env.APP_MASTER_KEY = randomBytes(32).toString("base64");
    __resetMasterKeyCacheForTests();
    expect(() => unwrapUserDek(record)).toThrow();
  });

  it("userEncryptionContext provides bound encrypt/decrypt", () => {
    const record = createUserKeyRecord();
    const ctx = userEncryptionContext(record);
    const serialized = ctx.encrypt("Gramiyum is one of my clients.");
    expect(ctx.decrypt(serialized)).toBe("Gramiyum is one of my clients.");
  });
});
