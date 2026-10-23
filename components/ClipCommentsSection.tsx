"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  COMMENT_MAX_LENGTH,
  type ClipCommentReportActionResult,
  type ClipCommentView,
} from "@/lib/clip-comments";
import {
  COMMENT_REPORT_MAX_DETAILS_LENGTH,
  getCommentReportReasonOptions,
} from "@/lib/comment-reports";
import type { AppLanguage } from "@/lib/i18n";
import {
  createClipCommentAction,
  createClipCommentReportAction,
  hideClipCommentAction,
  toggleCommentReactionAction,
  type ClipCommentFormState,
} from "@/app/library/actions";
import { REACTION_EMOJIS } from "@/lib/clip-comments";
import FullEmojiPicker from "@/components/FullEmojiPicker";
import ModalCloseButton from "@/components/ModalCloseButton";
import { createPortal } from "react-dom";

type ClipCommentsSectionProps = {
  clipId: string;
  musicalSlug: string;
  language: AppLanguage;
  currentUser: {
    id: string;
    username: string;
    avatarUrl: string | null;
    language: string;
    role: "user" | "editor" | "admin" | "superadmin";
  } | null;
  initialComments: ClipCommentView[];
  reportedCommentIds: string[];
};

type FeedbackState = {
  status: "success" | "error" | "auth";
  message: string;
} | null;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return name.trim().slice(0, 2).toUpperCase();
}

function createBaseState(comments: ClipCommentView[]): ClipCommentFormState {
  return {
    status: "idle",
    message: null,
    comments,
  };
}

function isRTL(text: string) {
  return /[\u0590-\u05FF]/.test(text);
}

function getCommentsCopy(language: AppLanguage) {
  if (language === "en") {
    return {
      title: "Comments",
      totalComments: (count: number) =>
        count > 0
          ? `${count} comment${count === 1 ? "" : "s"} on this clip`
          : "No comments yet. Be the first to start the conversation.",
      writeComment: "Write a comment",
      commentPlaceholder: "What did you think about this clip?",
      commentHint: `Up to ${COMMENT_MAX_LENGTH} characters. Your comment will be published as soon as it is sent.`,
      submit: "Post Comment",
      submitting: "Posting comment...",
      authTitle: "Want to comment on this clip?",
      authText: "Sign in to post a comment and join the conversation.",
      authButton: "Sign in to comment",
      empty: "No comments yet",
      reactions: "Reactions",
      addReaction: "Add reaction",
      noReactions: "No reactions yet",
      moreEmojis: "All emoji",
      remove: "Delete Comment",
      hide: "Hide Comment",
      hiding: "Removing...",
      report: "Report",
      reportSent: "Report sent",
      reportReason: "Report reason",
      reportDetails: "Extra details",
      reportDetailsPlaceholder: "You can add a short note to help with the review.",
      reportHint: `Up to ${COMMENT_REPORT_MAX_DETAILS_LENGTH} characters. The report will be reviewed by an admin.`,
      cancel: "Cancel",
      sendReport: "Send report",
      sendingReport: "Sending report...",
    };
  }

  return {
    title: "תגובות",
    totalComments: (count: number) =>
      count > 0
        ? `${count} תגובות על הקטע הזה`
        : "עדיין אין תגובות. אפשר להיות הראשונים לפתוח את השיחה.",
    writeComment: "כתבו תגובה",
    commentPlaceholder: "מה חשבתם על הקטע?",
    commentHint: `עד ${COMMENT_MAX_LENGTH} תווים. התגובה תתפרסם מיד אחרי אישור השליחה.`,
    submit: "פרסם תגובה",
    submitting: "שולח תגובה...",
    authTitle: "רוצים להגיב לקטע?",
    authText: "צריך להתחבר כדי לפרסם תגובה ולראות אתכם כחלק מהשיחה.",
    authButton: "התחברו כדי להגיב",
    empty: "אין תגובות עדיין",
    reactions: "תגובות אימוג׳י",
    addReaction: "הוסף תגובה",
    noReactions: "עוד אין תגובות אימוג׳י",
    moreEmojis: "כל האימוג׳ים",
    remove: "מחק תגובה",
    hide: "הסתר תגובה",
    hiding: "מסיר...",
    report: "דווח",
    reportSent: "הדיווח נשלח",
    reportReason: "סיבת הדיווח",
    reportDetails: "פירוט נוסף",
    reportDetailsPlaceholder: "אפשר להוסיף הקשר קצר שיעזור לבדיקה.",
    reportHint: `עד ${COMMENT_REPORT_MAX_DETAILS_LENGTH} תווים. הדיווח נשלח לבדיקה של האדמין.`,
    cancel: "ביטול",
    sendReport: "שלח דיווח",
    sendingReport: "שולח דיווח...",
  };
}

