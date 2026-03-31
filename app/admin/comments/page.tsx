import Link from "next/link";
import AdminActionButton from "@/components/AdminActionButton";
import AdminManagementNav from "@/components/AdminManagementNav";
import { requireAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { formatIsraeliDate } from "@/lib/date-format";
import { getTranslations } from "@/lib/i18n";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { CommentReportStatus } from "@/lib/prisma";
import {
  getCommentReportReasonLabel,
  getCommentReportStatusLabel,
} from "@/lib/comment-reports";
import {
  actionCommentReportByHidingComment,
  dismissCommentReportAction,
  markCommentReportReviewedAction,
  unhideModeratedCommentAction,
} from "../actions";

function getCommentVisibilityLabel(status: "visible" | "hidden", language: "he" | "en") {
  return status === "hidden"
    ? language === "he"
      ? "מוסתרת"
      : "Hidden"
    : language === "he"
      ? "גלויה"
      : "Visible";
}

function getCommentVisibilityClass(status: "visible" | "hidden") {
  return status === "hidden" ? "blocked" : "active";
}

export default async function AdminCommentReportsPage() {
  const currentAdmin = await requireAnyPermission([
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
  ]);
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const canManageReports = await hasPermission(currentAdmin, PERMISSIONS.userManage);
  const canManagePermissions = await hasPermission(currentAdmin, PERMISSIONS.roleManage);
  const summary = await getCommentReportSummary();

  const reports = await db.commentReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reporterUser: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          username: true,
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          status: true,
          hiddenAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          clip: {
            select: {
              id: true,
              title: true,
              musical: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const openReports = reports.filter((report) => report.status === CommentReportStatus.open);
  const handledReports = reports.filter((report) => report.status !== CommentReportStatus.open);
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{t.admin.commentReports}</span>
              <h1 className="viewer-title">{t.admin.reportsQueueTitle}</h1>
              <p className="viewer-text">{t.admin.reportsQueueText}</p>
            </div>
          </div>

          <AdminManagementNav
            language={language}
            active="comments"
            showPermissions={canManagePermissions}
            openCommentReports={summary.open}
          />

          <div className="admin-report-summary-grid">
            <div className="admin-report-summary-card">
              <strong>{t.admin.openReports}</strong>
              <span className="admin-report-summary-value">{summary.open}</span>
            </div>
            <div className="admin-report-summary-card">
              <strong>{t.admin.reviewedReports}</strong>
              <span className="admin-report-summary-value">{summary.reviewed}</span>
            </div>
            <div className="admin-report-summary-card">
              <strong>{t.admin.dismissedReports}</strong>
              <span className="admin-report-summary-value">{summary.dismissed}</span>
            </div>
            <div className="admin-report-summary-card">
              <strong>{t.admin.actionedReports}</strong>
              <span className="admin-report-summary-value">{summary.actioned}</span>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-heading">
              <h2 className="admin-section-title">{t.admin.openReportsTitle}</h2>
              <span className="admin-section-count">{openReports.length}</span>
            </div>
            <p className="admin-section-text">{t.admin.openReportsText}</p>

            {openReports.length === 0 ? (
              <div className="link-card admin-empty-state">{t.admin.noOpenReports}</div>
            ) : (
              <div className="admin-grid">
                {openReports.map((report) => (
                  <article key={report.id} className="admin-user-card admin-report-card">
                    <div className="admin-user-main">
                      <div className="admin-user-head">
                        <div className="admin-user-identity">
                          <strong dir="auto">{report.comment.user.username}</strong>
                          <span className="admin-email" dir="ltr">
                            {report.comment.user.email}
                          </span>
                          <span className="admin-user-created">
                            {language === "he" ? "דווח בתאריך:" : "Reported on:"}{" "}
                            {formatIsraeliDate(report.createdAt)}
                          </span>
                        </div>

                        <div className="admin-user-side">
                          <div className="admin-badge-row">
                            <span className={`admin-badge ${getCommentVisibilityClass(report.comment.status)}`}>
                              {language === "he" ? "תגובה " : "Comment "}
                              {getCommentVisibilityLabel(report.comment.status, language)}
                            </span>
                            <span className="admin-badge pending">
                              {getCommentReportStatusLabel(report.status, language)}
                            </span>
                          </div>

                          {canManageReports ? (
                            <div className="admin-actions admin-actions-compact admin-report-actions">
                              <form action={markCommentReportReviewedAction}>
                                <input type="hidden" name="reportId" value={report.id} />
                                <AdminActionButton
                                  className="button-secondary button-small"
                                  idleLabel={language === "he" ? "סמן כנסקר" : "Mark reviewed"}
                                  pendingLabel={language === "he" ? "מעדכן..." : "Updating..."}
                                />
                              </form>

                              <form action={dismissCommentReportAction}>
                                <input type="hidden" name="reportId" value={report.id} />
                                <AdminActionButton
                                  className="button-secondary button-small"
                                  idleLabel={language === "he" ? "דחה דיווח" : "Dismiss report"}
                                  pendingLabel={language === "he" ? "דוחה..." : "Dismissing..."}
                                  confirmTitle={language === "he" ? "דחיית דיווח" : "Dismiss report"}
                                  confirmMessage={
                                    language === "he"
                                      ? "התגובה תישאר כפי שהיא, והדיווח יסומן כנדחה."
                                      : "The comment will stay as-is and the report will be marked as dismissed."
                                  }
                                  confirmLabel={language === "he" ? "דחה דיווח" : "Dismiss report"}
                                />
                              </form>

                              <form action={actionCommentReportByHidingComment}>
                                <input type="hidden" name="reportId" value={report.id} />
                                <AdminActionButton
                                  className="button-danger button-small"
                                  idleLabel={language === "he" ? "הסתר תגובה" : "Hide comment"}
                                  pendingLabel={language === "he" ? "מסתיר..." : "Hiding..."}
                                  confirmTitle={language === "he" ? "הסתרת תגובה" : "Hide comment"}
                                  confirmMessage={
                                    language === "he"
                                      ? "התגובה תוסתר מהציבור וכל הדיווחים הפתוחים עליה יסומנו כטופלו."
                                      : "The comment will be hidden from the public and all open reports on it will be marked as actioned."
                                  }
                                  confirmLabel={language === "he" ? "הסתר תגובה" : "Hide comment"}
                                />
                              </form>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="admin-report-meta">
                        <span>
                          {language === "he" ? "קליפ:" : "Clip:"}{" "}
                          <Link href={`/musicals/${report.comment.clip.musical.slug}#clip-${report.comment.clip.id}`}>
                            {report.comment.clip.title}
                          </Link>
                        </span>
                        <span>
                          {language === "he" ? "מחזה:" : "Musical:"} {report.comment.clip.musical.title}
                        </span>
                        <span>
                          {language === "he" ? "סיבה:" : "Reason:"}{" "}
                          {getCommentReportReasonLabel(report.reason, language)}
                        </span>
                        <span dir="auto">
                          {language === "he" ? "דווח על ידי:" : "Reported by:"} {report.reporterUser.username}
                        </span>
                      </div>

                      <div className="admin-report-comment" dir="auto">
                        {report.comment.content}
                      </div>

                      {report.details ? (
                        <div className="admin-report-details">
                          <strong>{language === "he" ? "פירוט מהמדווח" : "Reporter details"}</strong>
                          <p dir="auto">{report.details}</p>
                        </div>
                      ) : (
                        <p className="admin-user-note muted">
                          {language === "he"
                            ? "לא צורף פירוט נוסף לדיווח הזה."
                            : "No extra details were added to this report."}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="admin-section">
            <div className="admin-section-heading">
              <h2 className="admin-section-title">{t.admin.handledReportsTitle}</h2>
              <span className="admin-section-count">{handledReports.length}</span>
            </div>
            <p className="admin-section-text">{t.admin.handledReportsText}</p>

            {handledReports.length === 0 ? (
              <div className="link-card admin-empty-state">{t.admin.noHandledReports}</div>
            ) : (
              <div className="admin-grid">
                {handledReports.map((report) => (
                  <article key={report.id} className="admin-user-card admin-report-card">
                    <div className="admin-user-main">
                      <div className="admin-user-head">
                        <div className="admin-user-identity">
                          <strong dir="auto">{report.comment.user.username}</strong>
                          <span className="admin-email" dir="ltr">
                            {report.comment.user.email}
                          </span>
                          <span className="admin-user-created">
                            {language === "he" ? "טופל בתאריך:" : "Handled on:"}{" "}
                            {formatIsraeliDate(report.reviewedAt ?? report.updatedAt)}
                          </span>
                        </div>

                        <div className="admin-user-side">
                          <div className="admin-badge-row">
                            <span className={`admin-badge ${getCommentVisibilityClass(report.comment.status)}`}>
                              {language === "he" ? "תגובה " : "Comment "}
                              {getCommentVisibilityLabel(report.comment.status, language)}
                            </span>
                            <span className={`admin-badge ${report.status === "dismissed" ? "blocked" : "active"}`}>
                              {getCommentReportStatusLabel(report.status, language)}
                            </span>
                          </div>

                          {canManageReports && report.comment.status === "hidden" ? (
                            <form action={unhideModeratedCommentAction}>
                              <input type="hidden" name="commentId" value={report.comment.id} />
                              <input type="hidden" name="musicalSlug" value={report.comment.clip.musical.slug} />
                              <AdminActionButton
                                className="button-secondary button-small"
                                idleLabel={language === "he" ? "הצג שוב" : "Unhide"}
                                pendingLabel={language === "he" ? "מחזיר..." : "Restoring..."}
                                confirmTitle={language === "he" ? "הצגת תגובה מחדש" : "Show comment again"}
                                confirmMessage={
                                  language === "he"
                                    ? "התגובה תחזור להופיע לציבור, אבל הדיווחים הקיימים יישארו בהיסטוריה."
                                    : "The comment will become visible to the public again, while the existing reports stay in history."
                                }
                                confirmLabel={language === "he" ? "הצג תגובה" : "Show comment"}
                              />
                            </form>
                          ) : null}
                        </div>
                      </div>

                      <div className="admin-report-meta">
                        <span>
                          {language === "he" ? "קליפ:" : "Clip:"}{" "}
                          <Link href={`/musicals/${report.comment.clip.musical.slug}#clip-${report.comment.clip.id}`}>
                            {report.comment.clip.title}
                          </Link>
                        </span>
                        <span>
                          {language === "he" ? "מחזה:" : "Musical:"} {report.comment.clip.musical.title}
                        </span>
                        <span>
                          {language === "he" ? "סיבה:" : "Reason:"}{" "}
                          {getCommentReportReasonLabel(report.reason, language)}
                        </span>
                        <span>
                          {language === "he" ? "נסקר על ידי:" : "Reviewed by:"}{" "}
                          {report.reviewedBy?.username ?? (language === "he" ? "לא זמין" : "Unavailable")}
                        </span>
                      </div>

                      <div className="admin-report-comment" dir="auto">
                        {report.comment.content}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
