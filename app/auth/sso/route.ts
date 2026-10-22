import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import {
  buildSsoCallbackUrl,
  isSsoEnabled,
  parseSsoRequest,
  signSsoToken,
} from "@/lib/sso";

export const dynamic = "force-dynamic";

function redirectNoStore(url: string) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");

  return response;
}

// Entry point for the other Batzal sites: GET /auth/sso?return=<origin>&state=<random>
export async function GET(request: NextRequest) {
  const parsed = parseSsoRequest(
    request.nextUrl.searchParams.get("return"),
    request.nextUrl.searchParams.get("state"),
  );

  if (!parsed) {
    return new NextResponse("Invalid sign-in request", { status: 400 });
  }

  if (!isSsoEnabled()) {
    return new NextResponse("Single sign-on is not configured", { status: 503 });
  }

  const appUrl = getAppUrl();
  const user = await getCurrentUser();

  if (!user) {
    const resume = `/auth/sso?return=${encodeURIComponent(parsed.origin)}&state=${encodeURIComponent(parsed.state)}`;

    return redirectNoStore(new URL(`/auth/login?next=${encodeURIComponent(resume)}`, appUrl).toString());
  }

  if (user.status !== "active") {
    return redirectNoStore(new URL("/auth/login?error=forbidden", appUrl).toString());
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { googleSubject: true },
  });

  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;
  const picture = user.avatarUrl ? new URL(user.avatarUrl, appUrl).toString() : null;

  const token = signSsoToken(
    {
      sub: user.id,
      gsub: record?.googleSubject ?? null,
      email: user.email,
      name,
      username: user.username,
      picture,
      role: user.role,
      lang: user.language,
    },
    parsed.origin,
    parsed.state,
  );

  return redirectNoStore(buildSsoCallbackUrl(parsed.origin, token));
}
