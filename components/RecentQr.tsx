"use client";

import { useEffect, useRef } from "react";
import type { AppLanguage } from "@/lib/i18n";

type Item = { id: string; url: string; logo: string | null; logoSize: number };

function Code({ item }: { item: Item }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    void import("qr-code-styling").then(({ default: Qr }) => {
      if (cancelled || !ref.current) return;

      ref.current.textContent = "";
      new Qr({
        width: 110,
        height: 110,
        type: "canvas",
        data: item.url,
        image: item.logo ?? undefined,
        qrOptions: { errorCorrectionLevel: "H" },
        dotsOptions: { type: "square", color: "#000000" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { imageSize: item.logoSize / 100, margin: 2, crossOrigin: "anonymous" },
      }).append(ref.current);
    });

    return () => {
      cancelled = true;
    };
  }, [item]);

  return <div className="q" ref={ref} />;
}

// The last codes this person made on the QR site; a click opens the QR site to use one again.
export default function RecentQr({ items, qrUrl, language }: { items: Item[]; qrUrl: string; language: AppLanguage }) {
  return (
    <div className="home-recent">
      {items.map((item) => (
        <a key={item.id} className="home-recent-item" href={`${qrUrl}/?code=${item.id}`} title={item.url}>
          <Code item={item} />
          <span dir="ltr">{item.url.replace(/^https?:\/\//, "")}</span>
        </a>
      ))}
      <a className="home-recent-more" href={qrUrl}>
        {language === "he" ? "ליצירת עוד ←" : "Make more →"}
      </a>
    </div>
  );
}
