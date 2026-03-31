import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import HeaderSearch from "@/components/HeaderSearch";
import UserMenu from "@/components/UserMenu";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import {
  canAccessAdminArea,
  canRequestEditorAccess,
  getPermissionFlags,
  PERMISSIONS,
} from "@/lib/permissions";
import { type AppLanguage, getTranslations } from "@/lib/i18n";

export default async function SiteHeader({
  language,
}: {
  language: AppLanguage;
}) {
  const user = await getCurrentUser();
  const t = getTranslations(language);
  const permissionFlags = await getPermissionFlags(user, [
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
    PERMISSIONS.roleManage,
    PERMISSIONS.editorRequestReview,
  ] as const);
  const canAccessAnyAdminArea = await canAccessAdminArea(user);
  const canAccessCommentReports =
    permissionFlags.user_view || permissionFlags.user_manage;
  const commentReportSummary = canAccessCommentReports
    ? await getCommentReportSummary()
    : null;
  const adminHref =
    permissionFlags.user_view ||
    permissionFlags.user_manage ||
    permissionFlags.editor_request_review
      ? "/admin"
      : "/admin/permissions";

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-header-section site-header-brand">
          <Link href="/" className="site-brand" aria-label={t.header.homeAria}>
            <span className="site-brand-icon" aria-hidden="true">
              <span className="site-brand-monogram">BM</span>
            </span>
            <span className="site-brand-text">{t.header.brand}</span>
          </Link>
        </div>

        <HeaderSearch language={language} />

        <div className="site-header-section site-header-actions">
          <UserMenu
            user={
              user
                ? {
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    avatarVersion: user.avatarVersion,
                    status: user.status,
                    role: user.role,
                    canAccessAdminArea: canAccessAnyAdminArea,
                    canAccessCommentReports,
                    openCommentReportsCount: commentReportSummary?.open ?? 0,
                    canRequestEditorAccess: canRequestEditorAccess(user),
                    adminHref,
                    language: user.language,
                  }
                : null
            }
            language={language}
          />
        </div>
      </div>
    </header>
  );
}
