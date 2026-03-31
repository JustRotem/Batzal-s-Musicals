"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, requirePermission, requireUser, rotateSession, verifyPassword } from "@/lib/auth";
import {
  createPhoneVerificationCode,
  isValidPhone,
  normalizePhone,
  sendPhoneVerificationCodeMessage,
  hashPhoneVerificationCode,
} from "@/lib/phone-verification";
import { ImageUploadError, isFileEntry } from "@/lib/image-upload";
import { getTranslations, normalizeLanguage } from "@/lib/i18n";
import type { ChangePasswordFormState } from "@/lib/form-states";
import { isStrongPassword } from "@/lib/password-policy";
import { updateUserAvatar } from "@/lib/profile-avatar";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyAdminsAboutEditorRequest } from "@/lib/editor-request-notifications";

type ProfileSection = "profile" | "permissions" | "security";

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSection(
  section: string | null | undefined,
  fallback: ProfileSection,
): ProfileSection {
  if (section === "permissions") {
    return "permissions";
  }

  return section === "security" ? "security" : fallback;
}

function buildProfileRedirectUrl({
  section,
  success,
  error,
}: {
  section: ProfileSection;
  success?: string;
  error?: string;
}) {
  const params = new URLSearchParams();
  params.set("section", section);

  if (success) {
    params.set("success", success);
  }

  if (error) {
    params.set("error", error);
  }

  return `/profile?${params.toString()}`;
}

function redirectProfileWithError(error: string, section: ProfileSection): never {
  redirect(buildProfileRedirectUrl({ section, error }));
}

function redirectProfileWithSuccess(success: string, section: ProfileSection): never {
  redirect(buildProfileRedirectUrl({ section, success }));
}

export async function requestEditorAccessAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "profile");

  if (user.role !== "user") {
    redirect(buildProfileRedirectUrl({ section }));
  }

  if (user.status === "pending") {
    redirectProfileWithSuccess("editor-request-pending", section);
  }

  if (user.status !== "active") {
    redirect(buildProfileRedirectUrl({ section }));
  }

  const requestMessage = normalize(formData.get("requestMessage"));

  await db.user.update({
    where: { id: user.id },
    data: {
      status: "pending",
      requestMessage: requestMessage || null,
    },
  });

  await notifyAdminsAboutEditorRequest({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    requestMessage: requestMessage || null,
  });

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/musicals");

  redirectProfileWithSuccess("editor-request-sent", section);
}

export async function updateAvatarAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "profile");
  const imageFileEntry = formData.get("avatarFile");
  const imageFile = isFileEntry(imageFileEntry) ? imageFileEntry : null;

  let nextAvatarUrl: string | null = null;

  try {
    nextAvatarUrl = await updateUserAvatar({
      userId: user.id,
      avatarFile: imageFile,
    });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      redirectProfileWithError(error.code, section);
    }

    throw error;
  }

  if (!nextAvatarUrl) {
    redirectProfileWithError("missing-avatar", section);
  }
  redirectProfileWithSuccess("avatar-updated", section);
}

export async function changePasswordAction(
  _previousState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const language = normalizeLanguage(normalize(formData.get("language")));
  const t = getTranslations(language);
  const currentPassword = normalize(formData.get("currentPassword"));
  const newPassword = normalize(formData.get("newPassword"));
  const confirmPassword = normalize(formData.get("confirmPassword"));

  const fieldErrors: ChangePasswordFormState["fieldErrors"] = {};

  if (!currentPassword) {
    fieldErrors.currentPassword =
      language === "he" ? "צריך להזין את הסיסמה הנוכחית." : "Please enter your current password.";
  }

  if (!newPassword) {
    fieldErrors.newPassword = t.auth.resetPassword.missingPassword;
  } else if (!isStrongPassword(newPassword)) {
    fieldErrors.newPassword = t.auth.resetPassword.weakPassword;
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = t.auth.resetPassword.missingConfirmPassword;
  } else if (newPassword && confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = t.auth.resetPassword.passwordMismatch;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      fieldErrors,
    };
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
    return {
      status: "error",
      fieldErrors: {
        currentPassword:
          language === "he"
            ? "הסיסמה הנוכחית שהוזנה אינה נכונה."
            : "The current password you entered is incorrect.",
      },
    };
  }

  if (verifyPassword(newPassword, dbUser.passwordHash)) {
    return {
      status: "error",
      fieldErrors: {
        newPassword:
          language === "he"
            ? "כדאי לבחור סיסמה חדשה ושונה מהסיסמה הנוכחית."
            : "Please choose a new password that is different from the current one.",
      },
    };
  }

  await db.user.update({
    where: { id: dbUser.id },
    data: {
      passwordHash: hashPassword(newPassword),
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    },
  });

  await rotateSession(dbUser.id);
  revalidatePath("/", "layout");
  revalidatePath("/profile");

  return {
    status: "success",
    fieldErrors: {},
    successMessage:
      language === "he"
        ? "הסיסמה עודכנה בהצלחה. החיבור שלך נשמר בצורה מאובטחת."
        : "Your password was updated successfully. Your session has been kept secure.",
  };
}

