import type { Metadata } from "next";
import Link from "next/link";
import { getAppTitle } from "@/lib/app-config";
import SearchFiltersBar from "@/components/SearchFiltersBar";
import HighlightedText from "@/components/HighlightedText";
import { formatMessage, getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { searchContent } from "@/lib/search";
import { findVisibleMusicals } from "@/lib/musicals";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getCurrentLanguage();
  const appTitle = getAppTitle(language);

  return {
    title: language === "he" ? `חיפוש | ${appTitle}` : `Search | ${appTitle}`,
    description:
      language === "he"
        ? `חיפוש פריטים, קטעים ותוכן ב-${appTitle}.`
        : `Search items, clips, and content in ${appTitle}.`,
  };
}

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: "all" | "musicals" | "clips";
    year?: string;
  }>;
};

export default async function SearchPage(props: SearchPageProps) {
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const searchParams = await props.searchParams;
  const rawQuery = searchParams?.q ?? "";
  const type = searchParams?.type ?? "all";
  const year = searchParams?.year ?? "";
  const results = await searchContent(rawQuery, { type, year });
  const hasQuery = Boolean(results.query);
  const hasResults = results.musicals.length > 0 || results.clips.length > 0;
  const totalResults = results.musicals.length + results.clips.length;
  const recent = hasQuery
    ? []
    : await findVisibleMusicals({
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          year: true,
          imagePath: true,
          posterDisplayMode: true,
          posterAspect: true,
          thumbnailUrl: true,
          emoji: true,
        },
      });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="search-page-hero">
            <div>
              <h1 className="viewer-title" style={{ marginBottom: 10 }}>
                {t.search.pageTitle}
              </h1>
              <p className="viewer-text" style={{ marginBottom: 0 }}>
                {t.search.pageText}
              </p>
            </div>

            <SearchFiltersBar
              initialQuery={rawQuery}
              initialType={type}
              initialYear={year}
              language={language}
            />
          </div>

          {!hasQuery ? (
            <section className="search-results-section search-recent">
              <div className="search-results-heading">
                <h2 className="panel-title" style={{ marginBottom: 0 }}>
                  {language === "he" ? "הוספו לאחרונה" : "Recently added"}
                </h2>
              </div>
              <div className="search-list">
                {recent.map((musical) => {
                  const picture = musical.imagePath || musical.thumbnailUrl;

                  return (
                    <Link
                      key={musical.id}
                      href={`/library/${musical.slug}`}
                      className={`search-row ${picture ? "" : "no-art"}`}
                    >
                      {picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={picture} alt="" className="search-row-image" />
                      ) : null}
                      <div className="search-row-body">
                        <div className="search-row-title" dir="auto">
                          {musical.title}
                        </div>
                        <div className="search-row-meta">
                          <span className="search-result-type">{t.search.musicalType}</span>
                          {musical.year ? <span>{musical.year}</span> : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : !hasResults ? (
            <div className="link-card search-empty-state">
              <div className="show-name">{formatMessage(t.search.noResultsFor, { query: rawQuery })}</div>
              <div className="show-meta">{t.search.tryDifferent}</div>
            </div>
          ) : (
            <div className="search-results-shell">
              <div className="search-results-summary">
                {formatMessage(t.search.resultsSummary, { count: totalResults })}
                {type !== "all"
                  ? ` ${type === "musicals" ? t.search.resultsSummaryTypeMusicals : t.search.resultsSummaryTypeClips}`
                  : ""}
                {results.year ? ` ${formatMessage(t.search.resultsSummaryYear, { year: results.year })}` : ""}
              </div>

              <div className="search-list">
                {results.musicals.map((musical) => {
                  const picture = musical.imagePath || musical.thumbnailUrl;

                  return (
                    <Link
                      key={`item-${musical.id}`}
                      href={`/library/${musical.slug}`}
                      className={`search-row ${picture ? "" : "no-art"}`}
                    >
                      {picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={picture} alt="" className="search-row-image" />
                      ) : null}
                      <div className="search-row-body">
                        <div className="search-row-title" dir="auto">
                          <HighlightedText text={musical.title} query={results.query} />
                        </div>
                        <div className="search-row-meta">
                          <span className="search-result-type">{t.search.musicalType}</span>
                          {musical.year ? <span>{musical.year}</span> : null}
                        </div>
                        {musical.descriptionText ? (
                          <p className="search-row-snippet" dir="auto">
                            <HighlightedText text={musical.descriptionText} query={results.query} />
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}

                {results.clips.map((clip) => (
                  <Link
                    key={`clip-${clip.id}`}
                    href={`/library/${clip.musical.slug}#clip-${clip.id}`}
                    className="search-row is-clip"
                  >
                    <div className="search-row-kind">{t.search.clipType}</div>
                    <div className="search-row-body">
                      <div className="search-row-line">
                        <span className="search-row-title" dir="auto">
                          <HighlightedText text={clip.title} query={results.query} />
                        </span>
                        <span className="search-row-parent" dir="auto">
                          {clip.musical.title}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
