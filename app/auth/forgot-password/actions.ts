"use server";

import { db } from "@/lib/db";
import { AccountEmailDeliveryError } from "@/lib/account-email";
import type { ForgotPasswordFormState } from "@/lib/form-states";
import { normalizeLanguage, getTranslations } from "@/lib/i18n";
import {
  createPasswordResetToken,
  sendPasswordResetMessage,
} from "@/lib/password-reset";
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "@/lib/turnstile";

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function requestPasswordResetAction(
  _previousState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const email = normalize(formData.get("email"));
  const language = normalizeLanguage(normalize(formData.get("language")));
  const t = getTranslations(language);

  if (!email) {
    return {
      status: "error",
      email,
      fieldError: t.auth.forgotPassword.missingEmail,
    };
  }

  if (!isPlausibleEmail(email)) {
    return {
      status: "error",
      email,
      fieldError: t.auth.forgotPassword.invalidEmail,
    };
  }

  try {
    await verifyTurnstileToken({
      formData,
      expectedAction: "forgot-password",
      logContext: "auth-forgot-password",
    });
  } catch (error) {
    const errorCode =
      error instanceof TurnstileVerificationError
        ? error.code
        : "turnstile-unavailable";
    const formError =
      errorCode === "turnstile-required"
        ? t.auth.forgotPassword.turnstile.required
        : errorCode === "turnstile-expired"
          ? t.auth.forgotPassword.turnstile.expired
          : errorCode === "turnstile-invalid"
            ? t.auth.forgotPassword.turnstile.invalid
            : t.auth.forgotPassword.turnstile.unavailable;

    return {
      status: "error",
      email,
      formError,
    };
  }

  const user = await db.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (user?.emailVerified) {
    const verification = createPasswordResetToken();

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: verification.tokenHash,
        passwordResetExpires: verification.expiresAt,
        passwordResetSentAt: new Date(),
      },
    });

    try {
      await sendPasswordResetMessage({
        email: user.email,
        token: verification.token,
      });
    } catch (error) {
      console.error("[auth][forgot-password] password reset email send failed", {
        userId: user.id,
        email: user.email,
        reason:
          error instanceof AccountEmailDeliveryError
            ? error.causeSummary || error.code
            : error instanceof Error
              ? error.message
            : "unknown-error",
      });

      try {
        await db.user.update({
          where: { id: user.id },
          data: {
            passwordResetTokenHash: null,
            passwordResetExpires: null,
            passwordResetSentAt: null,
          },
        });
      } catch (updateError) {
        console.error("[auth][forgot-password] failed to clear password reset state", {
          userId: user.id,
          email: user.email,
          reason: updateError instanceof Error ? updateError.message : "unknown-error",
        });
      }
    }
  }

  return {
    status: "success",
    email,
    message: t.auth.forgotPassword.successMessage,
  };
}
