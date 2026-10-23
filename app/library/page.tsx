import type { Metadata } from "next";
import Link from "next/link";
import { getAppTitle } from "@/lib/app-config";
import { findVisibleMusicals } from "@/lib/musicals";
import MusicalArtwork from "@/components/MusicalArtwork";
import { getMusicalDescriptionText } from "@/lib/musical-description";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { canManageMusicalContent } from "@/lib/permissions";
import { getCategoryFieldLabels, getCategoryLabel, getCategoryName, listCategories } from "@/lib/library-categories";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getCurrentLanguage();
  const appTitle = getAppTitle(language);

  return {
    title:
      language === "he"
        ? `כל הספרייה | ${appTitle}`
        : `The library | ${appTitle}`,
    description:
      language === "he"
        ? `דפדוף בכל הפריטים הזמינים ב-${appTitle}.`
        : `Browse all items available in ${appTitle}.`,
  };
}

function getMusicalsPageCopy(language: "he" | "en") {
  if (language === "en") {
      return {
        title: "The library",
        text: "Everything in the library: items, the group, and whatever we add next.",
        empty: "There are no items to show yet.",
        noDescription: "There is no description for this item yet.",
        addMusical: "Add item",
        editOrder: "Edit Order",
      };
  }

  return {
    title: "כל הספרייה",
    text: "כל מה שיש בספרייה: מחזות זמר, הקבוצה, וכל מה שנוסיף בהמשך.",
    empty: "אין עדיין פריטים להצגה",
    noDescription: "אין עדיין תיאור לפריט הזה",
    addMusical: "הוסף פריט",
    editOrder: "עריכת סדר",
  };
}

export default async function MusicalsPage(props: { searchParams?: Promise<{ category?: string }> }) {
  const searchParams = await props.searchParams;
  const currentUser = await getCurrentUser();
  const language = await getCurrentLanguage();
  const copy = getMusicalsPageCopy(language);
  const canManage = await canManageMusicalContent(currentUser);
  const fieldLabels = getCategoryFieldLabels(language);
  const allItems = await findVisibleMusicals({
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
      categoryId: true,
    },
  });
  const categories = await listCategories();
  const presentCategories = categories.filter((category) => allItems.some((item) => item.categoryId === category.id));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const filter = categories.find((category) => category.slug === searchParams?.category) ?? null;
  const musicals = filter ? allItems.filter((item) => item.categoryId === filter.id) : allItems;

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
              <Link href="/admin/library/new" className="button-primary">
                {copy.addMusical}
              </Link>
              <Link href="/admin/library/order" className="button-secondary">
                {copy.editOrder}
              </Link>
              <Link href="/admin/categories" className="button-secondary">
                {fieldLabels.manage}
              </Link>
            </div>
          ) : null}

          {presentCategories.length > 1 ? (
            <nav className="library-type-filter" aria-label={fieldLabels.category}>
              <Link href="/library" className={`library-type-chip ${filter ? "" : "is-active"}`}>
                {fieldLabels.all}
              </Link>
              {presentCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/library?category=${category.slug}`}
                  className={`library-type-chip ${filter?.id === category.id ? "is-active" : ""}`}
                >
                  {getCategoryLabel(category, language)}
                </Link>
              ))}
            </nav>
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
              className="musicals-grid"
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
                    href={`/library/${musical.slug}`}
                    className={`show-card musicals-grid-card ${musical.posterAspect === "wide" ? "is-wide" : ""}`.trim()}
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      className={`musical-card-artwork ${
                        musical.posterAspect === "wide"
                          ? "is-wide"
                          : musical.posterAspect === "square"
                            ? "is-square"
                            : musical.posterAspect === "tall"
                              ? "is-tall"
                              : ""
                      }`.trim()}
                    >
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
                        {[
                          musical.categoryId && categoryById.get(musical.categoryId)
                            ? getCategoryName(categoryById.get(musical.categoryId)!, language)
                            : null,
                          musical.year,
                        ]
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
