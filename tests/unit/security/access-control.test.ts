import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { isUserAllowedByStatusAndTrial } from "@/lib/security/access-control";
import type { UserRecord } from "@/lib/db/repositories/users";

function makeUser(overrides: Partial<UserRecord>): UserRecord {
  return {
    id: "user-1",
    name: "Test",
    phoneE164: "+919876543210",
    phoneJid: null,
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
    accessMode: "NO_EXPIRY",
    trialStartAt: null,
    trialEndAt: null,
    lastActiveAt: null,
    createdAt: DateTime.utc().toISO(),
    updatedAt: DateTime.utc().toISO(),
    ...overrides,
  };
}

describe("isUserAllowedByStatusAndTrial", () => {
  it("allows an ACTIVE, NO_EXPIRY user", () => {
    expect(isUserAllowedByStatusAndTrial(makeUser({}))).toBeNull();
  });

  it("denies a SUSPENDED user regardless of trial state", () => {
    const user = makeUser({ status: "SUSPENDED" });
    expect(isUserAllowedByStatusAndTrial(user)).toBe("USER_SUSPENDED");
  });

  it("allows a TRIAL user before trial_end_at", () => {
    const user = makeUser({
      accessMode: "TRIAL",
      trialEndAt: DateTime.utc().plus({ days: 1 }).toISO(),
    });
    expect(isUserAllowedByStatusAndTrial(user)).toBeNull();
  });

  it("denies a TRIAL user after trial_end_at", () => {
    const user = makeUser({
      accessMode: "TRIAL",
      trialEndAt: DateTime.utc().minus({ days: 1 }).toISO(),
    });
    expect(isUserAllowedByStatusAndTrial(user)).toBe("TRIAL_EXPIRED");
  });

  it("denies a TRIAL user with a null trial_end_at", () => {
    const user = makeUser({ accessMode: "TRIAL", trialEndAt: null });
    expect(isUserAllowedByStatusAndTrial(user)).toBe("TRIAL_EXPIRED");
  });

  it("SUSPENDED takes priority over an active trial", () => {
    const user = makeUser({
      status: "SUSPENDED",
      accessMode: "TRIAL",
      trialEndAt: DateTime.utc().plus({ days: 1 }).toISO(),
    });
    expect(isUserAllowedByStatusAndTrial(user)).toBe("USER_SUSPENDED");
  });
});
