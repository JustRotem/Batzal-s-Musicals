"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  LANGUAGE_COOKIE_MAX_AGE_SECONDS,
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
  cookieStore.set(LANGUAGE_COOKIE_NAME, language, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  });

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}
