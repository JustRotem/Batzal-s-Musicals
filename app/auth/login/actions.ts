"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { AccountEmailDeliveryError } from "@/lib/account-email";
import {
  createEmailVerificationToken,
  getEmailVerificationRetryDelayMs,
  sendEmailVerificationMessage,
} from "@/lib/email-verification";
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { type LoginFormState } from "@/lib/form-states";

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildErrorState(email: string, errorCode: string): LoginFormState {
  return {
    status: "error",
    email,
    errorCode,
    turnstileResetKey: Date.now(),
  };
}

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState | never> {
  const existingUser = await getCurrentUser();

  if (existingUser) {
    redirect("/");
  }

  const email = normalize(formData.get("email")).toLowerCase();
  const password = normalize(formData.get("password"));

  if (!email || !password) {
    return buildErrorState(email, "missing-fields");
  }

  try {
    await verifyTurnstileToken({
      formData,
      expectedAction: "login",
      logContext: "auth-login",
    });
  } catch (error) {
    const errorCode =
      error instanceof TurnstileVerificationError
        ? error.code
        : "turnstile-unavailable";

    return buildErrorState(email, errorCode);
  }

  const user = await db.user.findFirst({
    where: { email },
  });

  if (!user) {
    return buildErrorState(email, "invalid-credentials");
  }

  if (!user.emailVerified) {
    const retryDelayMs = getEmailVerificationRetryDelayMs(user.emailVerificationSentAt);

    if (retryDelayMs <= 0) {
      const verification = createEmailVerificationToken();

      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: verification.tokenHash,
          emailVerificationExpires: verification.expiresAt,
          emailVerificationSentAt: new Date(),
        },
      });

      try {
        await sendEmailVerificationMessage({
          email: user.email,
          token: verification.token,
        });
      } catch (error) {
        console.error("[auth][login] verification resend failed", {
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
              emailVerificationSentAt: null,
            },
          });
        } catch (updateError) {
          console.error("[auth][login] failed to clear verification resend timestamp", {
            userId: user.id,
            email: user.email,
            reason: updateError instanceof Error ? updateError.message : "unknown-error",
          });
        }

        redirect(`/auth/verify-required?email=${encodeURIComponent(user.email)}&error=send-failed`);
      }

      redirect(`/auth/verify-required?email=${encodeURIComponent(user.email)}&sent=1`);
    }

    redirect(`/auth/verify-required?email=${encodeURIComponent(user.email)}`);
  }

  if (user.status === "blocked") {
    redirect("/auth/blocked");
  }

  const valid = verifyPassword(password, user.passwordHash);

  if (!valid) {
    return buildErrorState(email, "invalid-credentials");
  }

  await createSession(user.id, user.language);
  redirect("/");
}
