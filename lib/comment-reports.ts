import sanitizeHtml from "sanitize-html";
import {
  CommentReportReason,
  CommentReportStatus,
} from "@/lib/prisma";
import type { AppLanguage } from "@/lib/i18n";

export const COMMENT_REPORT_MAX_DETAILS_LENGTH = 500;

const COMMENT_REPORT_REASON_LABELS: Record<
  AppLanguage,
  Record<CommentReportReason, string>
> = {
  he: {
    spam: "ספאם",
    abusive: "פוגעני / מתעלל",
    irrelevant: "לא רלוונטי",
    other: "אחר",
  },
  en: {
    spam: "Spam",
    abusive: "Offensive / abusive",
    irrelevant: "Irrelevant",
    other: "Other",
  },
};

export function getCommentReportReasonOptions(language: AppLanguage = "he") {
  return Object.values(CommentReportReason).map((value) => ({
    value,
    label: COMMENT_REPORT_REASON_LABELS[language][value],
  }));
}

export function parseCommentReportReason(value: string | null | undefined) {
  return Object.values(CommentReportReason).find((item) => item === value) ?? null;
}

export function getCommentReportReasonLabel(
  reason: CommentReportReason,
  language: AppLanguage = "he",
) {
  return COMMENT_REPORT_REASON_LABELS[language][reason] ?? COMMENT_REPORT_REASON_LABELS[language].other;
}

export function getCommentReportStatusLabel(
  status: CommentReportStatus,
  language: AppLanguage = "he",
) {
  switch (status) {
    case CommentReportStatus.open:
      return language === "he" ? "פתוח" : "Open";
    case CommentReportStatus.reviewed:
      return language === "he" ? "נסקר" : "Reviewed";
    case CommentReportStatus.dismissed:
      return language === "he" ? "נדחה" : "Dismissed";
    case CommentReportStatus.actioned:
      return language === "he" ? "טופל" : "Actioned";
    default:
      return language === "he" ? "פתוח" : "Open";
  }
}

export function sanitizeCommentReportDetails(value: string | null | undefined) {
  const sanitized = sanitizeHtml(value ?? "", {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return sanitized;
}
