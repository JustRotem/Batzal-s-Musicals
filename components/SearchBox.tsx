"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type SearchBoxProps = {
  initialQuery?: string;
  placeholder?: string;
  ariaLabel?: string;
  submitLabel?: string;
  live?: boolean;
  className?: string;
  actionPath?: string;
};

function buildSearchUrl(pathname: string, query: string) {
  const trimmed = query.trim();

  if (!trimmed) {
    return pathname;
  }

  const searchParams = new URLSearchParams({ q: trimmed });
  return `${pathname}?${searchParams.toString()}`;
}

export default function SearchBox({
  initialQuery = "",
  placeholder = "חפש מחזות, קטעים או תיאור...",
  ariaLabel = "חיפוש במערכת",
  submitLabel = "חיפוש",
  live = false,
  className,
  actionPath = "/search",
}: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!live) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextUrl = buildSearchUrl(pathname || actionPath, query);

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionPath, live, pathname, query, router]);

  return (
    <form
      action={actionPath}
      method="get"
      className={`search-box ${className ?? ""}`.trim()}
      onSubmit={(event) => {
        if (!live) {
          return;
        }

        event.preventDefault();
        router.push(buildSearchUrl(pathname || actionPath, query));
      }}
    >
      <div className="search-box-input-wrap">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input search-box-input"
          placeholder={placeholder}
          aria-label={ariaLabel}
          dir="auto"
        />
      </div>
      <button type="submit" className="button-primary search-box-button">
        {submitLabel}
      </button>
    </form>
  );
}
