// Sites shown in the shared Batzal apps menu. Keep in sync with https://static.batzal.net/batzal.js.
export type BatzalSite = {
  host: string;
  href: string;
  he: string;
  en: string;
  icon: string;
};

export const BATZAL_SITES: BatzalSite[] = [
  {
    host: "musicals.batzal.net",
    href: "https://musicals.batzal.net",
    he: "מחזות זמר",
    en: "Musicals",
    icon: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    host: "qr.batzal.net",
    href: "https://qr.batzal.net",
    he: "מפיק QR",
    en: "QR maker",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  },
  {
    host: "blog.batzal.net",
    href: "https://blog.batzal.net",
    he: "בלוג",
    en: "Blog",
    icon: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM8 20a3 3 0 01-3-3",
  },
  {
    host: "twisted.batzal.net",
    href: "https://twisted.batzal.net",
    he: "Twisted",
    en: "Twisted",
    icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  },
];
