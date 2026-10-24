import { getAdminUrl, getHomeUrl, getMusicalsUrl, getQrUrl } from "@/lib/app-mode";

// Sites shown in the shared Batzal apps menu. Keep in sync with https://static.batzal.net/batzal.js.
// The addresses come from the settings of the network the page belongs to, so in DEV every link stays in DEV.
export type BatzalSite = {
  id: "home" | "library" | "qr" | "blog" | "admin";
  host: string;
  href: string;
  he: string;
  en: string;
  icon: string;
  // Only offered to super admins.
  adminOnly?: boolean;
};

const SITES: Omit<BatzalSite, "host" | "href">[] = [
  {
    id: "home",
    he: "דף הבית",
    en: "Home",
    icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  },
  {
    id: "library",
    he: "הספרייה",
    en: "Library",
    icon: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    id: "qr",
    he: "מפיק QR",
    en: "QR maker",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  },
  {
    id: "blog",
    he: "בלוג",
    en: "Blog",
    icon: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM8 20a3 3 0 01-3-3",
  },
  {
    id: "admin",
    he: "לוח בקרה",
    en: "Control panel",
    icon: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4",
    adminOnly: true,
  },
];

export function getBatzalSites(): BatzalSite[] {
  const urls: Record<BatzalSite["id"], string> = {
    home: getHomeUrl(),
    library: getMusicalsUrl(),
    qr: getQrUrl(),
    blog: process.env.BLOG_URL?.trim().replace(/\/$/, "") || "https://blog.batzal.net",
    admin: getAdminUrl(),
  };

  return SITES.map((site) => ({ ...site, href: urls[site.id], host: new URL(urls[site.id]).host }));
}
