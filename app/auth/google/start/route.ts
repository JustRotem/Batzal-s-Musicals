import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleErrorRedirectUrl,
  toGoogleAppUrl,
} from "@/lib/google-auth";
import { LOGIN_NEXT_COOKIE, sanitizeNextPath } from "@/lib/login-next";

export async function GET(request: NextRequest) {
  const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const state = createGoogleOAuthState();
    const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state));
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10,
    };

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions);

    if (next) {
      response.cookies.set(LOGIN_NEXT_COOKIE, next, cookieOptions);
    } else {
      response.cookies.delete(LOGIN_NEXT_COOKIE);
    }

    return response;
  } catch {
    return NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl("google-unavailable")));
  }
}
