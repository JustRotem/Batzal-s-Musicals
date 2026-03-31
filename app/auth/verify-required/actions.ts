"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AccountEmailDeliveryError } from "@/lib/account-email";
import {
  createEmailVerificationToken,
  getEmailVerificationRetryDelayMs,
  sendEmailVerificationMessage,
} from "@/lib/email-verification";

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function resendVerificationEmailAction(formData: FormData) {
  const email = normalize(formData.get("email"));

  if (!email) {
    redirect("/auth/verify-required?error=missing-email");
  }

  const user = await db.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerificationSentAt: true,
    },
  });

  if (!user) {
    redirect(`/auth/verify-required?error=unknown-email&email=${encodeURIComponent(email)}`);
  }

  if (user.emailVerified) {
    redirect("/auth/login?success=email-verified");
  }

  const retryDelayMs = getEmailVerificationRetryDelayMs(user.emailVerificationSentAt);

  if (retryDelayMs > 0) {
    const retryAfterSeconds = Math.ceil(retryDelayMs / 1000);
    redirect(
      `/auth/verify-required?email=${encodeURIComponent(user.email)}&error=too-soon&retryAfter=${retryAfterSeconds}`,
    );
  }

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
    console.error("[auth][verify-required] verification resend failed", {
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
      console.error("[auth][verify-required] failed to clear resend timestamp", {
        userId: user.id,
        email: user.email,
        reason: updateError instanceof Error ? updateError.message : "unknown-error",
      });
    }

    redirect(`/auth/verify-required?email=${encodeURIComponent(user.email)}&error=send-failed`);
  }

  redirect(`/auth/verify-required?email=${encodeURIComponent(user.email)}&sent=1`);
}

export async function changeVerificationEmailAction(formData: FormData) {
  const currentEmail = normalize(formData.get("currentEmail"));
  const nextEmail = normalize(formData.get("nextEmail"));

  if (!currentEmail) {
    redirect("/auth/verify-required/change-email?error=missing-current-email");
  }

  if (!nextEmail) {
    redirect(
      `/auth/verify-required/change-email?email=${encodeURIComponent(currentEmail)}&error=missing-new-email`,
    );
  }

  const user = await db.user.findFirst({
    where: { email: currentEmail },
    select: {
      id: true,
      emailVerified: true,
      emailVerificationSentAt: true,
    },
  });

  if (!user) {
    redirect("/auth/verify-required/change-email?error=unknown-email");
  }

  if (user.emailVerified) {
    redirect("/auth/login?success=email-verified");
  }

  const existingByNextEmail = await db.user.findFirst({
    where: { email: nextEmail },
    select: { id: true },
  });

  if (existingByNextEmail && existingByNextEmail.id !== user.id) {
    redirect(
      `/auth/verify-required/change-email?email=${encodeURIComponent(currentEmail)}&error=email-exists`,
    );
  }

  const retryDelayMs = getEmailVerificationRetryDelayMs(user.emailVerificationSentAt);

  if (retryDelayMs > 0) {
    const retryAfterSeconds = Math.ceil(retryDelayMs / 1000);
    redirect(
      `/auth/verify-required/change-email?email=${encodeURIComponent(currentEmail)}&error=too-soon&retryAfter=${retryAfterSeconds}`,
    );
  }

  const verification = createEmailVerificationToken();

  await db.user.update({
    where: { id: user.id },
    data: {
      email: nextEmail,
      emailVerified: false,
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpires: verification.expiresAt,
      emailVerificationSentAt: new Date(),
    },
  });

  try {
    await sendEmailVerificationMessage({
      email: nextEmail,
      token: verification.token,
    });
  } catch (error) {
    console.error("[auth][verify-required] changed-email verification send failed", {
      userId: user.id,
      email: nextEmail,
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
      console.error("[auth][verify-required] failed to clear changed-email resend timestamp", {
        userId: user.id,
        email: nextEmail,
        reason: updateError instanceof Error ? updateError.message : "unknown-error",
      });
    }

    redirect(`/auth/verify-required?email=${encodeURIComponent(nextEmail)}&error=send-failed&changed=1`);
  }

  redirect(
    `/auth/verify-required?email=${encodeURIComponent(nextEmail)}&sent=1&changed=1`,
  );
}
