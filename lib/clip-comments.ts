import sanitizeHtml from "sanitize-html";
import { formatRelativeTime } from "@/lib/relative-time";

export const COMMENT_MAX_LENGTH = 1200;
export const COMMENT_MIN_INTERVAL_MS = 30_000;

export type ClipCommentRecord = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
};

export type ClipCommentView = {
  id: string;
  content: string;
  createdAtIso: string;
  createdAtLabel: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type ClipCommentReportActionResult = {
  status: "idle" | "success" | "error" | "auth";
  message: string | null;
  reportedCommentId?: string;
};

export function sanitizeCommentContent(value: string | null | undefined) {
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

export function buildClipCommentViews(
  comments: ClipCommentRecord[],
  locale: string = "he",
) {
  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAtIso: comment.createdAt.toISOString(),
    createdAtLabel: formatRelativeTime(comment.createdAt, locale),
    authorId: comment.user.id,
    authorName: comment.user.username,
    authorAvatarUrl: comment.user.avatarUrl,
  }));
}
