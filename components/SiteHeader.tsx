import Link from "next/link";
import { getAccountUrl, getAppMode, getHomeUrl, getMusicalsUrl, isAccountMode } from "@/lib/app-mode";
import { getAppTitle } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentTheme } from "@/lib/theme-server";
import AppsMenu from "@/components/AppsMenu";
import BatzalAccountMenu from "@/components/BatzalAccountMenu";
import BatzalLogo from "@/components/BatzalLogo";
import HeaderSearch from "@/components/HeaderSearch";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { getPermissionFlags, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { type AppLanguage, getTranslations } from "@/lib/i18n";

export default async function SiteHeader({
  language,
}: {
  language: AppLanguage;
}) {
  const user = await getCurrentUser();
  const theme = await getCurrentTheme();
  const t = getTranslations(language);
  const showPanel = user ? await hasPermission(user, PERMISSIONS.panelView) : false;
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
  }

  return (
    <header className="site-header bz-bar">
      <div className="site-header-inner">
        <div className="site-header-section site-header-brand">
          <a href={getHomeUrl()} className="bz-brand" aria-label={t.header.homeAria}>
            <BatzalLogo />
            <span>Batzal</span>
          </a>
          <span className="bz-sep" aria-hidden="true" />
          <Link href="/" className="bz-app">{getAppTitle(language)}</Link>
        </div>

        {accountSite || getAppMode() !== "musicals" ? (
          <div className="site-header-section site-header-search" />
        ) : (
          <HeaderSearch language={language} />
        )}

        <div className="site-header-section site-header-actions">
          <AppsMenu language={language} showPanel={showPanel} />
          <BatzalAccountMenu
            user={
              user
                ? {
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatarUrl && user.avatarUrl.startsWith("/") && !accountSite ? `${accountUrl}${user.avatarUrl}` : user.avatarUrl,
                    avatarVersion: user.avatarVersion,
                    role: user.role,
                  }
                : null
            }
            theme={theme}
            language={language}
            accountUrl={accountUrl}
            signInHref={accountSite ? "/auth/google/start" : "/auth/account/start"}
            extras={extras}
          />
        </div>
      </div>
    </header>
  );
}
