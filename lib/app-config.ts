import type { AppLanguage } from "@/lib/i18n";

export const APP_TITLE_HE =
  process.env.NEXT_PUBLIC_APP_TITLE_HE?.trim() || "המחזות של בצלאל";

export const APP_TITLE_EN =
  process.env.NEXT_PUBLIC_APP_TITLE_EN?.trim() || "Batzal's Musicals";

export const DEFAULT_APP_TITLE = APP_TITLE_EN;

export function getAppTitle(language: AppLanguage) {
  return language === "he" ? APP_TITLE_HE : APP_TITLE_EN;
}