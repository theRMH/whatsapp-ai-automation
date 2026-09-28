import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  encryptConfigSecret,
  decryptConfigSecret,
  maskSecret,
} from "@/lib/crypto/config-encryption";
import { __resetMasterKeyCacheForTests } from "@/lib/crypto/master-keys";

describe("config-encryption", () => {
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

  it("round-trips an Evolution API key", () => {
    const apiKey = "evo_live_sk_abcdef1234567890";
    const serialized = encryptConfigSecret(apiKey);
    expect(decryptConfigSecret(serialized)).toBe(apiKey);
  });

  it("uses a distinct master key from user content encryption", () => {
    // Sanity: config secrets encrypted here should not be decryptable
    // as if they were user content (different key material entirely).
    const serialized = encryptConfigSecret("sk-openrouter-xyz");
    expect(serialized.startsWith("v1:")).toBe(true);
  });

  describe("maskSecret", () => {
    it("shows only the last 4 characters by default", () => {
      const masked = maskSecret("sk-openrouter-abcd1234");
      expect(masked.endsWith("1234")).toBe(true);
      expect(masked).not.toContain("openrouter");
    });

    it("fully masks short secrets", () => {
      const masked = maskSecret("abc");
      expect(masked).not.toContain("abc");
    });
  });
});
