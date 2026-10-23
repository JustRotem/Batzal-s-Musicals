import sanitizeHtml from "sanitize-html";
import { formatRelativeTime } from "@/lib/relative-time";

export const COMMENT_MAX_LENGTH = 1200;

// The five shown first; any other emoji can be chosen from the full picker.
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"] as const;

// One emoji (with its skin tone, flag or joined parts), nothing else.
export function isValidReactionEmoji(value: string) {
  if (!value || value.length > 24) return false;

  const segments = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));

  return segments.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value);
}

export type CommentReactionView = { emoji: string; count: number; mine: boolean; users: string[] };

export function buildReactionViews(
  reactions: Array<{ userId: string; emoji: string; user?: { username: string } }> | undefined,
  viewerId: string | null,
): CommentReactionView[] {
  const groups = new Map<string, CommentReactionView>();

  for (const reaction of reactions ?? []) {
    const group = groups.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false, users: [] };

    group.count += 1;
    group.mine = group.mine || (viewerId !== null && reaction.userId === viewerId);

    if (reaction.user?.username && group.users.length < 30) {
      group.users.push(reaction.user.username);
    }

    groups.set(reaction.emoji, group);
  }

  // The most used first; equal counts keep the order in which they first appeared
  return Array.from(groups.values()).sort((left, right) => right.count - left.count);
}

export const COMMENT_MIN_INTERVAL_MS = 30_000;

export type ClipCommentRecord = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  reactions?: Array<{ userId: string; emoji: string; user?: { username: string } }>;
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
  reactions: CommentReactionView[];
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
  viewerId: string | null = null,
): ClipCommentView[] {
  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAtIso: comment.createdAt.toISOString(),
    createdAtLabel: formatRelativeTime(comment.createdAt, locale),
    authorId: comment.user.id,
    authorName: comment.user.username,
    authorAvatarUrl: comment.user.avatarUrl,
    reactions: buildReactionViews(comment.reactions, viewerId),
  }));
}
