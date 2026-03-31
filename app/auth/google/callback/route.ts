import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleAuthError,
  completeGoogleSignIn,
  getGoogleErrorRedirectUrl,
  parseGoogleOAuthState,
  toGoogleAppUrl,
} from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const expectedState = parseGoogleOAuthState(stateCookie);
  const mode = expectedState?.mode ?? request.nextUrl.searchParams.get("mode");
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
      NextResponse.redirect(
        toGoogleAppUrl(getGoogleErrorRedirectUrl(mode, "google-cancelled")),
      ),
    );
  }

  try {
    const result = await completeGoogleSignIn({
      code,
      expectedState,
      receivedState: state,
    });

    return clearStateCookie(NextResponse.redirect(toGoogleAppUrl(result.redirectTo)));
  } catch (error) {
    const errorCode =
      error instanceof GoogleAuthError ? error.code : "google-token-failed";

    console.error("[auth][google] callback failed", {
      reason: error instanceof Error ? error.message : "unknown-error",
      code: errorCode,
      mode: mode === "signup" ? "signup" : "login",
    });

    return clearStateCookie(
      NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl(mode, errorCode))),
    );
  }
}
