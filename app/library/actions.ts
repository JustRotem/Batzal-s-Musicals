"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  buildClipCommentViews,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_INTERVAL_MS,
  type ClipCommentReportActionResult,
  type ClipCommentView,
  sanitizeCommentContent,
} from "@/lib/clip-comments";
import {
  COMMENT_REPORT_MAX_DETAILS_LENGTH,
  parseCommentReportReason,
  sanitizeCommentReportDetails,
} from "@/lib/comment-reports";
import { notifyAdminsAboutNewCommentReport } from "@/lib/comment-report-notifications";
import { CommentReportStatus } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

export type ClipCommentFormState = {
  status: "idle" | "success" | "error" | "auth";
  message: string | null;
  comments: ClipCommentView[];
};

function getCommentActionCopy(language: string) {
  const isEnglish = language === "en";

  return {
    authComment: isEnglish ? "You need to sign in to comment on this clip." : "צריך להתחבר כדי להגיב לקטע.",
    missingClip: isEnglish
      ? "I couldn't tell which clip this comment belongs to."
      : "לא הצלחתי לזהות לאיזה קטע לשייך את התגובה.",
    missingContent: isEnglish ? "Write a comment before sending it." : "צריך לכתוב תגובה לפני השליחה.",
    tooLong: isEnglish
      ? `This comment is too long. You can write up to ${COMMENT_MAX_LENGTH} characters.`
      : `התגובה ארוכה מדי. אפשר לכתוב עד ${COMMENT_MAX_LENGTH} תווים.`,
    clipMissing: isEnglish
      ? "That clip is no longer available. Refresh the page and try again."
      : "הקטע לא נמצא יותר. אפשר לרענן את העמוד ולנסות שוב.",
    cooldown: isEnglish
      ? "To reduce spam, wait a few seconds before posting another comment."
      : "כדי למנוע ספאם, אפשר לפרסם תגובה נוספת רק בעוד כמה שניות.",
    duplicate: isEnglish
      ? "It looks like you already posted that comment recently. Try adjusting the wording and send it again."
      : "נראה שזו אותה תגובה שפורסמה לאחרונה. אפשר לערוך את הניסוח ולנסות שוב.",
    created: isEnglish ? "Your comment was posted." : "התגובה נוספה בהצלחה.",
    authManage: isEnglish ? "You need to sign in to manage comments." : "צריך להתחבר כדי לנהל תגובות.",
    unknownComment: isEnglish ? "I couldn't tell which comment to remove." : "לא הצלחתי לזהות איזו תגובה להסיר.",
    unavailableToManage: isEnglish
      ? "That comment is no longer available to manage."
      : "התגובה הזו כבר לא זמינה לניהול.",
    noPermission: isEnglish ? "You don't have permission to remove this comment." : "אין לך הרשאה להסיר את התגובה הזו.",
    removedOwn: isEnglish ? "The comment was removed." : "התגובה הוסרה.",
    hidden: isEnglish ? "The comment was hidden." : "התגובה הוסתרה.",
    authReport: isEnglish ? "You need to sign in to report a comment." : "צריך להתחבר כדי לדווח על תגובה.",
    unknownReportTarget: isEnglish
      ? "I couldn't tell which comment to report."
      : "לא הצלחתי לזהות על איזו תגובה לדווח.",
    missingReason: isEnglish ? "Choose a report reason." : "צריך לבחור סיבת דיווח.",
    detailsTooLong: isEnglish
      ? `You can add up to ${COMMENT_REPORT_MAX_DETAILS_LENGTH} extra characters.`
      : `אפשר להוסיף פירוט של עד ${COMMENT_REPORT_MAX_DETAILS_LENGTH} תווים.`,
    unavailableToReport: isEnglish
      ? "That comment is no longer available to report."
      : "התגובה הזו כבר לא זמינה לדיווח.",
    ownComment: isEnglish ? "You can't report your own comment." : "אי אפשר לדווח על תגובה של עצמך.",
    duplicateReport: isEnglish
      ? "You've already sent an open report for this comment."
      : "כבר שלחת דיווח פתוח על התגובה הזו.",
    reportSent: isEnglish ? "The report was sent for review." : "הדיווח נשלח לבדיקה.",
  };
}

