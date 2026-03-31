import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_SESSION_COOKIE_NAME,
  normalizeLanguage,
  type AppLanguage,
} from "@/lib/i18n";

async function resolveCurrentLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionLanguage = cookieStore.get(LANGUAGE_SESSION_COOKIE_NAME)?.value;
  const cookieLanguage = cookieStore.get(LANGUAGE_COOKIE_NAME)?.value;

  if (sessionToken && (sessionLanguage === "he" || sessionLanguage === "en")) {
    return sessionLanguage;
  }

  if (cookieLanguage === "he" || cookieLanguage === "en") {
    return cookieLanguage;
  }
  return normalizeLanguage(null);
}

export const getCurrentLanguage = cache(resolveCurrentLanguage);
