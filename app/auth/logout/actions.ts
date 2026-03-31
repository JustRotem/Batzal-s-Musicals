"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { LANGUAGE_SESSION_COOKIE_NAME } from "@/lib/i18n";

export async function logoutAction() {
  await clearSession();
  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  redirect("/");
}
