"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/admin";
import {
  createUser,
  updateUser,
  setUserStatus,
  updateUserTrial,
  deleteUser,
  getUserById,
  type TrialOption,
} from "@/lib/db/repositories/users";
import { recordAuditLog } from "@/lib/db/repositories/audit-log";
import { InvalidPhoneNumberError } from "@/lib/phone/normalize";

export interface ActionResult {
  error: string | null;
}

function trialOptionFromFormData(formData: FormData): TrialOption {
  const kind = String(formData.get("trialOption") ?? "DEFAULT");
  if (kind === "NO_EXPIRY") return { kind: "NO_EXPIRY" };
  if (kind === "CUSTOM_END_DATE") {
    const trialEndAt = String(formData.get("trialEndAt") ?? "");
    return { kind: "CUSTOM_END_DATE", trialEndAt: new Date(trialEndAt).toISOString() };
  }
  return { kind: "DEFAULT" };
}

export async function createUserAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!name || !phone || !timezone) {
    return { error: "Name, phone, and timezone are required." };
  }

  try {
    const user = await createUser({
      name,
      phone,
      timezone,
      trialOption: trialOptionFromFormData(formData),
      defaultCountry: String(formData.get("defaultCountry") ?? "") || undefined,
    });

    await recordAuditLog({
      adminId: admin.id,
      action: "USER_CREATED",
      targetUserId: user.id,
    });
  } catch (err) {
    if (err instanceof InvalidPhoneNumberError) {
      return { error: "That phone number doesn't look valid. Include a country code, e.g. +91XXXXXXXXXX." };
    }
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "A user with that phone number already exists." };
    }
    return { error: "Failed to create user." };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export async function updateUserAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  try {
    await updateUser(userId, {
      name: name || undefined,
      phone: phone || undefined,
      timezone: timezone || undefined,
      defaultCountry: String(formData.get("defaultCountry") ?? "") || undefined,
    });

    await recordAuditLog({
      adminId: admin.id,
      action: "USER_UPDATED",
      targetUserId: userId,
    });
  } catch (err) {
    if (err instanceof InvalidPhoneNumberError) {
      return { error: "That phone number doesn't look valid. Include a country code, e.g. +91XXXXXXXXXX." };
    }
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return { error: "A user with that phone number already exists." };
    }
    return { error: "Failed to update user." };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function suspendUserAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await setUserStatus(userId, "SUSPENDED");
  await recordAuditLog({ adminId: admin.id, action: "USER_SUSPENDED", targetUserId: userId });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function reactivateUserAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await setUserStatus(userId, "ACTIVE");
  await recordAuditLog({ adminId: admin.id, action: "USER_REACTIVATED", targetUserId: userId });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function extendTrialAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const trialEndAt = String(formData.get("trialEndAt") ?? "");

  if (!userId || !trialEndAt) {
    return { error: "Missing user or trial end date." };
  }

  await updateUserTrial(userId, {
    kind: "EXTEND_TRIAL",
    trialEndAt: new Date(trialEndAt).toISOString(),
  });
  await recordAuditLog({ adminId: admin.id, action: "TRIAL_EXTENDED", targetUserId: userId });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function setNoExpiryAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await updateUserTrial(userId, { kind: "SET_NO_EXPIRY" });
  await recordAuditLog({ adminId: admin.id, action: "TRIAL_SET_NO_EXPIRY", targetUserId: userId });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await requireAdmin();

  const user = await getUserById(userId);
  await deleteUser(userId);

  await recordAuditLog({
    adminId: admin.id,
    action: "USER_DELETED",
    targetUserId: userId,
    safeMetadata: user ? { hadStatus: user.status } : undefined,
  });

  revalidatePath("/admin/users");
}
