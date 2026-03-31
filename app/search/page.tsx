import type { Metadata } from "next";
import Link from "next/link";
import SearchFiltersBar from "@/components/SearchFiltersBar";
import HighlightedText from "@/components/HighlightedText";
import MusicalArtwork from "@/components/MusicalArtwork";
import { formatMessage, getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { searchContent } from "@/lib/search";

export const metadata: Metadata = {
  title: "חיפוש | Batzal's Musicals",
  description: "חיפוש מחזות, קטעים ותוכן ב-Batzal's Musicals.",
};

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: "all" | "musicals" | "clips";
    year?: string;
  }>;
};

function getClipSourceLabel(sourceType: "youtube" | "upload", uploadLabel: string) {
  return sourceType === "youtube" ? "YouTube" : uploadLabel;
}

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
            <div className="link-card search-empty-state">
              <div className="show-name">{t.search.startTitle}</div>
              <div className="show-meta">{t.search.startText}</div>
            </div>
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

              <section className="search-results-section">
                <div className="search-results-heading">
                  <h2 className="panel-title" style={{ marginBottom: 0 }}>
                    {t.search.musicals}
                  </h2>
                  <span className="admin-role-permission-count">{results.musicals.length}</span>
                </div>

                {results.musicals.length === 0 ? (
                  <div className="link-card search-section-empty">
                    {t.search.noMusicalMatches}
                  </div>
                ) : (
                  <div className="list">
                    {results.musicals.map((musical) => (
                      <Link
                        key={musical.id}
                        href={`/musicals/${musical.slug}`}
                        className="show-card search-result-card"
                      >
                        <div className="search-result-artwork">
                          <MusicalArtwork
                            imagePath={musical.imagePath}
                            posterDisplayMode={musical.posterDisplayMode}
                            posterAspect={musical.posterAspect}
                            title={musical.title}
                            thumbnailUrl={musical.thumbnailUrl}
                            emoji={musical.emoji}
                          />
                          </div>
                        <div className="search-result-body">
                          <div className="search-result-meta">
                            <span className="search-result-type">{t.search.musicalType}</span>
                            {musical.year ? (
                              <span className="show-meta">{musical.year}</span>
                            ) : null}
                          </div>
                          <div className="show-name" dir="auto">
                            <HighlightedText text={musical.title} query={results.query} />
                          </div>
                          <p className="search-result-snippet" dir="auto">
                            <HighlightedText text={musical.snippet} query={results.query} />
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="search-results-section">
                <div className="search-results-heading">
                  <h2 className="panel-title" style={{ marginBottom: 0 }}>
                    {t.search.clips}
                  </h2>
                  <span className="admin-role-permission-count">{results.clips.length}</span>
                </div>

                {results.clips.length === 0 ? (
                  <div className="link-card search-section-empty">
                    {t.search.noClipMatches}
                  </div>
                ) : (
                  <div className="list">
                    {results.clips.map((clip) => (
                      <Link
                        key={clip.id}
                        href={`/musicals/${clip.musical.slug}#clip-${clip.id}`}
                        className="show-card search-result-card"
                      >
                        <div className="search-result-body">
                          <div className="search-result-meta">
                            <span className="search-result-type clip">{t.search.clipType}</span>
                            <span className="show-meta">
                              {getClipSourceLabel(clip.sourceType, t.search.sourceUpload)}
                            </span>
                          </div>
                          <div className="show-name" dir="auto">
                            <HighlightedText text={clip.title} query={results.query} />
                          </div>
                          <div className="search-result-parent" dir="auto">
                            {t.search.from}{" "}
                            <HighlightedText text={clip.musical.title} query={results.query} />
                            {clip.musical.year ? ` • ${clip.musical.year}` : ""}
                          </div>
                          <p className="search-result-snippet" dir="auto">
                            <HighlightedText text={clip.snippet} query={results.query} />
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
