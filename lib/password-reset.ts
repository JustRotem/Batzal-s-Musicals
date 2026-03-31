import { createHash, randomBytes } from "crypto";
import { getAccountEmailConfig, sendAccountEmail } from "@/lib/account-email";
import { renderAccountEmailTemplate } from "@/lib/account-email-template";
import { db } from "@/lib/db";

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}

export async function getValidPasswordResetTarget(token: string) {
  const tokenHash = hashPasswordResetToken(token);

  return db.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
    },
  });
}

export async function sendPasswordResetMessage({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const { appUrl } = getAccountEmailConfig();
  const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "קישור לאיפוס הסיסמה שלך ב-Batzal's Musicals";
  const { subjectReadyHtml: html, subjectReadyText: text } = renderAccountEmailTemplate({
    preheader: "התקבלה בקשה לבחירת סיסמה חדשה לחשבון שלך.",
    eyebrow: "Password Recovery",
    title: "איפוס סיסמה",
    intro:
      "התקבלה בקשה לבחירת סיסמה חדשה עבור החשבון שלך ב-Batzal's Musicals.",
    details: [
      "הקישור תקף לזמן מוגבל ונועד לשימוש חד-פעמי בלבד.",
      "לאחר בחירת סיסמה חדשה, יהיה אפשר להתחבר מיד עם הסיסמה המעודכנת.",
    ],
    ctaLabel: "איפוס סיסמה",
    ctaUrl: resetUrl,
    ctaHint: "מומלץ לפתוח את הקישור בהקדם. אם הוא יפוג, אפשר לבקש קישור חדש ממסך ההתחברות.",
    noteTitle: "לשקט נפשי",
    noteText:
      "אם לא ביקשת לאפס את הסיסמה, אפשר פשוט להתעלם מהמייל הזה והסיסמה הנוכחית תישאר ללא שינוי.",
    closingTitle: "לא ביקשת לאפס את הסיסמה?",
    closingText:
      "אין צורך לעשות דבר. כל עוד לא תלחץ על הקישור, הסיסמה הנוכחית שלך תישאר פעילה.",
    footerText:
      "המייל נשלח כדי לאפשר שחזור בטוח של הגישה לחשבון בלי לחשוף את הסיסמה הקיימת.",
  });

  await sendAccountEmail({
    to: email,
    subject,
    html,
    text,
    category: "password-reset",
  });

  if (process.env.NODE_ENV !== "production") {
    console.info(`[DEV EMAIL] Password reset link: ${resetUrl}`);
  }

  return resetUrl;
}
