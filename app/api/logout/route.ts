import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { getAllowedOrigins } from "@/lib/sso";

export const dynamic = "force-dynamic";

// Signs this browser out of the account site and, through the shared sign-in group, of every other Batzal site.
// Called from the other sites' pages, so only the approved Batzal origins are answered.
function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (!origin) return null;
  if (origin === new URL(getAppUrl()).origin) return origin;

  return getAllowedOrigins().includes(origin) ? origin : null;
}

export async function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);

  if (!origin) return new NextResponse(null, { status: 403 });

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    },
  });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") && !allowedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await clearSession();

  const origin = allowedOrigin(request);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  return response;
}
