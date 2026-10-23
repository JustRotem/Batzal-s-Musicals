import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { resolveTheme, THEME_COOKIE_NAME, type AppTheme } from "@/lib/theme";

async function resolveCurrentTheme(): Promise<AppTheme | null> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);

  return resolveTheme(user?.theme, cookieStore.get(THEME_COOKIE_NAME)?.value, Boolean(user));
}

export const getCurrentTheme = cache(resolveCurrentTheme);
