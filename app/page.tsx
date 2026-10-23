import type { Metadata } from "next";
import Link from "next/link";
import { getAppTitle } from "@/lib/app-config";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findVisibleMusicals } from "@/lib/musicals";
import { canManageMusicalContent } from "@/lib/permissions";
import { getCategoryName } from "@/lib/library-categories";
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
        ? `ספריית הפריטים של ${appTitle} עם חיפוש, קטעים, חשבונות וניהול תוכן.`
        : `${appTitle} - an item library with clips, accounts, search, and content management.`,
  };
}

export default async function HomePage() {
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const currentUser = await getCurrentUser();
  const canSeeUnpublished = currentUser ? await canManageMusicalContent(currentUser) : false;
  const popularClips = await db.clip.findMany({
    where: canSeeUnpublished ? undefined : { musical: { isPublished: true } },
    orderBy: [{ comments: { _count: "desc" } }, { createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      title: true,
      musical: { select: { slug: true, title: true } },
      _count: { select: { comments: { where: { status: "visible" } } } },
    },
  });

  const musicals = await findVisibleMusicals({
    take: 4,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: true,
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
              <Link className="button-secondary" href="/library">
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
                      href={`/library/${musical.slug}`}
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
                        <span className="musical-card-year">
                          {[musical.category ? getCategoryName(musical.category, language) : null, musical.year]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
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
            <h2 className="panel-title">{language === "he" ? "הקטעים הכי מדוברים" : "Most discussed clips"}</h2>

            <div className="home-quick-nav-list">
              {popularClips.length === 0 ? (
                <p className="viewer-text">{language === "he" ? "עוד אין קטעים להצגה." : "No clips to show yet."}</p>
              ) : (
                popularClips.map((clip) => (
                  <Link
                    key={clip.id}
                    className="home-quick-link"
                    href={`/library/${clip.musical.slug}#clip-${clip.id}`}
                  >
                    <span className="home-quick-link-title">{clip.title}</span>
                    <span className="home-quick-link-text">
                      {clip.musical.title}
                      {clip._count.comments > 0
                        ? ` · ${clip._count.comments} ${language === "he" ? "תגובות" : "comments"}`
                        : ""}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
