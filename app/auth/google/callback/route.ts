import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleAuthError,
  completeGoogleSignIn,
  getGoogleErrorRedirectUrl,
  toGoogleAppUrl,
  verifyGoogleIdentity,
} from "@/lib/google-auth";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectivePermissions } from "@/lib/permissions";
import { LANGUAGE_COOKIE_NAME } from "@/lib/i18n";
import { ACCOUNT_LOGIN_NEXT_COOKIE, IDENTITY_CONFIRM_COOKIE, sanitizeNextPath } from "@/lib/login-next";
import { buildSsoCallbackUrl, parseSsoRequest, signSsoToken } from "@/lib/sso";
import { getAppUrl } from "@/lib/env";

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  const next = sanitizeNextPath(request.cookies.get(ACCOUNT_LOGIN_NEXT_COOKIE)?.value);
  const googleError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  const clearCookies = (response: NextResponse) => {
    for (const name of [GOOGLE_OAUTH_STATE_COOKIE, ACCOUNT_LOGIN_NEXT_COOKIE, IDENTITY_CONFIRM_COOKIE]) {
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

  // Re-confirming identity: nothing is signed in or changed; the same person, shown by the same Google account, is vouched for.
  const confirmRaw = request.cookies.get(IDENTITY_CONFIRM_COOKIE)?.value;

  if (confirmRaw) {
    try {
      const pending = JSON.parse(confirmRaw) as { origin?: string; state?: string; uid?: string };
      const target = parseSsoRequest(pending.origin ?? null, pending.state ?? null);
      const user = await getCurrentUser();

      if (!target || !pending.uid || !user || user.id !== pending.uid || user.status !== "active") {
        throw new GoogleAuthError("google-state-invalid", "Identity confirmation is not valid any more");
      }

      const identity = await verifyGoogleIdentity({ code, expectedState, receivedState: state });
      const record = await db.user.findUnique({ where: { id: user.id }, select: { googleSubject: true } });

      if (identity.email !== user.email.toLowerCase() || (record?.googleSubject && record.googleSubject !== identity.sub)) {
        throw new GoogleAuthError("google-email-conflict", "A different Google account was used");
      }

      const token = signSsoToken(
        {
          sub: user.id,
          gsub: record?.googleSubject ?? null,
          email: user.email,
          name: user.username,
          username: user.username,
          picture: user.avatarUrl ? new URL(user.avatarUrl, getAppUrl()).toString() : null,
          role: user.role,
          lang: user.language,
          theme: user.theme,
          perms: await getEffectivePermissions(user),
          sid: user.ssoGroup ?? "",
          confirmed: true,
        },
        target.origin,
        target.state,
      );

      return clearCookies(NextResponse.redirect(buildSsoCallbackUrl(target.origin, token)));
    } catch (error) {
      console.error("[auth][confirm] failed", { reason: error instanceof Error ? error.message : "unknown-error" });

      return clearCookies(NextResponse.redirect(toGoogleAppUrl("/profile?confirm=failed")));
    }
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
