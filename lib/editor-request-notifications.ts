import { db } from "@/lib/db";
import { sendAccountEmail, AccountEmailDeliveryError, getAccountEmailConfig } from "@/lib/account-email";
import { renderAccountEmailTemplate } from "@/lib/account-email-template";
import { PERMISSIONS } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

type RequestUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  requestMessage: string | null;
};

function buildFullName(user: {
  firstName: string;
  lastName: string;
  username?: string;
}) {
  return `${user.firstName} ${user.lastName}`.trim() || user.username || "משתמש";
}

async function getEditorRequestReviewerRoles() {
  const rolePermissions = await db.rolePermission.findMany({
    where: {
      permission: {
        name: PERMISSIONS.editorRequestReview,
      },
    },
    select: {
      role: true,
    },
  });

  return Array.from(new Set(rolePermissions.map((item) => item.role)));
}

async function getEditorRequestReviewRecipients() {
  const reviewerRoles = await getEditorRequestReviewerRoles();
  const recipients = await db.user.findMany({
    where: {
      status: "active",
      emailVerified: true,
      OR: [
        { role: UserRole.superadmin },
        ...(reviewerRoles.length > 0 ? [{ role: { in: reviewerRoles } }] : []),
        {
          userPermissions: {
            some: {
              permission: {
                name: PERMISSIONS.editorRequestReview,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  const uniqueRecipients = new Map<string, (typeof recipients)[number]>();
  for (const recipient of recipients) {
    uniqueRecipients.set(recipient.email.toLowerCase(), recipient);
  }

  return Array.from(uniqueRecipients.values());
}

async function sendEditorRequestEmail({
  to,
  subject,
  template,
}: {
  to: string;
  subject: string;
  template: ReturnType<typeof renderAccountEmailTemplate>;
}) {
  await sendAccountEmail({
    to,
    subject,
    html: template.subjectReadyHtml,
    text: template.subjectReadyText,
    category: "account",
  });
}

export async function notifyAdminsAboutEditorRequest(requestUser: RequestUser) {
  const recipients = await getEditorRequestReviewRecipients();

  if (recipients.length === 0) {
    console.warn("[editor-request-notify] no admin recipients found for new request", {
      requesterId: requestUser.id,
    });
    return;
  }

  const { appUrl } = getAccountEmailConfig();
  const requesterName = buildFullName(requestUser);
  const adminReviewUrl = `${appUrl}/admin?status=pending`;
  const template = renderAccountEmailTemplate({
    preheader: `התקבלה בקשת גישת עריכה חדשה מאת ${requesterName}.`,
    eyebrow: "Editor Request",
    title: "בקשת גישת עריכה חדשה",
    intro: `התקבלה בקשה חדשה לגישת עורך עבור החשבון של ${requesterName}.`,
    details: [
      `שם משתמש: ${requestUser.username}`,
      `אימייל החשבון: ${requestUser.email}`,
      requestUser.requestMessage
        ? `הודעת המשתמש: ${requestUser.requestMessage}`
        : "המשתמש לא הוסיף הודעה נוספת לבקשה.",
    ],
    ctaLabel: "צפייה בבקשה",
    ctaUrl: adminReviewUrl,
    ctaHint: "הקישור יוביל ישירות לאזור ניהול החשבונות עם הבקשות הממתינות.",
    noteTitle: "למה קיבלת את המייל הזה?",
    noteText:
      "המייל נשלח לחשבונות שיש להם הרשאה לסקור בקשות עורך, כדי שיהיה אפשר לטפל בבקשה בזמן.",
    footerText: "המייל נשלח כחלק מזרימת ניהול ההרשאות של Batzal's Musicals.",
  });

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendEditorRequestEmail({
          to: recipient.email,
          subject: "בקשת גישת עריכה חדשה ב-Batzal's Musicals",
          template,
        });
      } catch (error) {
        console.error("[editor-request-notify] admin notification failed", {
          recipientId: recipient.id,
          requesterId: requestUser.id,
          reason:
            error instanceof AccountEmailDeliveryError
              ? error.causeSummary || error.code
              : error instanceof Error
                ? error.message
                : "unknown-error",
        });
      }
    }),
  );
}

export async function notifyUserAboutEditorRequestApproved(user: RequestUser) {
  const { appUrl } = getAccountEmailConfig();
  const template = renderAccountEmailTemplate({
    preheader: "בקשת גישת העריכה שלך אושרה.",
    eyebrow: "Editor Access",
    title: "בקשת גישת העריכה אושרה",
    intro: "החשבון שלך קיבל הרשאות עורך, ואפשר עכשיו להיכנס ולעבוד עם מחזות וקליפים במערכת.",
    details: [
      "ההרשאות החדשות פעילות כבר עכשיו.",
      "אין צורך להגיש בקשה נוספת. אפשר להיכנס לחשבון ולהתחיל לעבוד.",
    ],
    ctaLabel: "כניסה לחשבון",
    ctaUrl: `${appUrl}/auth/login`,
    ctaHint: "אחרי ההתחברות, אזור הניהול והעריכה יוצגו בהתאם להרשאות החדשות שלך.",
    noteTitle: "מה השתנה?",
    noteText: "החשבון שלך קודם לתפקיד עורך, ולכן נוספה גישה ליצירה ועריכה של תוכן.",
    footerText: "אם לא ציפית לשינוי הזה, אפשר לפנות לאדמין המערכת לבדיקה.",
  });

  try {
    await sendEditorRequestEmail({
      to: user.email,
      subject: "בקשת גישת העריכה שלך אושרה",
      template,
    });
  } catch (error) {
    console.error("[editor-request-notify] approval email failed", {
      userId: user.id,
      reason:
        error instanceof AccountEmailDeliveryError
          ? error.causeSummary || error.code
          : error instanceof Error
            ? error.message
            : "unknown-error",
    });
  }
}

export async function notifyUserAboutEditorRequestRejected(user: RequestUser) {
  const { appUrl } = getAccountEmailConfig();
  const template = renderAccountEmailTemplate({
    preheader: "בקשת גישת העריכה שלך נבדקה ולא אושרה בשלב הזה.",
    eyebrow: "Editor Access",
    title: "בקשת גישת העריכה לא אושרה",
    intro: "בקשת גישת העריכה של החשבון שלך נבדקה, ובשלב הזה הוחלט שלא לאשר אותה.",
    details: [
      "החשבון שלך נשאר פעיל ורגיל, ואפשר להמשיך להשתמש בו כרגיל.",
      "אם יהיה צורך בהמשך, אפשר להגיש בקשה חדשה מתוך אזור החשבון.",
    ],
    ctaLabel: "אזור החשבון",
    ctaUrl: `${appUrl}/profile?section=profile`,
    ctaHint: "בדף החשבון אפשר להמשיך לעקוב אחרי מצב הגישה ולהגיש בקשה חדשה בעתיד אם צריך.",
    noteTitle: "מה קורה עכשיו?",
    noteText: "לא בוצע שינוי שלילי בחשבון. רק הרשאות העריכה לא נוספו בשלב הזה.",
    footerText: "אם נראה שיש טעות או אם הנסיבות השתנו, אפשר לפנות שוב לאדמין או להגיש בקשה חדשה.",
  });

  try {
    await sendEditorRequestEmail({
      to: user.email,
      subject: "עדכון לגבי בקשת גישת העריכה שלך",
      template,
    });
  } catch (error) {
    console.error("[editor-request-notify] rejection email failed", {
      userId: user.id,
      reason:
        error instanceof AccountEmailDeliveryError
          ? error.causeSummary || error.code
          : error instanceof Error
            ? error.message
            : "unknown-error",
    });
  }
}
