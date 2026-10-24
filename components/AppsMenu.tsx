"use client";

import { useEffect, useRef, useState } from "react";
import type { BatzalSite } from "@/lib/batzal-sites";
import type { AppLanguage } from "@/lib/i18n";

export default function AppsMenu({ language, showPanel, sites }: { language: AppLanguage; showPanel: boolean; sites: BatzalSite[] }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const label = language === "he" ? "האתרים שלי" : "My sites";
  useEffect(() => {
    setHost(window.location.host);
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

    const onOther = (event: Event) => {
      if ((event as CustomEvent).detail !== wrapRef.current) setOpen(false);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("bz-popup", onOther);
    document.dispatchEvent(new CustomEvent("bz-popup", { detail: wrapRef.current }));

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("bz-popup", onOther);
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
          {sites.filter((site) => !site.adminOnly || showPanel).map((site) => (
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
        </div>
      ) : null}
    </div>
  );
}
