import Link from "next/link";
import { type AppLanguage, getTranslations } from "@/lib/i18n";

type AdminSection = "accounts" | "comments" | "permissions";

type AdminManagementNavProps = {
  language: AppLanguage;
  active: AdminSection;
  showAccounts?: boolean;
  showComments?: boolean;
  showPermissions?: boolean;
  openCommentReports?: number;
};

export default function AdminManagementNav({
  language,
  active,
  showAccounts = true,
  showComments = true,
  showPermissions = true,
  openCommentReports = 0,
}: AdminManagementNavProps) {
  const t = getTranslations(language);

  return (
    <nav className="account-section-nav admin-section-nav-shell" aria-label={t.admin.navAria}>
      {showAccounts ? (
        <Link
          href="/admin"
          className={`account-section-tab ${active === "accounts" ? "is-active" : ""}`}
          aria-current={active === "accounts" ? "page" : undefined}
        >
          {t.admin.accounts}
        </Link>
      ) : null}

      {showComments ? (
        <Link
          href="/admin/comments"
          className={`account-section-tab ${active === "comments" ? "is-active" : ""}`}
          aria-current={active === "comments" ? "page" : undefined}
        >
          <span>{t.admin.commentReports}</span>
          {openCommentReports > 0 ? (
            <span className="admin-report-count-badge">{openCommentReports}</span>
          ) : null}
        </Link>
      ) : null}

      {showPermissions ? (
        <Link
          href="/admin/permissions"
          className={`account-section-tab ${active === "permissions" ? "is-active" : ""}`}
          aria-current={active === "permissions" ? "page" : undefined}
        >
          {t.admin.permissions}
        </Link>
      ) : null}
    </nav>
  );
}
