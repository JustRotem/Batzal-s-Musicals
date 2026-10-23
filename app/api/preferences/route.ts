import { sharedCookieOptions } from "@/lib/shared-cookie";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllowedOrigins } from "@/lib/sso";
import { THEME_COOKIE_NAME } from "@/lib/theme";
import { getAppUrl } from "@/lib/env";
import { LANGUAGE_COOKIE_NAME, normalizeLanguage } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Language and appearance of the signed-in account, shared by every Batzal site. The other sites call this from the
// browser (credentials included), so only the pre-approved Batzal origins are answered.
function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (!origin) return null;
  if (origin === new URL(getAppUrl()).origin) return origin;

  return getAllowedOrigins().includes(origin) ? origin : null;
}

function reply(request: Request, body: unknown, status = 200) {
  const origin = allowedOrigin(request);
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export async function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);

  if (!origin) return new NextResponse(null, { status: 403 });

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) return reply(request, { error: "unauthorized" }, 401);

  return reply(request, { language: user.language, theme: user.theme });
}

export async function POST(request: Request) {
  // A cross-site page may only send this from an approved origin.
  if (request.headers.get("origin") && !allowedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) return reply(request, { error: "unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as { language?: unknown; theme?: unknown } | null;
  const data: { language?: string; theme?: string | null } = {};

  if (body?.language === "he" || body?.language === "en") data.language = normalizeLanguage(body.language);
  if (body?.theme === "light" || body?.theme === "dark") data.theme = body.theme;
  if (body?.theme === "system") data.theme = null;

  if (Object.keys(data).length === 0) return reply(request, { error: "invalid" }, 400);

  await db.user.update({ where: { id: user.id }, data });

  const response = reply(request, { ok: true });

  if (data.language) {
    response.cookies.set(LANGUAGE_COOKIE_NAME, data.language, sharedCookieOptions());
  }

  if (data.theme !== undefined) {
    response.cookies.set(THEME_COOKIE_NAME, data.theme ?? "", { ...sharedCookieOptions(), ...(data.theme ? {} : { maxAge: 0 }) });
  }

  return response;
}
