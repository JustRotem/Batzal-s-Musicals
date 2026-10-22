import Link from "next/link";
import { getAccountUrl, isAccountMode } from "@/lib/app-mode";
import { getAppTitle } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/auth";
import AppsMenu from "@/components/AppsMenu";
import BatzalAccountMenu from "@/components/BatzalAccountMenu";
import BatzalLogo from "@/components/BatzalLogo";
import HeaderSearch from "@/components/HeaderSearch";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { canRequestEditorAccess, getPermissionFlags, PERMISSIONS } from "@/lib/permissions";
import { type AppLanguage, getTranslations } from "@/lib/i18n";

export default async function SiteHeader({
  language,
}: {
  language: AppLanguage;
}) {
  const user = await getCurrentUser();
  const t = getTranslations(language);
  const accountSite = isAccountMode();
  const accountUrl = getAccountUrl();

  // Entries that exist only on the musicals site.
  const extras: Array<{ href: string; label: string; badge?: number }> = [];

  if (user && !accountSite) {
    const flags = await getPermissionFlags(user, [PERMISSIONS.userView, PERMISSIONS.userManage] as const);

    if (flags.user_view || flags.user_manage) {
      const summary = await getCommentReportSummary();

      extras.push({
        href: "/admin/comments",
        label: t.admin.commentReports,
        badge: summary?.open ?? 0,
      });
    }

    if (canRequestEditorAccess(user)) {
      extras.push({
        href: `${accountUrl}/profile#account-access-summary`,
        label: t.header.requestEditorAccess,
      });
    } else if (user.role === "user" && user.status === "pending") {
      extras.push({
        href: `${accountUrl}/profile#account-access-summary`,
        label: t.header.editorRequestPending,
      });
    }
  }

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

        {accountSite ? (
          <div className="site-header-section site-header-search" />
        ) : (
          <HeaderSearch language={language} />
        )}

        <div className="site-header-section site-header-actions">
          <AppsMenu language={language} />
          <BatzalAccountMenu
            user={
              user
                ? {
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    avatarVersion: user.avatarVersion,
                    role: user.role,
                  }
                : null
            }
            language={language}
            accountUrl={accountUrl}
            signInHref={accountSite ? "/auth/login" : "/auth/account/start"}
            extras={extras}
          />
        </div>
      </div>
    </header>
  );
}
