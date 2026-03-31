"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import HighlightedText from "@/components/HighlightedText";
import { formatMessage, getTranslations, type AppLanguage } from "@/lib/i18n";
import type { SearchClipResult, SearchContentResult, SearchMusicalResult } from "@/lib/search";

type ActiveResult =
  | { type: "musical"; index: number }
  | { type: "clip"; index: number }
  | null;

const DEBOUNCE_MS = 300;

function flattenResults(results: SearchContentResult): ActiveResult[] {
  return [
    ...results.musicals.map((_, index) => ({ type: "musical" as const, index })),
    ...results.clips.map((_, index) => ({ type: "clip" as const, index })),
  ];
}

function getResultHref(result: ActiveResult, payload: SearchContentResult) {
  if (!result) {
    return null;
  }

  if (result.type === "musical") {
    return `/musicals/${payload.musicals[result.index]?.slug ?? ""}`;
  }

  const clip = payload.clips[result.index];
  return clip ? `/musicals/${clip.musical.slug}#clip-${clip.id}` : null;
}

function getResultKey(result: ActiveResult) {
  if (!result) {
    return "none";
  }

  return `${result.type}-${result.index}`;
}

function MusicalSearchRow({
  musical,
  query,
  active,
  language,
}: {
  musical: SearchMusicalResult;
  query: string;
  active: boolean;
  language: AppLanguage;
}) {
  return (
    <Link
      href={`/musicals/${musical.slug}`}
      className={`header-search-result ${active ? "is-active" : ""}`}
    >
      <div className="header-search-result-artwork">
        {musical.imagePath || musical.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={musical.imagePath || musical.thumbnailUrl || ""}
            alt={musical.title}
            className="header-search-result-image"
          />
        ) : (
          <div className="header-search-result-fallback" aria-hidden="true">
            {musical.title.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="header-search-result-body">
        <div className="header-search-result-title" dir="auto">
          <HighlightedText text={musical.title} query={query} />
        </div>
        <div className="header-search-result-meta" dir="auto">
          {musical.year ? `${musical.year} • ` : null}
          <HighlightedText text={musical.snippet} query={query} />
        </div>
      </div>
    </Link>
  );
}

function ClipSearchRow({
  clip,
  query,
  active,
  language,
}: {
  clip: SearchClipResult;
  query: string;
  active: boolean;
  language: AppLanguage;
}) {
  const t = getTranslations(language);

  return (
    <Link
      href={`/musicals/${clip.musical.slug}#clip-${clip.id}`}
      className={`header-search-result ${active ? "is-active" : ""}`}
    >
      <div className="header-search-result-artwork header-search-result-artwork-clip">
        <span className="header-search-chip">{t.header.clipChip}</span>
      </div>
      <div className="header-search-result-body">
        <div className="header-search-result-title" dir="auto">
          <HighlightedText text={clip.title} query={query} />
        </div>
        <div className="header-search-result-parent" dir="auto">
          {t.header.clipFrom} <HighlightedText text={clip.musical.title} query={query} />
        </div>
        <div className="header-search-result-meta" dir="auto">
          <HighlightedText text={clip.snippet} query={query} />
        </div>
      </div>
    </Link>
  );
}

export default function HeaderSearch({ language }: { language: AppLanguage }) {
  const t = getTranslations(language);
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchContentResult>({
    query: "",
    type: "all",
    year: null,
    musicals: [],
    clips: [],
  });
  const [activeResult, setActiveResult] = useState<ActiveResult>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const trimmedQuery = deferredQuery.trim();
  const flattenedResults = useMemo(() => flattenResults(results), [results]);

  useEffect(() => {
    setQuery("");
    setIsOpen(false);
    setActiveResult(null);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveResult(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults({
        query: "",
        type: "all",
        year: null,
        musicals: [],
        clips: [],
      });
      setIsLoading(false);
      setActiveResult(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const payload = (await response.json()) as SearchContentResult;
        setResults(payload);
        setIsOpen(true);
        setActiveResult(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("[header-search] request failed", {
          reason: error instanceof Error ? error.message : "unknown-error",
        });
        setResults({
          query: trimmedQuery,
          type: "all",
          year: null,
          musicals: [],
          clips: [],
        });
        setIsOpen(true);
        setActiveResult(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const activeHref = getResultHref(activeResult, results);

    if (activeHref) {
      router.push(activeHref);
      return;
    }

    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  }

  return (
    <div ref={rootRef} className="site-header-section site-header-search">
      <form className="header-search-shell" onSubmit={handleSubmit} role="search">
        <div className={`header-search-input-wrap ${isOpen ? "is-open" : ""}`}>
          <span className="header-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.25 4.25" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (query.trim()) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (!isOpen || flattenedResults.length === 0) {
                if (event.key === "Escape") {
                  setIsOpen(false);
                  setActiveResult(null);
                }
                return;
              }

              const currentIndex = flattenedResults.findIndex(
                (result) => getResultKey(result) === getResultKey(activeResult),
              );

              if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % flattenedResults.length;
                setActiveResult(flattenedResults[nextIndex]);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                const nextIndex =
                  currentIndex <= 0 ? flattenedResults.length - 1 : currentIndex - 1;
                setActiveResult(flattenedResults[nextIndex]);
              }

              if (event.key === "Escape") {
                setIsOpen(false);
                setActiveResult(null);
              }
            }}
            className="input header-search-input"
            placeholder={t.header.searchPlaceholder}
            aria-label={t.header.searchAria}
            dir={language === "he" ? "rtl" : "ltr"}
          />
          {isLoading ? <span className="header-search-status">{t.header.searching}</span> : null}
        </div>

        {isOpen && trimmedQuery ? (
          <div className="header-search-dropdown">
            <div className="header-search-dropdown-head">
              <span>{formatMessage(t.header.resultsFor, { query: trimmedQuery })}</span>
              <Link href={`/search?q=${encodeURIComponent(trimmedQuery)}`} className="header-search-all-link">
                {t.header.allResults}
              </Link>
            </div>

            {results.musicals.length === 0 && results.clips.length === 0 && !isLoading ? (
              <div className="header-search-empty">{t.common.noResults}</div>
            ) : (
              <div className="header-search-groups">
                {results.musicals.length > 0 ? (
                  <section className="header-search-group">
                    <div className="header-search-group-title">{t.header.musicals}</div>
                    <div className="header-search-group-list">
                      {results.musicals.map((musical, index) => (
                        <MusicalSearchRow
                          key={musical.id}
                          musical={musical}
                          query={results.query}
                          active={
                            activeResult?.type === "musical" && activeResult.index === index
                          }
                          language={language}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {results.clips.length > 0 ? (
                  <section className="header-search-group">
                    <div className="header-search-group-title">{t.header.clips}</div>
                    <div className="header-search-group-list">
                      {results.clips.map((clip, index) => (
                        <ClipSearchRow
                          key={clip.id}
                          clip={clip}
                          query={results.query}
                          active={activeResult?.type === "clip" && activeResult.index === index}
                          language={language}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}
