import Link from "next/link";
import { getAppTitle } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/auth";
import AppsMenu from "@/components/AppsMenu";
import BatzalLogo from "@/components/BatzalLogo";
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
    <header className="site-header bz-bar" data-theme="dark">
      <div className="site-header-inner">
        <div className="site-header-section site-header-brand">
          <Link href="/" className="bz-brand" aria-label={t.header.homeAria}>
            <BatzalLogo />
            <span>Batzal</span>
          </Link>
          <span className="bz-sep" aria-hidden="true" />
          <span className="bz-app">{getAppTitle(language)}</span>
        </div>

        <HeaderSearch language={language} />

        <div className="site-header-section site-header-actions">
          <AppsMenu language={language} />
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
