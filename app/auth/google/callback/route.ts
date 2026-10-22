import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleAuthError,
  completeGoogleSignIn,
  getGoogleErrorRedirectUrl,
  toGoogleAppUrl,
} from "@/lib/google-auth";
import { LANGUAGE_COOKIE_NAME } from "@/lib/i18n";

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  const googleError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return response;
  };

  if (googleError === "access_denied") {
    return clearStateCookie(
      NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl("google-cancelled"))),
    );
  }

  try {
    const result = await completeGoogleSignIn({
      code,
      expectedState,
      receivedState: state,
      visitorLanguage: request.cookies.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
    });

    return clearStateCookie(NextResponse.redirect(toGoogleAppUrl(result.redirectTo)));
  } catch (error) {
    const errorCode = error instanceof GoogleAuthError ? error.code : "google-token-failed";

    console.error("[auth][google] callback failed", {
      reason: error instanceof Error ? error.message : "unknown-error",
      code: errorCode,
    });

    return clearStateCookie(
      NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl(errorCode))),
    );
  }
}
