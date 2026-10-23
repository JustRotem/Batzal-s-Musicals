import { db } from "@/lib/db";

export type NotificationInput = {
  kind: string;
  titleHe: string;
  titleEn: string;
  bodyHe?: string | null;
  bodyEn?: string | null;
  // An absolute address (it may live on another Batzal site)
  href?: string | null;
};

// Delivers the same notification to several people. A failure here must never break the action that caused it.
export async function notifyUsers(userIds: string[], input: NotificationInput) {
  const ids = Array.from(new Set(userIds));

  if (ids.length === 0) return;

  try {
    await db.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        kind: input.kind,
        titleHe: input.titleHe,
        titleEn: input.titleEn,
        bodyHe: input.bodyHe ?? null,
        bodyEn: input.bodyEn ?? null,
        href: input.href ?? null,
      })),
    });
  } catch (error) {
    console.error("[notifications] could not deliver", { kind: input.kind, reason: error instanceof Error ? error.message : "unknown" });
  }
}

// People who handle requests and reports.
export async function notifyAdmins(input: NotificationInput, exceptUserId?: string) {
  const admins = await db.user.findMany({
    where: { role: { in: ["admin", "superadmin"] }, status: "active", ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });

  await notifyUsers(admins.map((admin) => admin.id), input);
}
