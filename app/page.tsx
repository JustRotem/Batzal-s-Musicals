import type { Metadata } from "next";
import Link from "next/link";
import { getAppTitle } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/auth";
import { findVisibleMusicals } from "@/lib/musicals";
import {
  canAccessAdminArea,
  canRequestEditorAccess,
  getPermissionFlags,
  PERMISSIONS,
} from "@/lib/permissions";
import MusicalArtwork from "@/components/MusicalArtwork";
import { formatMessage, getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getMusicalDescriptionText } from "@/lib/musical-description";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getCurrentLanguage();
  const appTitle = getAppTitle(language);

  return {
    title: appTitle,
    description:
      language === "he"
        ? `ספריית המחזות של ${appTitle} עם חיפוש, קליפים, חשבונות וניהול תוכן.`
        : `${appTitle} - a musical library with clips, accounts, search, and content management.`,
  };
}

export default async function HomePage() {
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const currentUser = await getCurrentUser();
  const permissionFlags = await getPermissionFlags(currentUser, [
    PERMISSIONS.musicalCreate,
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
    PERMISSIONS.roleManage,
    PERMISSIONS.editorRequestReview,
  ] as const);
  const canAccessAnyAdminArea = await canAccessAdminArea(currentUser);
  const adminHref =
    permissionFlags.user_view ||
    permissionFlags.user_manage ||
    permissionFlags.editor_request_review
      ? "/admin"
      : "/admin/permissions";
  const adminLinkTitle =
    permissionFlags.user_view || permissionFlags.user_manage || permissionFlags.editor_request_review
      ? t.home.adminAccountsTitle
      : t.home.adminPermissionsTitle;
  const adminLinkText =
    permissionFlags.user_view || permissionFlags.user_manage || permissionFlags.editor_request_review
      ? t.home.adminAccountsText
      : t.home.adminPermissionsText;

  const musicals = await findVisibleMusicals({
    take: 4,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      clips: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return (
    <main className="page-shell home-page-shell">
      <div className="orb one" />

      <div className="container">
        <section className="card">
          <div className="hero-grid">
            <div className="hero-icon">🎶</div>

            <div>
              <h1 className="hero-title">{getAppTitle(language)}</h1>
              <p className="hero-text">{t.home.heroText}</p>
            </div>
          </div>
        </section>

        <section className="section-grid">
          <div className="card home-musicals-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <h2 className="panel-title" style={{ marginBottom: 0 }}>
                {t.home.musicalsTitle}
              </h2>
              <Link className="button-secondary" href="/musicals">
                {t.home.allMusicals}
              </Link>
            </div>

            <div className="list">
              {musicals.length === 0 ? (
                <div
                  className="link-card"
                  style={{
                    minHeight: 220,
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                  }}
                >
                  <span
                    className="show-name"
                    style={{
                      fontSize: 28,
                      color: "var(--muted)",
                      fontWeight: 700,
                    }}
                  >
                    {t.home.noMusicals}
                  </span>
                </div>
              ) : (
                musicals.map((musical) => {
                  const descriptionText = getMusicalDescriptionText(musical.description);

                  return (
                    <Link
                      key={musical.id}
                      className="show-card musicals-grid-card"
                      href={`/musicals/${musical.slug}`}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="musical-card-artwork">
                        <MusicalArtwork
                          imagePath={musical.imagePath}
                          posterDisplayMode={musical.posterDisplayMode}
                          posterAspect={musical.posterAspect}
                          title={musical.title}
                          thumbnailUrl={musical.thumbnailUrl}
                          emoji={musical.emoji}
                        />
                      </div>
                      <div className="musical-card-body">
                        <span className="musical-card-title">{musical.title}</span>
                        {musical.year ? (
                          <span className="musical-card-year">{musical.year}</span>
                        ) : null}
                        <span className="musical-card-description-wrap">
                          <span
                            className={`musical-card-description ${
                              descriptionText ? "" : "is-placeholder"
                            }`}
                            dir={descriptionText ? "auto" : undefined}
                          >
                            {descriptionText || t.home.noDescription}
                          </span>
                        </span>
                        <span className="musical-card-footer">
                          {formatMessage(t.home.clipsCount, { count: musical.clips.length })}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <p className="footer-note">
              {t.home.summary}
            </p>
          </div>

          <div className="card home-quick-nav-panel">
            <h2 className="panel-title">{t.home.quickNav}</h2>

            <div className="home-quick-nav-list">
              {!currentUser ? (
                <>
                  <Link className="home-quick-link" href="/auth/login">
                    <span className="home-quick-link-title">{t.home.quickLoginTitle}</span>
                    <span className="home-quick-link-text">{t.home.quickLoginText}</span>
                  </Link>

                  <Link className="home-quick-link" href="/auth/request-account">
                    <span className="home-quick-link-title">{t.home.quickSignupTitle}</span>
                    <span className="home-quick-link-text">{t.home.quickSignupText}</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link className="home-quick-link" href="/profile">
                    <span className="home-quick-link-title">{t.home.quickAccountTitle}</span>
                    <span className="home-quick-link-text">{t.home.quickAccountText}</span>
                  </Link>

                  {canRequestEditorAccess(currentUser) ? (
                    <Link className="home-quick-link" href="/profile#account-access-summary">
                      <span className="home-quick-link-title">{t.home.quickEditorTitle}</span>
                      <span className="home-quick-link-text">{t.home.quickEditorText}</span>
                    </Link>
                  ) : null}

                  {permissionFlags.musical_create ? (
                    <Link className="home-quick-link" href="/admin/musicals/new">
                      <span className="home-quick-link-title">{t.home.quickCreateMusicalTitle}</span>
                      <span className="home-quick-link-text">{t.home.quickCreateMusicalText}</span>
                    </Link>
                  ) : null}

                  {canAccessAnyAdminArea ? (
                    <Link className="home-quick-link" href={adminHref}>
                      <span className="home-quick-link-title">{adminLinkTitle}</span>
                      <span className="home-quick-link-text">{adminLinkText}</span>
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
