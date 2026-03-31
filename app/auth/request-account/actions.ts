"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { AccountEmailDeliveryError } from "@/lib/account-email";
import { normalizeLanguage } from "@/lib/i18n";
import {
  createEmailVerificationToken,
  sendEmailVerificationMessage,
} from "@/lib/email-verification";
import { isStrongPassword } from "@/lib/password-policy";
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "@/lib/turnstile";

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function maskEmail(value: string) {
  const [localPart = "", domain = ""] = value.split("@");

  if (!localPart || !domain) {
    return "invalid-email";
  }

  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${"*".repeat(Math.max(1, localPart.length - visiblePrefix.length))}@${domain}`;
}

export async function requestAccountAction(formData: FormData) {
  const existingUser = await getCurrentUser();

  if (existingUser) {
    redirect("/");
  }

  const firstName = normalize(formData.get("firstName"));
  const lastName = normalize(formData.get("lastName"));
  const username = normalize(formData.get("publicUsername"));
  const email = normalize(formData.get("email")).toLowerCase();
  const password = normalize(formData.get("password"));
  const language = normalizeLanguage(normalize(formData.get("language")));
  const logContext = {
    email: maskEmail(email),
    username,
  };

  if (!firstName || !lastName || !username || !email || !password) {
    redirect("/auth/request-account?error=missing-fields");
  }

  if (username.length < 3) {
    redirect("/auth/request-account?error=username-too-short");
  }

  if (!/^[\p{L}\p{N}_ ]+$/u.test(username)) {
    redirect("/auth/request-account?error=username-invalid");
  }

  if (!isStrongPassword(password)) {
    redirect("/auth/request-account?error=password-requirements");
  }

  try {
    await verifyTurnstileToken({
      formData,
      expectedAction: "request-account",
      logContext: "auth-request-account",
    });
  } catch (error) {
    const errorCode =
      error instanceof TurnstileVerificationError
        ? error.code
        : "turnstile-unavailable";

    redirect(`/auth/request-account?error=${errorCode}`);
  }

  console.info("[auth][request-account] validation passed", logContext);

  const existingByUsername = await db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  });

  if (existingByUsername) {
    redirect("/auth/request-account?error=username-exists");
  }

  const existingByEmail = await db.user.findFirst({
    where: { email },
  });

  if (existingByEmail) {
    redirect("/auth/request-account?error=email-exists");
  }

  const verification = createEmailVerificationToken();

  console.info("[auth][request-account] verification token generated", logContext);

  await db.user.create({
    data: {
      firstName,
      lastName,
      username,
      email,
      phone: null,
      phoneVerified: false,
      emailVerified: false,
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpires: verification.expiresAt,
      emailVerificationSentAt: new Date(),
      passwordHash: hashPassword(password),
      requestMessage: null,
      status: "active",
      role: "user",
      language,
    },
  });

  console.info("[auth][request-account] user created", logContext);

  let verificationEmailFailed = false;

  try {
    console.info("[auth][request-account] calling email sender", logContext);

    await sendEmailVerificationMessage({
      email,
      token: verification.token,
    });

    console.info("[auth][request-account] email sender completed", logContext);
  } catch (error) {
    console.error("[auth][request-account] verification email send failed", {
      ...logContext,
      reason:
        error instanceof AccountEmailDeliveryError
          ? error.causeSummary || error.code
          : error instanceof Error
            ? error.message
            : "unknown-error",
    });

    verificationEmailFailed = true;

    try {
      await db.user.update({
        where: { email },
        data: {
          emailVerificationSentAt: null,
        },
      });
    } catch (updateError) {
      console.error("[auth][request-account] failed to clear verification send timestamp", {
        ...logContext,
        reason: updateError instanceof Error ? updateError.message : "unknown-error",
      });
    }
  }

  if (verificationEmailFailed) {
    console.info("[auth][request-account] redirecting to verify-required with send-failed", logContext);
    redirect(`/auth/verify-required?email=${encodeURIComponent(email)}&error=send-failed`);
  }

  console.info("[auth][request-account] redirecting to verify-required with sent=1", logContext);
  redirect(`/auth/verify-required?email=${encodeURIComponent(email)}&sent=1`);
}
