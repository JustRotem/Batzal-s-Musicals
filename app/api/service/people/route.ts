import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAvailablePermissions,
  getPermissionCategoryLabel,
  getPermissionSite,
  getPermissionSiteLabel,
  syncPermissionDefinitions,
} from "@/lib/permissions";
import { getAccountUrl } from "@/lib/app-mode";
import { notifyUsers } from "@/lib/notifications";
import { authorizeServiceRequest } from "@/lib/service-api";
import { PermissionName, UserRole, UserStatus } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// People and permissions for the control panel. Whoever holds panel_people may act; only a super admin may touch
// super admins, hand out the super admin role or grant control-panel permissions. Nobody changes their own role or status.
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const actor = await authorizeServiceRequest(request);

  if (!actor) return json({ error: "unauthorized" }, 401);

  await syncPermissionDefinitions();

  const [users, rolePermissions] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        requestMessage: true,
        userPermissions: { select: { permission: { select: { name: true } } } },
      },
    }),
    db.rolePermission.findMany({ include: { permission: { select: { name: true } } } }),
  ]);

  const roles: Record<string, string[]> = {};
  for (const role of Object.values(UserRole)) roles[role] = [];
  for (const row of rolePermissions) roles[row.role].push(row.permission.name);

  const permissions = (["he", "en"] as const).reduce<Record<string, unknown>>((acc, lang) => {
    acc[lang] = getAvailablePermissions(lang).map((permission) => ({
      name: permission.name,
      label: permission.label,
      description: permission.description,
      site: getPermissionSiteLabel(getPermissionSite(permission.category), lang),
      group: getPermissionCategoryLabel(permission.category, lang),
    }));
    return acc;
  }, {});

  return json({
    you: actor.id,
    superadmin: actor.role === "superadmin",
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      requestMessage: user.requestMessage,
      permissions: user.userPermissions.map((item) => item.permission.name),
    })),
    roles,
    permissions,
  });
}

type Body = {
  op?: string;
  userId?: string;
  role?: string;
  status?: string;
  permissions?: unknown;
};

const isPanelPermission = (name: string) => name.startsWith("panel_");

function cleanPermissions(value: unknown): PermissionName[] {
  const known = new Set<string>(getAvailablePermissions("en").map((permission) => permission.name));

  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is PermissionName => typeof item === "string" && known.has(item))))
    : [];
}

export async function POST(request: Request) {
  const actor = await authorizeServiceRequest(request);

  if (!actor) return json({ error: "unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.op) return json({ error: "invalid" }, 400);

  await syncPermissionDefinitions();

  if (body.op === "setRolePermissions") {
    const role = Object.values(UserRole).find((value) => value === body.role);

    // The super admin role always has everything; its bundle is not editable.
    if (!role || role === UserRole.superadmin) return json({ error: "invalid" }, 400);

    const names = cleanPermissions(body.permissions);

    if (actor.role !== "superadmin" && names.some(isPanelPermission)) return json({ error: "forbidden" }, 403);

    const rows = await db.permission.findMany({ where: { name: { in: names } }, select: { id: true } });

    await db.$transaction([
      db.rolePermission.deleteMany({ where: { role } }),
      db.rolePermission.createMany({ data: rows.map((row) => ({ role, permissionId: row.id })), skipDuplicates: true }),
    ]);

    return json({ ok: true });
  }

  const target = body.userId
    ? await db.user.findUnique({ where: { id: body.userId }, select: { id: true, role: true, status: true } })
    : null;

  if (!target) return json({ error: "not-found" }, 404);

  const isSelf = target.id === actor.id;

  if (actor.role !== "superadmin" && target.role === "superadmin") return json({ error: "forbidden" }, 403);

  if (body.op === "setUserPermissions") {
    const names = cleanPermissions(body.permissions);

    if (actor.role !== "superadmin" && names.some(isPanelPermission)) return json({ error: "forbidden" }, 403);
    const rows = await db.permission.findMany({ where: { name: { in: names } }, select: { id: true } });

    await db.$transaction([
      db.userPermission.deleteMany({ where: { userId: target.id } }),
      db.userPermission.createMany({ data: rows.map((row) => ({ userId: target.id, permissionId: row.id })), skipDuplicates: true }),
    ]);

    return json({ ok: true });
  }

  if (isSelf) return json({ error: "self" }, 409);

  if (body.op === "deleteUser") {
    // Permanent: super admins only, never another super admin (demote first), never yourself.
    if (actor.role !== "superadmin") return json({ error: "forbidden" }, 403);
    if (target.role === UserRole.superadmin) return json({ error: "forbidden" }, 403);

    await db.user.delete({ where: { id: target.id } });

    return json({ ok: true });
  }

  if (body.op === "setRole") {
    const role = Object.values(UserRole).find((value) => value === body.role);

    if (!role) return json({ error: "invalid" }, 400);
    if (role === UserRole.superadmin && actor.role !== "superadmin") return json({ error: "forbidden" }, 403);

    await db.user.update({ where: { id: target.id }, data: { role, status: UserStatus.active } });

    await notifyUsers([target.id], {
      kind: "rank-changed",
      titleHe: "הדרגה שלך עודכנה",
      titleEn: "Your rank was updated",
      bodyHe: "הדרגה החדשה כבר בתוקף בכל האתרים.",
      bodyEn: "The new rank is already in effect on every site.",
      href: `${getAccountUrl()}/profile`,
    });

    return json({ ok: true });
  }

  if (body.op === "setStatus") {
    const status = body.status === "blocked" ? UserStatus.blocked : body.status === "active" ? UserStatus.active : null;

    if (!status) return json({ error: "invalid" }, 400);

    await db.user.update({ where: { id: target.id }, data: { status } });

    if (status === UserStatus.blocked) {
      await db.session.deleteMany({ where: { userId: target.id } });
    }

    return json({ ok: true });
  }

  return json({ error: "invalid" }, 400);
}
