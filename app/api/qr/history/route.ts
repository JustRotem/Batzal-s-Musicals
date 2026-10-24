import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listItems, MAX_QR_ITEMS, sameSite } from "@/lib/qr-history";

export const dynamic = "force-dynamic";

const MAX_LOGO = 200 * 1024;

const noStore = { "Cache-Control": "no-store" };

// A history item is only what changes between codes: the link, the centre image and its size. Colours are fixed.
export async function GET() {
  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ error: "login required" }, { status: 401, headers: noStore });

  return NextResponse.json({ items: await listItems(user.id) }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!sameSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const user = await getCurrentUser();

  if (!user || user.status !== "active") return NextResponse.json({ error: "login required" }, { status: 401, headers: noStore });

  const body = (await request.json().catch(() => null)) as { url?: unknown; logoSize?: unknown; logo?: unknown } | null;
  const url = body?.url;

  if (typeof url !== "string" || !url || url.length > 2000) return NextResponse.json({ error: "bad item" }, { status: 400 });

  const logoSize = Math.min(40, Math.max(10, Number(body?.logoSize) || 30));
  let logo: string | null = null;

  if (body?.logo) {
    if (typeof body.logo !== "string" || !/^data:image\/(png|webp);base64,/.test(body.logo) || body.logo.length > MAX_LOGO) {
      return NextResponse.json({ error: "bad item" }, { status: 400 });
    }

    logo = body.logo;
  }

  // saving the same code again moves it to the top
  await db.qrHistory.deleteMany({ where: { userId: user.id, url, logoSize, logo } });
  await db.qrHistory.create({ data: { userId: user.id, url, logoSize, logo } });

  const stale = await db.qrHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_QR_ITEMS,
    select: { id: true },
  });

  if (stale.length) await db.qrHistory.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });

  return NextResponse.json({ items: await listItems(user.id) }, { headers: noStore });
}
