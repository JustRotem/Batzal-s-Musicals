import { NextResponse, type NextRequest } from "next/server";
import { getAccountUrl, getAppMode } from "@/lib/app-mode";

// The same code runs two sites. The account site only serves sign-in, settings, users and permissions;
// the musicals site serves the musicals and sends account pages to the account site.
const ACCOUNT_SITE_PATHS = [
  /^\/$/,
  /^\/auth\/(login|blocked|forbidden|pending)$/,
  /^\/auth\/google\/(start|callback)$/,
  /^\/auth\/sso$/,
  /^\/profile$/,
  /^\/admin$/,
  /^\/admin\/permissions(\/.*)?$/,
  /^\/api\/(health|sso\/public-key|profile\/avatar)$/,
  /^\/uploads\/avatars\/[^/]+$/,
];

// Account pages that must not exist on the musicals site.
const MOVED_TO_ACCOUNT_SITE = [/^\/profile$/, /^\/admin$/, /^\/admin\/permissions(\/.*)?$/];
const ACCOUNT_SITE_ONLY = [/^\/auth\/google\/(start|callback)$/, /^\/auth\/sso$/, /^\/api\/sso\/public-key$/];

const matches = (patterns: RegExp[], pathname: string) => patterns.some((pattern) => pattern.test(pathname));

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/__not-found", request.url));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const mode = getAppMode();

  if (mode === "account") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/profile", request.url));
    }

    if (!matches(ACCOUNT_SITE_PATHS, pathname)) {
      return notFound(request);
    }
  } else {
    if (matches(MOVED_TO_ACCOUNT_SITE, pathname)) {
      return NextResponse.redirect(new URL(`${pathname}${search}`, getAccountUrl()));
    }

    if (matches(ACCOUNT_SITE_ONLY, pathname)) {
      return notFound(request);
    }
  }

  const isProtected =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const response = NextResponse.next();

  if (isProtected) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
