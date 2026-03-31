import { createHash, randomBytes } from "crypto";
import { getAccountEmailConfig, sendAccountEmail } from "@/lib/account-email";
import { renderAccountEmailTemplate } from "@/lib/account-email-template";
import { DEFAULT_APP_TITLE } from "@/lib/app-config";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60;

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export function getEmailVerificationRetryDelayMs(lastSentAt: Date | null | undefined) {
  if (!lastSentAt) {
    return 0;
  }

  const elapsedMs = Date.now() - lastSentAt.getTime();
  return Math.max(0, EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - elapsedMs);
}

export async function sendEmailVerificationMessage({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [localPart = "", domain = ""] = email.split("@");
  const maskedEmail =
    localPart && domain
      ? `${localPart.slice(0, 2)}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`
      : "invalid-email";

  console.info("[email-verification] preparing verification email", {
    email: maskedEmail,
  });

  const { appUrl } = getAccountEmailConfig();

  console.info("[email-verification] resolved email config", {
    email: maskedEmail,
    appUrlHost: new URL(appUrl).host,
  });

  const appTitle = DEFAULT_APP_TITLE;
  const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = `אימות כתובת האימייל שלך ב-${appTitle}`;
  const { subjectReadyHtml: html, subjectReadyText: text } = renderAccountEmailTemplate({
    preheader: "השלב האחרון לפתיחת החשבון שלך הוא אימות כתובת האימייל.",
    eyebrow: "Email Verification",
    title: "אימות כתובת האימייל",
    intro: `כדי להשלים את פתיחת החשבון שלך ב-${appTitle}, צריך לאשר שזו כתובת האימייל שלך.`,
    details: [
      "הלחיצה על הכפתור תפעיל את החשבון ותאפשר להתחבר למערכת כרגיל.",
      "הקישור מיועד לחשבון הזה בלבד ונשלח כחלק מתהליך הרשמה מאובטח.",
    ],
    ctaLabel: "אימות אימייל",
    ctaUrl: verificationUrl,
    ctaHint: "אם פתחת את המייל במכשיר אחר, אפשר להעתיק את הקישור ולהדביק אותו בדפדפן.",
    noteTitle: "חשוב לדעת",
    noteText:
      "אם לא ביקשת ליצור חשבון, אין צורך לעשות דבר. החשבון לא יופעל בלי השלמת האימות.",
    closingTitle: "לא ביקשת לפתוח חשבון?",
    closingText: "אפשר פשוט להתעלם מהמייל הזה. לא יבוצע שינוי בלי לחיצה על הקישור.",
    footerText:
      "המייל נשלח כדי להגן על הגישה לחשבון ולוודא שההרשמה בוצעה על ידך.",
  });

  console.info("[email-verification] dispatching account email send", {
    email: maskedEmail,
  });

  await sendAccountEmail({
    to: email,
    subject,
    html,
    text,
    category: "verification",
  });

  console.info("[email-verification] verification email send completed", {
    email: maskedEmail,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info(`[DEV EMAIL] Verification link: ${verificationUrl}`);
  }

  return verificationUrl;
}
