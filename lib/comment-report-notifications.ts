import { PermissionName, UserRole, UserStatus } from "@prisma/client";
import { sendAccountEmail, getAccountEmailConfig } from "@/lib/account-email";
import { renderAccountEmailTemplate } from "@/lib/account-email-template";
import { db } from "@/lib/db";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { getCommentReportReasonLabel } from "@/lib/comment-reports";
import { PERMISSIONS } from "@/lib/permissions";

const COMMENT_REPORT_NOTIFICATION_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.userView,
  PERMISSIONS.userManage,
];

type CommentReportNotificationContext = {
  reportId: string;
};

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getReportNotificationCopy(language: AppLanguage, input: {
  reasonLabel: string;
  moderationUrl: string;
  commentSnippet: string;
  detailsSnippet: string | null;
  musicalTitle: string;
  clipTitle: string;
  reporterName: string;
}) {
  if (language === "en") {
    return {
      subject: `New reported comment in Batzal's Musicals: ${input.reasonLabel}`,
      template: renderAccountEmailTemplate({
        preheader: "A new clip comment report is waiting in the moderation queue.",
        eyebrow: "Comment Moderation",
        title: "New comment report",
        intro: "A new comment report was submitted and is now waiting in the moderation queue.",
        details: [
          `Reason: ${input.reasonLabel}`,
          `Reporter: ${input.reporterName}`,
          `Musical: ${input.musicalTitle}`,
          `Clip: ${input.clipTitle}`,
          `Comment snippet: ${input.commentSnippet}`,
          ...(input.detailsSnippet ? [`Reporter details: ${input.detailsSnippet}`] : []),
        ],
        ctaLabel: "Open moderation queue",
        ctaUrl: input.moderationUrl,
        ctaHint: "Use the queue to review the report, dismiss it, or hide the comment if needed.",
        noteTitle: "Notification rule",
        noteText:
          "This email is sent only when the first open report is created for a comment, to avoid repeated alerts for the same thread.",
        closingTitle: "Need more context?",
        closingText:
          "Open the moderation queue to review the full comment, the report details, and the current visibility state.",
        footerText:
          "This moderation alert was sent because your account currently has access to comment-report review.",
      }),
    };
  }

  return {
    subject: `דיווח תגובה חדש ב-Batzal's Musicals: ${input.reasonLabel}`,
    template: renderAccountEmailTemplate({
      preheader: "דיווח חדש על תגובה ממתין עכשיו לבדיקה בתור המודרציה.",
      eyebrow: "Comment Moderation",
      title: "דיווח תגובה חדש",
      intro: "התקבל דיווח חדש על תגובה בקטע, והוא ממתין עכשיו לבדיקה בתור המודרציה.",
      details: [
        `סיבה: ${input.reasonLabel}`,
        `מדווח: ${input.reporterName}`,
        `מחזה: ${input.musicalTitle}`,
        `קליפ: ${input.clipTitle}`,
        `קטע מהתגובה: ${input.commentSnippet}`,
        ...(input.detailsSnippet ? [`פירוט מהמדווח: ${input.detailsSnippet}`] : []),
      ],
      ctaLabel: "פתח את תור הדיווחים",
      ctaUrl: input.moderationUrl,
      ctaHint: "בתור אפשר לבדוק את הדיווח, לדחות אותו או להסתיר את התגובה לפי הצורך.",
      noteTitle: "כלל ההתראה",
      noteText:
        "המייל הזה נשלח רק כשנפתח הדיווח הפתוח הראשון על תגובה מסוימת, כדי למנוע הצפה על אותו מקרה.",
      closingTitle: "צריך עוד הקשר?",
      closingText:
        "פתח את תור הדיווחים כדי לראות את התגובה המלאה, את פרטי הדיווח ואת מצב החשיפה הנוכחי.",
      footerText:
        "ההתראה נשלחה כי לחשבון הזה יש כרגע גישה לבדיקת דיווחי תגובות.",
    }),
  };
}

async function getCommentModerationRecipients() {
  const [rolePermissions, users] = await Promise.all([
    db.rolePermission.findMany({
      where: {
        permission: {
          name: {
            in: COMMENT_REPORT_NOTIFICATION_PERMISSIONS,
          },
        },
      },
      include: {
        permission: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        status: UserStatus.active,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        language: true,
        role: true,
        userPermissions: {
          where: {
            permission: {
              name: {
                in: COMMENT_REPORT_NOTIFICATION_PERMISSIONS,
              },
            },
          },
          include: {
            permission: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const rolePermissionMap = new Map<UserRole, Set<PermissionName>>();
  for (const role of Object.values(UserRole)) {
    rolePermissionMap.set(role, new Set());
  }

  for (const rolePermission of rolePermissions) {
    rolePermissionMap.get(rolePermission.role)?.add(rolePermission.permission.name);
  }

  return users.filter((user) => {
    if (user.role === UserRole.superadmin) {
      return true;
    }

    const directPermissions = new Set(
      user.userPermissions.map((permission) => permission.permission.name),
    );
    const inheritedPermissions = rolePermissionMap.get(user.role) ?? new Set<PermissionName>();

    return COMMENT_REPORT_NOTIFICATION_PERMISSIONS.some(
      (permission) => directPermissions.has(permission) || inheritedPermissions.has(permission),
    );
  });
}

export async function notifyAdminsAboutNewCommentReport({
  reportId,
}: CommentReportNotificationContext) {
  const report = await db.commentReport.findUnique({
    where: { id: reportId },
    include: {
      reporterUser: {
        select: {
          id: true,
          username: true,
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          clip: {
            select: {
              title: true,
              musical: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!report) {
    return;
  }

  const recipients = await getCommentModerationRecipients();

  if (recipients.length === 0) {
    return;
  }

  const { appUrl } = getAccountEmailConfig();
  const moderationUrl = `${appUrl}/admin/comments`;
  const commentSnippet = truncate(report.comment.content, 220);
  const detailsSnippet = report.details ? truncate(report.details, 220) : null;

  await Promise.all(
    recipients.map(async (recipient) => {
      const language = normalizeLanguage(recipient.language);
      const reasonLabel = getCommentReportReasonLabel(report.reason, language);
      const copy = getReportNotificationCopy(language, {
        reasonLabel,
        moderationUrl,
        commentSnippet,
        detailsSnippet,
        musicalTitle: report.comment.clip.musical.title,
        clipTitle: report.comment.clip.title,
        reporterName: report.reporterUser.username,
      });

      await sendAccountEmail({
        to: recipient.email,
        subject: copy.subject,
        html: copy.template.subjectReadyHtml,
        text: copy.template.subjectReadyText,
        category: "moderation",
      });
    }),
  );
}
