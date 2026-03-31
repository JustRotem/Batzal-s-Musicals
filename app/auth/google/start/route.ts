import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleErrorRedirectUrl,
  serializeGoogleOAuthState,
  toGoogleAppUrl,
} from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  try {
    const oauthState = createGoogleOAuthState(mode);
    const redirectUrl = buildGoogleAuthorizationUrl(oauthState);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, serializeGoogleOAuthState(oauthState), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch {
    return NextResponse.redirect(
      toGoogleAppUrl(getGoogleErrorRedirectUrl(mode, "google-unavailable")),
    );
  }
}
