"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type SearchFiltersBarProps = {
  initialQuery?: string;
  initialType?: "all" | "musicals" | "clips";
  initialYear?: string;
  language: AppLanguage;
};

function buildSearchUrl(pathname: string, values: { q: string; type: string; year: string }) {
  const searchParams = new URLSearchParams();

  if (values.q.trim()) {
    searchParams.set("q", values.q.trim());
  }

  if (values.type && values.type !== "all") {
    searchParams.set("type", values.type);
  }

  if (values.year.trim()) {
    searchParams.set("year", values.year.trim());
  }

  const suffix = searchParams.toString();
  return `${pathname}${suffix ? `?${suffix}` : ""}`;
}

export default function SearchFiltersBar({
  initialQuery = "",
  initialType = "all",
  initialYear = "",
  language,
}: SearchFiltersBarProps) {
  const t = getTranslations(language);
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<"all" | "musicals" | "clips">(initialType);
  const [year, setYear] = useState(initialYear);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
    setType(initialType);
    setYear(initialYear);
  }, [initialQuery, initialType, initialYear]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          buildSearchUrl(pathname || "/search", {
            q: query,
            type,
            year,
          }),
          { scroll: false },
        );
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pathname, query, router, type, year]);

  return (
    <form
      method="get"
      action="/search"
      className="search-filters-bar"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(
          buildSearchUrl(pathname || "/search", {
            q: query,
            type,
            year,
          }),
        );
      }}
    >
      <div className="search-box-input-wrap">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input search-box-input"
          placeholder={t.search.searchPlaceholder}
          aria-label={t.search.searchAria}
          dir="auto"
        />
      </div>

      <select
        name="type"
        className="input search-filter-select"
        value={type}
        onChange={(event) => setType(event.target.value as "all" | "musicals" | "clips")}
      >
        <option value="all">{language === "he" ? "הכול" : "All"}</option>
        <option value="musicals">{t.search.musicals}</option>
        <option value="clips">{t.search.clips}</option>
      </select>

      <input
        name="year"
        className="input search-filter-year"
        inputMode="numeric"
        value={year}
        onChange={(event) => setYear(event.target.value.replace(/[^\d]/g, ""))}
        placeholder={language === "he" ? "שנה" : "Year"}
        dir="ltr"
      />

      <button type="submit" className="button-primary search-box-button">
        {t.search.searchButton}
      </button>
    </form>
  );
}