export default function ClipCommentsSection({
  clipId,
  musicalSlug,
  language,
  currentUser,
  initialComments,
  reportedCommentIds,
}: ClipCommentsSectionProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const copy = useMemo(() => getCommentsCopy(language), [language]);
  const reportReasonOptions = useMemo(() => getCommentReportReasonOptions(language), [language]);
  const [comments, setComments] = useState(initialComments);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isModerating, startModerating] = useTransition();
  const [isReporting, startReporting] = useTransition();
  const [moderatingCommentId, setModeratingCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(reportReasonOptions[0]?.value ?? "spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportedIds, setReportedIds] = useState<string[]>(reportedCommentIds);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [fullPickerOpen, setFullPickerOpen] = useState(false);
  const [popoverUp, setPopoverUp] = useState(true);

  const pathname = usePathname();

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    if (!fullPickerOpen || popoverUp) return;

    const timer = window.setTimeout(() => {
      document.querySelector(".reaction-popover")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fullPickerOpen, popoverUp]);

  useEffect(() => {
    if (!reactionPickerFor) return;

    const onClick = (event: MouseEvent) => {
      const owner = (event.target as HTMLElement | null)?.closest?.("[data-reactions-for]");

      if (!owner || owner.getAttribute("data-reactions-for") !== reactionPickerFor) {
        setReactionPickerFor(null);
        setFullPickerOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReactionPickerFor(null);
        setFullPickerOpen(false);
      }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [reactionPickerFor]);

  useEffect(() => {
    setReportedIds(reportedCommentIds);
  }, [reportedCommentIds]);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const totalCommentsLabel = useMemo(() => {
    return copy.totalComments(comments.length);
  }, [comments.length, copy]);
  const reportedIdSet = useMemo(() => new Set(reportedIds), [reportedIds]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formRef.current) {
      return;
    }

    const formData = new FormData(formRef.current);
    setFeedback(null);

    startSubmitting(async () => {
      const result = await createClipCommentAction(createBaseState(comments), formData);
      setComments(result.comments);

      if (result.status === "success") {
        formRef.current?.reset();
      }

      if (result.message && result.status !== "idle") {
        setFeedback({
          status: result.status,
          message: result.message,
        });
      }
    });
  }

  function handleReact(commentId: string, emoji: string) {
    setReactionPickerFor(null);
    setFullPickerOpen(false);

    // show the change at once, then take the server's numbers
    setComments((current) =>
      current.map((comment) => {
        if (comment.id !== commentId) return comment;

        const myName = currentUser?.username ?? "";
        const without = (users: string[]) => users.filter((name) => name !== myName);
        const hadSame = comment.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine);
        // my previous reaction (if any) is replaced
        let reactions = comment.reactions
          .map((reaction) =>
            reaction.mine
              ? { ...reaction, mine: false, count: reaction.count - 1, users: without(reaction.users) }
              : reaction,
          )
          .filter((reaction) => reaction.count > 0);

        if (!hadSame) {
          const existing = reactions.find((reaction) => reaction.emoji === emoji);

          reactions = existing
            ? reactions.map((reaction) =>
                reaction.emoji === emoji
                  ? { ...reaction, mine: true, count: reaction.count + 1, users: [...reaction.users, myName] }
                  : reaction,
              )
            : [...reactions, { emoji, count: 1, mine: true, users: [myName] }];
        }

        return { ...comment, reactions };
      }),
    );

    void toggleCommentReactionAction(commentId, emoji).then((result) => {
      if (!result.ok) return;

      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? { ...comment, reactions: result.reactions } : comment)),
      );
    });
  }

  function handleHide(commentId: string) {
    const formData = new FormData();
    formData.set("commentId", commentId);
    formData.set("clipId", clipId);
    formData.set("musicalSlug", musicalSlug);
    setFeedback(null);
    setModeratingCommentId(commentId);

    startModerating(async () => {
      const result = await hideClipCommentAction(createBaseState(comments), formData);
      setComments(result.comments);
      setModeratingCommentId(null);

      if (result.message && result.status !== "idle") {
        setFeedback({
          status: result.status,
          message: result.message,
        });
      }
    });
  }

  function handleOpenReport(commentId: string) {
    setFeedback(null);
    setReportingCommentId(commentId);
    setReportReason(reportReasonOptions[0]?.value ?? "spam");
    setReportDetails("");
  }

  function handleReportSubmit(commentId: string) {
    const formData = new FormData();
    formData.set("commentId", commentId);
    formData.set("clipId", clipId);
    formData.set("musicalSlug", musicalSlug);
    formData.set("reason", reportReason);
    formData.set("details", reportDetails);
    setFeedback(null);

    startReporting(async () => {
      const result: ClipCommentReportActionResult = await createClipCommentReportAction(formData);

      if (result.status === "success" && result.reportedCommentId) {
        setReportedIds((current) =>
          current.includes(result.reportedCommentId!)
            ? current
            : [...current, result.reportedCommentId!],
        );
        setReportingCommentId(null);
        setReportDetails("");
      }

      if (result.message && result.status !== "idle") {
        setFeedback({
          status: result.status,
          message: result.message,
        });
      }
    });
  }

  return (
    <section className="clip-comments-section">
      <div className="clip-comments-header">
        <div>
          <h3 className="clip-comments-title">{copy.title}</h3>
          <p className="clip-comments-subtitle">{totalCommentsLabel}</p>
        </div>
      </div>

      {currentUser ? (
        <form ref={formRef} onSubmit={handleSubmit} className="clip-comment-form">
          <input type="hidden" name="clipId" value={clipId} />
          <input type="hidden" name="musicalSlug" value={musicalSlug} />
          <label className="field" htmlFor={`comment-${clipId}`}>
            <span className="field-label">{copy.writeComment}</span>
            <textarea
              id={`comment-${clipId}`}
              name="content"
              className="textarea clip-comment-textarea"
              placeholder={copy.commentPlaceholder}
              maxLength={COMMENT_MAX_LENGTH}
              rows={4}
              required
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            />
          </label>
          <div className="clip-comment-form-footer">
            <span className="show-meta">
              {copy.commentHint}
            </span>
            <button
              type="submit"
              className="button-primary"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? copy.submitting : copy.submit}
            </button>
          </div>
          {feedback ? (
            <p
              className={`form-message ${feedback.status === "success" ? "success" : "error"}`}
              role="status"
            >
              {feedback.message}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="clip-comment-auth-prompt">
          <div>
            <strong>{copy.authTitle}</strong>
            <span>{copy.authText}</span>
          </div>
          <Link
            href={`/auth/account/start?next=${encodeURIComponent(`${pathname || "/"}#clip-${clipId}`)}`}
            prefetch={false}
            className="button-secondary"
          >
            {copy.authButton}
          </Link>
        </div>
      )}

      {comments.length === 0 ? (
        currentUser ? <div className="clip-comment-empty-state">{copy.empty}</div> : null
      ) : (
        <div className="clip-comment-list">
          {comments.map((comment) => {
            const canHide =
              !!currentUser && (currentUser.id === comment.authorId || !!isAdmin);
            const canReport =
              !!currentUser &&
              currentUser.id !== comment.authorId &&
              !reportedIdSet.has(comment.id);
            const isRemoving = isModerating && moderatingCommentId === comment.id;
            const isReportingThisComment = isReporting && reportingCommentId === comment.id;
            const reportIsOpen = reportingCommentId === comment.id;
            const commentIsRtl = isRTL(comment.content);

            return (
              <article key={comment.id} className="clip-comment-card">
                <div className="clip-comment-avatar" aria-hidden="true">
                  {comment.authorAvatarUrl ? (
                    <img src={comment.authorAvatarUrl} alt="" />
                  ) : (
                    <span>{getInitials(comment.authorName)}</span>
                  )}
                </div>
                <div className="clip-comment-body">
                  <div className="clip-comment-meta">
                    <div className="clip-comment-meta-main">
                      <strong>{comment.authorName}</strong>
                      <time dateTime={comment.createdAtIso}>{comment.createdAtLabel}</time>
                    </div>
                    {canHide ? (
                      <div className="clip-comment-actions">
                        <button
                          type="button"
                          className="button-secondary button-small clip-comment-action-button"
                          disabled={isModerating}
                          onClick={() => handleHide(comment.id)}
                        >
                          {isRemoving
                            ? copy.hiding
                            : currentUser?.id === comment.authorId
                              ? copy.remove
                              : copy.hide}
                        </button>

                        {canReport ? (
                          <button
                            type="button"
                            className="button-secondary button-small clip-comment-action-button"
                            disabled={isReporting}
                            onClick={() => handleOpenReport(comment.id)}
                          >
                            {copy.report}
                          </button>
                        ) : null}

                        {!canReport && reportedIdSet.has(comment.id) ? (
                          <span className="clip-comment-report-badge">{copy.reportSent}</span>
                        ) : null}
                      </div>
                    ) : canReport ? (
                      <div className="clip-comment-actions">
                        <button
                          type="button"
                          className="button-secondary button-small clip-comment-action-button"
                          disabled={isReporting}
                          onClick={() => handleOpenReport(comment.id)}
                        >
                          {copy.report}
                        </button>
                      </div>
                    ) : reportedIdSet.has(comment.id) ? (
                      <span className="clip-comment-report-badge">{copy.reportSent}</span>
                    ) : null}
                  </div>
                  <div
                    className={`clip-comment-content ${commentIsRtl ? "is-rtl" : "is-ltr"}`}
                    dir={commentIsRtl ? "rtl" : "ltr"}
                  >
                    {comment.content}
                  </div>

                  <div className="clip-comment-reactions" role="group" aria-label={copy.reactions} data-reactions-for={comment.id}>
                    {comment.reactions
                      .filter((reaction) => reaction.count > 0)
                      .map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          className={`reaction-pill ${reaction.mine ? "is-mine" : ""}`}
                          title={reaction.users.join(", ")}
                          onClick={(event) => {
                            const box = event.currentTarget.closest("[data-reactions-for]")?.getBoundingClientRect();

                            // the full emoji list is tall: open upward when there is room, otherwise downward
                            const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;

                            setPopoverUp(box ? box.top - headerHeight > 440 : true);
                            setFullPickerOpen(false);
                            setReactionPickerFor((current) => (current === comment.id ? null : comment.id));
                          }}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    {currentUser && !comment.reactions.some((reaction) => reaction.mine) ? (
                      <button
                        type="button"
                        className="reaction-pill reaction-add-button"
                        aria-label={copy.addReaction}
                        title={copy.addReaction}
                        onClick={(event) => {
                            const box = event.currentTarget.closest("[data-reactions-for]")?.getBoundingClientRect();

                            // the full emoji list is tall: open upward when there is room, otherwise downward
                            const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;

                            setPopoverUp(box ? box.top - headerHeight > 440 : true);
                            setFullPickerOpen(false);
                            setReactionPickerFor((current) => (current === comment.id ? null : comment.id));
                          }}
                      >
                        +
                      </button>
                    ) : null}
                    {reactionPickerFor === comment.id ? (
                      <div className={`reaction-popover ${popoverUp ? "is-up" : ""}`} role="dialog" aria-label={copy.reactions}>
                        {currentUser ? (
                          <>
                            <div className="reaction-picker-row" role="menu">
                              {REACTION_EMOJIS.map((emoji) => {
                                const selected = comment.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine);

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    className={selected ? "is-selected" : undefined}
                                    onClick={() => handleReact(comment.id, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className={`reaction-more ${fullPickerOpen ? "is-open" : ""}`}
                                aria-label={copy.moreEmojis}
                                title={copy.moreEmojis}
                                aria-expanded={fullPickerOpen}
                                onClick={() => setFullPickerOpen((open) => !open)}
                              >
                                +
                              </button>
                            </div>
                            {fullPickerOpen ? (
                              <FullEmojiPicker language={language} onPick={(emoji) => handleReact(comment.id, emoji)} />
                            ) : null}
                          </>
                        ) : null}
                        {comment.reactions.some((reaction) => reaction.count > 0) ? (
                          <ul className="reaction-who">
                            {comment.reactions
                              .filter((reaction) => reaction.count > 0)
                              .map((reaction) => (
                                <li key={reaction.emoji}>
                                  <span className="reaction-who-emoji">{reaction.emoji}</span>
                                  <span dir="auto">{reaction.users.join(", ")}</span>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <div className="reaction-who-empty">{copy.noReactions}</div>
                        )}
                      </div>
                    ) : null}
                  </div>

                </div>
              </article>
            );
          })}
        </div>
      )}

      {reportingCommentId && typeof document !== "undefined"
        ? createPortal(
            <div className="confirm-modal-overlay" onClick={() => setReportingCommentId(null)}>
              <div
                className="card confirm-modal-card report-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <ModalCloseButton
                  label={language === "he" ? "סגור" : "Close"}
                  onClick={() => setReportingCommentId(null)}
                  disabled={isReporting}
                />
                <div className="confirm-modal-copy">
                  <h2 id="report-modal-title" className="panel-title">
                    {copy.report}
                  </h2>
                  <p className="viewer-text">{copy.reportHint}</p>
                </div>

                <label className="field" htmlFor="report-reason-modal">
                  <span className="field-label">{copy.reportReason}</span>
                  <select
                    id="report-reason-modal"
                    className="input"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.currentTarget.value as typeof reportReason)}
                    disabled={isReporting}
                  >
                    {reportReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="report-details-modal">
                  <span className="field-label">{copy.reportDetails}</span>
                  <textarea
                    id="report-details-modal"
                    className="textarea clip-comment-report-textarea"
                    rows={3}
                    maxLength={COMMENT_REPORT_MAX_DETAILS_LENGTH}
                    placeholder={copy.reportDetailsPlaceholder}
                    value={reportDetails}
                    disabled={isReporting}
                    onChange={(event) => setReportDetails(event.currentTarget.value)}
                  />
                </label>

                <div className="button-row confirm-modal-actions">
                  <button
                    type="button"
                    className="button-primary"
                    disabled={isReporting}
                    onClick={() => handleReportSubmit(reportingCommentId)}
                  >
                    {isReporting ? copy.sendingReport : copy.sendReport}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
