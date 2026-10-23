import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import { getAllowedOrigins } from "@/lib/sso";

export const dynamic = "force-dynamic";

// The notification bell of every Batzal site reads this (account site only). Other sites call it from the browser with
// credentials, so only the approved Batzal origins are answered.
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

  const english = user.language === "en";
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return reply(request, {
    unread,
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: english ? item.titleEn : item.titleHe,
      body: english ? item.bodyEn : item.bodyHe,
      href: item.href,
      createdAt: item.createdAt,
      read: item.readAt !== null,
    })),
  });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") && !allowedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) return reply(request, { error: "unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as { read?: unknown } | null;

  if (body?.read === "all") {
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else if (Array.isArray(body?.read)) {
    const ids = body.read.filter((id): id is string => typeof id === "string").slice(0, 50);

    await db.notification.updateMany({ where: { userId: user.id, id: { in: ids }, readAt: null }, data: { readAt: new Date() } });
  } else {
    return reply(request, { error: "invalid" }, 400);
  }

  return reply(request, { ok: true });
}
