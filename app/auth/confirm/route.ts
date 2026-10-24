import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { buildGoogleAuthorizationUrl, createGoogleOAuthState, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-auth";
import { IDENTITY_CONFIRM_COOKIE } from "@/lib/login-next";
import { isSsoEnabled, parseSsoRequest } from "@/lib/sso";

export const dynamic = "force-dynamic";

// A Batzal site (the control panel) asks the signed-in person to prove it is really them: GET /auth/confirm?return=<origin>&state=<random>
// They sign in with Google again, for the same Google account, and the answer goes back as a token marked `confirmed`.
export async function GET(request: NextRequest) {
  const parsed = parseSsoRequest(request.nextUrl.searchParams.get("return"), request.nextUrl.searchParams.get("state"));

  if (!parsed) return new NextResponse("Invalid request", { status: 400 });
  if (!isSsoEnabled()) return new NextResponse("Single sign-on is not configured", { status: 503 });

  const appUrl = getAppUrl();
  const user = await getCurrentUser();

  if (!user || user.status !== "active") {
    const resume = `/auth/confirm?return=${encodeURIComponent(parsed.origin)}&state=${encodeURIComponent(parsed.state)}`;
    const response = NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(resume)}`, appUrl).toString());
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  const state = createGoogleOAuthState();
  const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state, user.email));
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 10 };

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(
    IDENTITY_CONFIRM_COOKIE,
    JSON.stringify({ origin: parsed.origin, state: parsed.state, uid: user.id }),
    options,
  );
  response.headers.set("Cache-Control", "no-store");

  return response;
}
