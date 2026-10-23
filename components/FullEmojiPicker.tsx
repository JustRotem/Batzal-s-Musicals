"use client";

import { useEffect, useRef } from "react";
import type { AppLanguage } from "@/lib/i18n";

const HEBREW = {
  categoriesLabel: "קטגוריות",
  emojiUnsupportedMessage: "הדפדפן שלך לא תומך באימוג'ים צבעוניים.",
  favoritesLabel: "מועדפים",
  loadingMessage: "טוען…",
  networkErrorMessage: "לא הצלחנו לטעון את האימוג'ים.",
  regionLabel: "בחירת אימוג'י",
  searchDescription: "כשיש תוצאות, החצים בוחרים ו-Enter מאשר.",
  searchLabel: "חיפוש (באנגלית)",
  searchResultsLabel: "תוצאות חיפוש",
  skinToneDescription: "כשפתוח, החצים בוחרים ו-Enter מאשר.",
  skinToneLabel: "בחירת גוון עור (כרגע {skinTone})",
  skinTonesLabel: "גווני עור",
  skinTones: ["רגיל", "בהיר", "בהיר-בינוני", "בינוני", "כהה-בינוני", "כהה"],
  categories: {
    custom: "מותאם",
    "smileys-emotion": "פרצופים ורגשות",
    "people-body": "אנשים וגוף",
    "animals-nature": "חיות וטבע",
    "food-drink": "אוכל ושתייה",
    "travel-places": "מקומות ונסיעות",
    activities: "פעילויות",
    objects: "חפצים",
    symbols: "סמלים",
    flags: "דגלים",
  },
};

type PickerElement = HTMLElement & { dataSource: string; i18n: unknown; locale: string };

// The whole emoji set, like in WhatsApp. The data file is served from this site (/emoji/en.json).
export default function FullEmojiPicker({ onPick, language }: { onPick: (emoji: string) => void; language: AppLanguage }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    let picker: PickerElement | null = null;

    const handle = (event: Event) => {
      const unicode = (event as CustomEvent<{ unicode?: string }>).detail?.unicode;

      if (unicode) onPickRef.current(unicode);
    };

    void (async () => {
      await import("emoji-picker-element");
      const english = (await import("emoji-picker-element/i18n/en")).default;

      if (cancelled || !holderRef.current) return;

      picker = document.createElement("emoji-picker") as PickerElement;
      picker.dataSource = "/emoji/en.json";
      picker.i18n = language === "he" ? HEBREW : english;

      const theme = document.documentElement.getAttribute("data-theme");
      const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      picker.classList.add(dark ? "dark" : "light");

      picker.addEventListener("emoji-click", handle);
      holderRef.current.appendChild(picker);
    })();

    return () => {
      cancelled = true;
      picker?.removeEventListener("emoji-click", handle);
      picker?.remove();
    };
  }, [language]);

  return <div className="full-emoji-picker" ref={holderRef} />;
}
