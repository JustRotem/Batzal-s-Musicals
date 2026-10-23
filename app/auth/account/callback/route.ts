import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_SSO_STATE_COOKIE, acceptAccountToken } from "@/lib/account-sso";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import { LOGIN_NEXT_COOKIE, sanitizeNextPath } from "@/lib/login-next";

export const dynamic = "force-dynamic";

// Musicals site: the account site sends the visitor back here with a signed token.
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const expectedState = request.cookies.get(ACCOUNT_SSO_STATE_COOKIE)?.value ?? null;
  const next = sanitizeNextPath(request.cookies.get(LOGIN_NEXT_COOKIE)?.value);

  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, appUrl));

    for (const name of [ACCOUNT_SSO_STATE_COOKIE, LOGIN_NEXT_COOKIE]) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
      });
    }

    response.headers.set("Cache-Control", "no-store");

    return response;
  };

  const claims = acceptAccountToken(request.nextUrl.searchParams.get("token"), expectedState);

  if (!claims) {
    return finish("/auth/login?error=sso-failed");
  }

  // The account and this site share one user table, so the token's subject is a user id here.
  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, status: true, language: true },
  });

  if (!user || user.status === "blocked") {
    return finish("/auth/login?error=forbidden");
  }

  // Join the browser's sign-in group, so signing out on any Batzal site ends this session too.
  await createSession(user.id, user.language, claims.sid || null);

  return finish(next ?? "/");
}
