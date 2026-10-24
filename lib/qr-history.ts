import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";

export const MAX_QR_ITEMS = 50;

// Mutations come only from this site's own pages.
export function sameSite(request: Request) {
  const origin = request.headers.get("origin");

  return !origin || origin === new URL(getAppUrl()).origin;
}

export async function listItems(userId: string) {
  const rows = await db.qrHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_QR_ITEMS,
    select: { id: true, createdAt: true, url: true, logoSize: true, logo: true },
  });

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
