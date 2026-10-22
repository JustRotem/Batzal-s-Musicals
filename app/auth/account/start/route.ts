import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SSO_STATE_COOKIE,
  buildAccountSsoUrl,
  createAccountSsoState,
  isAccountSsoConfigured,
} from "@/lib/account-sso";
import { getAppUrl } from "@/lib/env";
import { LOGIN_NEXT_COOKIE, sanitizeNextPath } from "@/lib/login-next";

export const dynamic = "force-dynamic";

// Musicals site: send the visitor to the account site to sign in.
export async function GET(request: NextRequest) {
  if (!isAccountSsoConfigured()) {
    return NextResponse.redirect(new URL("/auth/login?error=sso-unavailable", getAppUrl()));
  }

  const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
  const state = createAccountSsoState();
  const response = NextResponse.redirect(buildAccountSsoUrl(state));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  response.cookies.set(ACCOUNT_SSO_STATE_COOKIE, state, cookieOptions);

  if (next) {
    response.cookies.set(LOGIN_NEXT_COOKIE, next, cookieOptions);
  } else {
    response.cookies.delete(LOGIN_NEXT_COOKIE);
  }

  response.headers.set("Cache-Control", "no-store");

  return response;
}
