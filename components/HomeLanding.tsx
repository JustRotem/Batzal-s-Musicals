import BatzalLogo from "@/components/BatzalLogo";
import { Mascot, OnionRunner } from "@/components/HomeGames";
import MusicalArtwork from "@/components/MusicalArtwork";
import RecentQr from "@/components/RecentQr";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccountUrl, getMusicalsUrl, getQrUrl } from "@/lib/app-mode";
import { getBatzalSites } from "@/lib/batzal-sites";
import type { AppLanguage } from "@/lib/i18n";

const text = (language: AppLanguage, he: string, en: string) => (language === "he" ? he : en);

// What each site is for. The home page and the apps menu share the list in lib/batzal-sites.ts.
const DESCRIPTIONS: Record<string, [string, string]> = {
  library: ["מחזות זמר, תווים ותכנים, עם רשימות, תגובות והתראות.", "Musicals, scores and content, with lists, comments and notifications."],
  qr: ["יוצרים קודי QR עם לוגו וצבעים, שומרים היסטוריה ומורידים כתמונה.", "Make QR codes with a logo and colours, keep a history and download them."],
  blog: ["כתיבה, רעיונות ועדכונים.", "Writing, ideas and updates."],
};

export default async function HomeLanding({ language }: { language: AppLanguage }) {
  const accountUrl = getAccountUrl();
  const libraryUrl = getMusicalsUrl();
  // The home page reads the same database as the library: what it shows is what is published there.
  const musicals = await db.musical
    .findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        year: true,
        imagePath: true,
        thumbnailUrl: true,
        emoji: true,
        posterDisplayMode: true,
        posterAspect: true,
        _count: { select: { clips: { where: { isDraft: false } } } },
      },
    })
    .catch(() => []);
  // Only people who are signed in and have made codes see this; everyone else gets nothing here.
  const user = await getCurrentUser();
  const recent = user
    ? await db.qrHistory
        .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, url: true, logo: true, logoSize: true } })
        .catch(() => [])
    : [];
  const sites = getBatzalSites().filter((site) => !site.adminOnly && DESCRIPTIONS[site.id]);

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-text">
        <h1>{text(language, "ברוכים הבאים ל-Batzal", "Welcome to Batzal")}</h1>
        <p>
          {text(
            language,
            "פינה קטנה באינטרנט: ספרייה, כלים ובלוג, ועוד כמה הפתעות.",
            "A small corner of the internet: a library, tools, a blog and a few surprises.",
          )}
        </p>
        </div>
        <div className="home-mascot-zone">
          <Mascot language={language} logo={<BatzalLogo />} />
        </div>
      </section>

      <h2>{text(language, "מה יש כאן", "What's here")}</h2>
      <div className="home-sites">
        {sites.map((site) => (
          <a key={site.id} className="home-site" href={site.href}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={site.icon} />
              </svg>
            </span>
            <b>{language === "he" ? site.he : site.en}</b>
            <span className="desc">{text(language, DESCRIPTIONS[site.id][0], DESCRIPTIONS[site.id][1])}</span>
            <span className="go">{text(language, "לכניסה ←", "Open →")}</span>
          </a>
        ))}
      </div>

      {musicals.length ? (
        <>
          <h2>{text(language, "עכשיו בספרייה", "Now in the library")}</h2>
          <div className="home-shelf">
            {musicals.map((musical) => (
              <a key={musical.id} className="home-shelf-item" href={`${libraryUrl}/library/${musical.slug}`}>
                <div className="art">
                  <MusicalArtwork
                    imagePath={musical.imagePath?.startsWith("/") ? `${libraryUrl}${musical.imagePath}` : musical.imagePath}
                    posterDisplayMode={musical.posterDisplayMode}
                    posterAspect={musical.posterAspect}
                    title={musical.title}
                    thumbnailUrl={musical.thumbnailUrl}
                    emoji={musical.emoji}
                  />
                </div>
                <b dir="auto">{musical.title}</b>
                <span>{[musical.year, text(language, `${musical._count.clips} קטעים`, `${musical._count.clips} clips`)].filter(Boolean).join(" · ")}</span>
              </a>
            ))}
          </div>
        </>
      ) : null}

      {recent.length ? (
        <>
          <h2>{text(language, "הקודים האחרונים שיצרתם", "Your latest QR codes")}</h2>
          <RecentQr items={recent} qrUrl={getQrUrl()} language={language} />
        </>
      ) : null}

      <h2>{text(language, "הפסקת משחק", "Take a break")}</h2>
      <div className="home-games">
        <OnionRunner language={language} accountUrl={accountUrl} />
      </div>
    </main>
  );
}
