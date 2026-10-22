import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { LANGUAGE_COOKIE_NAME, resolveLanguage, type AppLanguage } from "@/lib/i18n";

async function resolveCurrentLanguage(): Promise<AppLanguage> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);

  return resolveLanguage(user?.language, cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
}

export const getCurrentLanguage = cache(resolveCurrentLanguage);
