import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleAuthError,
  completeGoogleSignIn,
  getGoogleErrorRedirectUrl,
  toGoogleAppUrl,
} from "@/lib/google-auth";
import { LANGUAGE_COOKIE_NAME } from "@/lib/i18n";
import { LOGIN_NEXT_COOKIE, sanitizeNextPath } from "@/lib/login-next";

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  const next = sanitizeNextPath(request.cookies.get(LOGIN_NEXT_COOKIE)?.value);
  const googleError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  const clearCookies = (response: NextResponse) => {
    for (const name of [GOOGLE_OAUTH_STATE_COOKIE, LOGIN_NEXT_COOKIE]) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
      });
    }

    return response;
  };

  if (googleError === "access_denied") {
    return clearCookies(
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

    // A successful sign-in resumes where the visitor came from (for example another Batzal site).
    const destination = result.redirectTo === "/" && next ? next : result.redirectTo;

    return clearCookies(NextResponse.redirect(toGoogleAppUrl(destination)));
  } catch (error) {
    const errorCode = error instanceof GoogleAuthError ? error.code : "google-token-failed";

    console.error("[auth][google] callback failed", {
      reason: error instanceof Error ? error.message : "unknown-error",
      code: errorCode,
    });

    return clearCookies(
      NextResponse.redirect(toGoogleAppUrl(getGoogleErrorRedirectUrl(errorCode))),
    );
  }
}
