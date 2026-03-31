import type { Metadata } from "next";
import Link from "next/link";
import { findVisibleMusicals } from "@/lib/musicals";
import MusicalArtwork from "@/components/MusicalArtwork";
import { getMusicalDescriptionText } from "@/lib/musical-description";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { canManageMusicalContent } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "כל המחזות | Batzal's Musicals",
  description: "דפדוף בכל המחזות הזמינים ב-Batzal's Musicals.",
};

function getMusicalsPageCopy(language: "he" | "en") {
  if (language === "en") {
      return {
        title: "All Musicals",
        text: "Browse every musical currently available in the app and open each musical page from here.",
        empty: "There are no musicals to show yet.",
        noDescription: "There is no description for this musical yet.",
        addMusical: "Add Musical",
        editOrder: "Edit Order",
      };
  }

  return {
    title: "כל המחזות",
    text: "כאן אפשר לראות את כל המחזות הזמינים במערכת ולעבור לעמוד של כל מחזה.",
    empty: "אין עדיין מחזות להצגה",
    noDescription: "אין עדיין תיאור למחזה הזה",
    addMusical: "הוסף מחזה",
    editOrder: "עריכת סדר",
  };
}

export default async function MusicalsPage() {
  const currentUser = await getCurrentUser();
  const language = await getCurrentLanguage();
  const copy = getMusicalsPageCopy(language);
  const canManage = await canManageMusicalContent(currentUser);
  const musicals = await findVisibleMusicals({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      year: true,
      emoji: true,
      imagePath: true,
      posterDisplayMode: true,
      posterAspect: true,
      thumbnailUrl: true,
    },
  });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <h1 className="viewer-title">{copy.title}</h1>
          <p className="viewer-text">{copy.text}</p>
          {canManage ? (
            <div className="button-row" style={{ marginTop: 12 }}>
              <Link href="/admin/musicals/new" className="button-primary">
                {copy.addMusical}
              </Link>
              <Link href="/admin/musicals/order" className="button-secondary">
                {copy.editOrder}
              </Link>
            </div>
          ) : null}

          {musicals.length === 0 ? (
            <div
              className="link-card"
              style={{
                marginTop: 24,
                minHeight: 260,
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
                {copy.empty}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 18,
                marginTop: 24,
              }}
            >
              {musicals.map((musical) => {
                const descriptionText = getMusicalDescriptionText(musical.description);

                return (
                  <Link
                    key={musical.id}
                    href={`/musicals/${musical.slug}`}
                    className="show-card musicals-grid-card"
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
                          {descriptionText || copy.noDescription}
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