async function getVisibleClipComments(clipId: string, locale: string) {
  const comments = await db.comment.findMany({
    where: {
      clipId,
      status: "visible",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  });

  return buildClipCommentViews(comments, locale);
}

function buildState(
  previousState: ClipCommentFormState,
  overrides: Partial<ClipCommentFormState>,
): ClipCommentFormState {
  return {
    ...previousState,
    ...overrides,
  };
}

export async function createClipCommentAction(
  previousState: ClipCommentFormState,
  formData: FormData,
): Promise<ClipCommentFormState> {
  const currentUser = await getCurrentUser();
  const locale = currentUser?.language === "en" ? "en" : "he";
  const copy = getCommentActionCopy(locale);

  if (!currentUser) {
    return buildState(previousState, {
      status: "auth",
      message: copy.authComment,
    });
  }

  const clipId = formData.get("clipId")?.toString().trim() ?? "";
  const musicalSlug = normalizeSlug(formData.get("musicalSlug")?.toString() ?? "");
  const content = sanitizeCommentContent(formData.get("content")?.toString());
  if (!clipId || !musicalSlug) {
    return buildState(previousState, {
      status: "error",
      message: copy.missingClip,
    });
  }

  if (!content) {
    return buildState(previousState, {
      status: "error",
      message: copy.missingContent,
    });
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return buildState(previousState, {
      status: "error",
      message: copy.tooLong,
    });
  }

  const clip = await db.clip.findFirst({
    where: {
      id: clipId,
      musical: {
        slug: musicalSlug,
      },
    },
    select: {
      id: true,
      musical: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!clip) {
    return buildState(previousState, {
      status: "error",
      message: copy.clipMissing,
    });
  }

  const latestComment = await db.comment.findFirst({
    where: {
      clipId,
      userId: currentUser.id,
      status: "visible",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      content: true,
    },
  });

  if (
    latestComment &&
    Date.now() - latestComment.createdAt.getTime() < COMMENT_MIN_INTERVAL_MS
  ) {
    return buildState(previousState, {
      status: "error",
      message: copy.cooldown,
    });
  }

  if (
    latestComment &&
    latestComment.content === content &&
    Date.now() - latestComment.createdAt.getTime() < 10 * 60 * 1000
  ) {
    return buildState(previousState, {
      status: "error",
      message: copy.duplicate,
    });
  }

  await db.comment.create({
    data: {
      clipId,
      userId: currentUser.id,
      content,
    },
  });

  return {
    status: "success",
    message: copy.created,
    comments: await getVisibleClipComments(clipId, locale),
  };
}

export async function hideClipCommentAction(
  previousState: ClipCommentFormState,
  formData: FormData,
): Promise<ClipCommentFormState> {
  const currentUser = await getCurrentUser();
  const locale = currentUser?.language === "en" ? "en" : "he";
  const copy = getCommentActionCopy(locale);

  if (!currentUser) {
    return buildState(previousState, {
      status: "auth",
      message: copy.authManage,
    });
  }

  const commentId = formData.get("commentId")?.toString().trim() ?? "";
  const clipId = formData.get("clipId")?.toString().trim() ?? "";
  const musicalSlug = normalizeSlug(formData.get("musicalSlug")?.toString() ?? "");
  if (!commentId || !clipId || !musicalSlug) {
    return buildState(previousState, {
      status: "error",
      message: copy.unknownComment,
    });
  }

  const comment = await db.comment.findFirst({
    where: {
      id: commentId,
      clipId,
      clip: {
        musical: {
          slug: musicalSlug,
        },
      },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      clip: {
        select: {
          musical: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!comment || comment.status === "hidden") {
    return buildState(previousState, {
      status: "error",
      message: copy.unavailableToManage,
      comments: await getVisibleClipComments(clipId, locale),
    });
  }

  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";
  const canHide = isAdmin || currentUser.id === comment.userId;

  if (!canHide) {
    return buildState(previousState, {
      status: "error",
      message: copy.noPermission,
      comments: await getVisibleClipComments(clipId, locale),
    });
  }

  await db.comment.update({
    where: {
      id: comment.id,
    },
    data: {
      status: "hidden",
      hiddenAt: new Date(),
      moderatedAt: new Date(),
      moderatedById: currentUser.id,
    },
  });

  return {
    status: "success",
    message: currentUser.id === comment.userId ? copy.removedOwn : copy.hidden,
    comments: await getVisibleClipComments(clipId, locale),
  };
}

export async function createClipCommentReportAction(
  formData: FormData,
): Promise<ClipCommentReportActionResult> {
  const currentUser = await getCurrentUser();
  const locale = currentUser?.language === "en" ? "en" : "he";
  const copy = getCommentActionCopy(locale);

  if (!currentUser) {
    return {
      status: "auth",
      message: copy.authReport,
    };
  }

  const commentId = formData.get("commentId")?.toString().trim() ?? "";
  const clipId = formData.get("clipId")?.toString().trim() ?? "";
  const musicalSlug = normalizeSlug(formData.get("musicalSlug")?.toString() ?? "");
  const reason = parseCommentReportReason(formData.get("reason")?.toString());
  const details = sanitizeCommentReportDetails(formData.get("details")?.toString());

  if (!commentId || !clipId || !musicalSlug) {
    return {
      status: "error",
      message: copy.unknownReportTarget,
    };
  }

  if (!reason) {
    return {
      status: "error",
      message: copy.missingReason,
    };
  }

  if (details.length > COMMENT_REPORT_MAX_DETAILS_LENGTH) {
    return {
      status: "error",
      message: copy.detailsTooLong,
    };
  }

  const comment = await db.comment.findFirst({
    where: {
      id: commentId,
      clipId,
      status: "visible",
      clip: {
        musical: {
          slug: musicalSlug,
        },
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!comment) {
    return {
      status: "error",
      message: copy.unavailableToReport,
    };
  }

  if (comment.userId === currentUser.id) {
    return {
      status: "error",
      message: copy.ownComment,
    };
  }

  const existingOpenReport = await db.commentReport.findFirst({
    where: {
      commentId: comment.id,
      reporterUserId: currentUser.id,
      status: CommentReportStatus.open,
    },
    select: {
      id: true,
    },
  });

  if (existingOpenReport) {
    return {
      status: "error",
      message: copy.duplicateReport,
      reportedCommentId: comment.id,
    };
  }

  const existingOpenReportForComment = await db.commentReport.findFirst({
    where: {
      commentId: comment.id,
      status: CommentReportStatus.open,
    },
    select: {
      id: true,
    },
  });

  const createdReport = await db.commentReport.create({
    data: {
      commentId: comment.id,
      reporterUserId: currentUser.id,
      reason,
      details: details || null,
    },
  });

  if (!existingOpenReportForComment) {
    try {
      await notifyAdminsAboutNewCommentReport({
        reportId: createdReport.id,
      });
    } catch (error) {
      console.error("[comment-report-notification] failed to notify moderators", {
        reportId: createdReport.id,
        commentId: comment.id,
        reporterUserId: currentUser.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath("/admin/comments");

  return {
    status: "success",
    message: copy.reportSent,
    reportedCommentId: comment.id,
  };
}
