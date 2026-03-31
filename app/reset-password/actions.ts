"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { ResetPasswordFormState } from "@/lib/form-states";
import { getTranslations, normalizeLanguage } from "@/lib/i18n";
import { isStrongPassword } from "@/lib/password-policy";
import { getValidPasswordResetTarget } from "@/lib/password-reset";

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resetPasswordAction(
  _previousState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const token = normalize(formData.get("token"));
  const password = normalize(formData.get("password"));
  const confirmPassword = normalize(formData.get("confirmPassword"));
  const language = normalizeLanguage(normalize(formData.get("language")));
  const t = getTranslations(language);

  if (!token) {
    redirect("/auth/forgot-password");
  }

  const fieldErrors: ResetPasswordFormState["fieldErrors"] = {};

  if (!password || !confirmPassword) {
    if (!password) {
      fieldErrors.password = t.auth.resetPassword.missingPassword;
    }

    if (!confirmPassword) {
      fieldErrors.confirmPassword = t.auth.resetPassword.missingConfirmPassword;
    }
  }

  if (password && !isStrongPassword(password)) {
    fieldErrors.password = t.auth.resetPassword.weakPassword;
  }

  if (password && confirmPassword && password !== confirmPassword) {
    fieldErrors.confirmPassword = t.auth.resetPassword.passwordMismatch;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      fieldErrors,
    };
  }

  const user = await getValidPasswordResetTarget(token);

  if (!user) {
    return {
      status: "error",
      fieldErrors: {},
      formError: t.auth.resetPassword.invalidToken,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      passwordResetSentAt: null,
    },
  });

  await db.session.deleteMany({
    where: {
      userId: user.id,
    },
  });

  redirect("/auth/login?success=password-reset");
}
