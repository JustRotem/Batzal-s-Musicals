import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleErrorRedirectUrl,
  toGoogleAppUrl,
} from "@/lib/google-auth";

export async function GET() {
  try {
    const state = createGoogleOAuthState();
    const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state));

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch {
    return NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl("google-unavailable")));
  }
}
