"use server";

import { sharedCookieOptions } from "@/lib/shared-cookie";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseTheme, THEME_COOKIE_NAME } from "@/lib/theme";
import {
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n";

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function setPreferredLanguageAction(formData: FormData) {
  const language = normalizeLanguage(normalize(formData.get("language")));
  const redirectTo = normalize(formData.get("redirectTo")) || "/";
  const user = await getCurrentUser();

  if (user && user.language !== language) {
    await db.user.update({
      where: { id: user.id },
      data: { language },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE_NAME, language, sharedCookieOptions());

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function setPreferredThemeAction(formData: FormData) {
  const value = normalize(formData.get("theme"));
  const theme = parseTheme(value);
  const redirectTo = normalize(formData.get("redirectTo")) || "/";
  const user = await getCurrentUser();

  if (user && user.theme !== theme) {
    await db.user.update({
      where: { id: user.id },
      data: { theme },
    });
  }

  // The cookie is the choice of a signed-out visitor and keeps the look the same on the other sites.
  const cookieStore = await cookies();

  if (theme) {
    cookieStore.set(THEME_COOKIE_NAME, theme, sharedCookieOptions());
  } else {
    cookieStore.set(THEME_COOKIE_NAME, "", { ...sharedCookieOptions(), maxAge: 0 });
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/");
}
