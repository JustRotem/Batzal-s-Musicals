import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listItems, sameSite } from "@/lib/qr-history";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameSite(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const { id } = await context.params;

  await db.qrHistory.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ items: await listItems(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
