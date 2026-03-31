"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_SESSION_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n";

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function setPreferredLanguageAction(formData: FormData) {
  const language = normalizeLanguage(normalize(formData.get("language")));
  const redirectTo = normalize(formData.get("redirectTo")) || "/";
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    cookieStore.set(LANGUAGE_SESSION_COOKIE_NAME, language, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    cookieStore.set(LANGUAGE_COOKIE_NAME, language, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}
