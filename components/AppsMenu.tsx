"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { setPreferredLanguageAction } from "@/app/actions";
import { BATZAL_SITES } from "@/lib/batzal-sites";
import { getLanguageLabel, type AppLanguage } from "@/lib/i18n";

export default function AppsMenu({ language }: { language: AppLanguage }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const label = language === "he" ? "האתרים שלי" : "My sites";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => {
    const search = searchParams?.toString();

    return `${pathname || "/"}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    setHost(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="bz-appswrap" ref={wrapRef}>
      <button
        type="button"
        className="bz-apps"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {[5, 12, 19].flatMap((y) =>
            [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />),
          )}
        </svg>
      </button>
      {open ? (
        <div className="bz-menu" role="menu">
          {BATZAL_SITES.map((site) => (
            <a
              key={site.host}
              href={site.href}
              role="menuitem"
              aria-current={site.host === host ? "page" : undefined}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={site.icon} />
              </svg>
              <span>{language === "he" ? site.he : site.en}</span>
            </a>
          ))}
          <div className="bz-menu-lang">
            <span>{language === "he" ? "שפה" : "Language"}</span>
            {(["he", "en"] as const).map((option) => (
              <form key={option} action={setPreferredLanguageAction}>
                <input type="hidden" name="language" value={option} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button type="submit" aria-pressed={option === language}>
                  {getLanguageLabel(option)}
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