export async function updatePhoneAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "security");
  const phoneRaw = normalize(formData.get("phone"));

  if (!phoneRaw) {
    await db.user.update({
      where: { id: user.id },
      data: {
        phone: null,
        phoneVerified: false,
        phoneVerificationCodeHash: null,
        phoneVerificationExpires: null,
      },
    });

    revalidatePath("/profile");
    redirectProfileWithSuccess("phone-cleared", section);
  }

  const phone = normalizePhone(phoneRaw);

  if (!isValidPhone(phone)) {
    redirectProfileWithError("invalid-phone", section);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      phone,
      phoneVerified: false,
      phoneVerificationCodeHash: null,
      phoneVerificationExpires: null,
    },
  });

  revalidatePath("/profile");
  redirectProfileWithSuccess("phone-updated", section);
}

export async function sendPhoneVerificationCodeAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "security");

  if (!user.phone) {
    redirectProfileWithError("missing-phone", section);
  }

  const phone = user.phone;

  const verification = createPhoneVerificationCode();

  await db.user.update({
    where: { id: user.id },
    data: {
      phoneVerified: false,
      phoneVerificationCodeHash: verification.codeHash,
      phoneVerificationExpires: verification.expiresAt,
    },
  });

  try {
    await sendPhoneVerificationCodeMessage({
      phone,
      code: verification.code,
    });
  } catch {
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCodeHash: null,
        phoneVerificationExpires: null,
      },
    });

    revalidatePath("/profile");
    redirectProfileWithError("phone-delivery-unavailable", section);
  }

  revalidatePath("/profile");
  redirectProfileWithSuccess("phone-code-sent", section);
}

export async function verifyPhoneCodeAction(formData: FormData) {
  const user = await requireUser();
  const section = normalizeSection(normalize(formData.get("section")), "security");
  const code = normalize(formData.get("verificationCode"));

  if (!user.phone) {
    redirectProfileWithError("missing-phone", section);
  }

  if (!code) {
    redirectProfileWithError("missing-phone-code", section);
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      phone: true,
      phoneVerificationCodeHash: true,
      phoneVerificationExpires: true,
    },
  });

  if (!dbUser?.phone || !dbUser.phoneVerificationCodeHash || !dbUser.phoneVerificationExpires) {
    redirectProfileWithError("phone-code-missing", section);
  }

  const verifiedTarget = dbUser;
  const phoneVerificationExpires = verifiedTarget.phoneVerificationExpires as Date;

  if (phoneVerificationExpires <= new Date()) {
    await db.user.update({
      where: { id: verifiedTarget.id },
      data: {
        phoneVerificationCodeHash: null,
        phoneVerificationExpires: null,
      },
    });

    revalidatePath("/profile");
    redirectProfileWithError("phone-code-expired", section);
  }

  const codeHash = hashPhoneVerificationCode(code);

  if (codeHash !== verifiedTarget.phoneVerificationCodeHash) {
    redirectProfileWithError("invalid-phone-code", section);
  }

  await db.user.update({
    where: { id: verifiedTarget.id },
    data: {
      phoneVerified: true,
      phoneVerificationCodeHash: null,
      phoneVerificationExpires: null,
    },
  });

  revalidatePath("/profile");
  redirectProfileWithSuccess("phone-verified", section);
}
