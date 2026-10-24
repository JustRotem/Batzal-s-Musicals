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
import { PermissionName, UserRole, UserStatus } from "@/lib/prisma";

// People and permissions for the control panel. Whoever holds panel_people may act; only a super admin may touch
// super admins, hand out the super admin role or grant control-panel permissions. Nobody changes their own role or status.
export type Actor = { id: string; role: string };
export type Result = { status: number; body: unknown };

const ok = (body: unknown = { ok: true }): Result => ({ status: 200, body });
const fail = (status: number, error: string): Result => ({ status, body: { error } });

export async function listPeople(actor: Actor): Promise<Result> {
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

  return ok({
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

export type PeopleBody = {
  op?: string;
  userId?: string;
  role?: string;
  status?: string;
  permissions?: unknown;
  // Deleting a person needs their e-mail typed in, like deleting an item in the library needs its name
  confirmEmail?: string;
};

const isPanelPermission = (name: string) => name.startsWith("panel_");

function cleanPermissions(value: unknown): PermissionName[] {
  const known = new Set<string>(getAvailablePermissions("en").map((permission) => permission.name));

  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is PermissionName => typeof item === "string" && known.has(item))))
    : [];
}

// Changes that give high access (admin ranks, any permission change) or remove a person need a fresh Google confirmation.
export const needsConfirmation = (body: PeopleBody) =>
  body.op === "setUserPermissions" ||
  body.op === "setRolePermissions" ||
  body.op === "deleteUser" ||
  (body.op === "setRole" && (body.role === "admin" || body.role === "superadmin"));

export async function applyPeopleOp(actor: Actor, body: PeopleBody): Promise<Result> {
  if (!body.op) return fail(400, "invalid");

  await syncPermissionDefinitions();

  if (body.op === "setRolePermissions") {
    const role = Object.values(UserRole).find((value) => value === body.role);

    // The super admin role always has everything; its bundle is not editable.
    if (!role || role === UserRole.superadmin) return fail(400, "invalid");

    const names = cleanPermissions(body.permissions);

    if (actor.role !== "superadmin" && names.some(isPanelPermission)) return fail(403, "forbidden");

    const rows = await db.permission.findMany({ where: { name: { in: names } }, select: { id: true } });

    await db.$transaction([
      db.rolePermission.deleteMany({ where: { role } }),
      db.rolePermission.createMany({ data: rows.map((row) => ({ role, permissionId: row.id })), skipDuplicates: true }),
    ]);

    return ok();
  }

  const target = body.userId
    ? await db.user.findUnique({ where: { id: body.userId }, select: { id: true, role: true, status: true, email: true } })
    : null;

  if (!target) return fail(404, "not-found");

  const isSelf = target.id === actor.id;

  if (actor.role !== "superadmin" && target.role === "superadmin") return fail(403, "forbidden");

  if (body.op === "setUserPermissions") {
    const names = cleanPermissions(body.permissions);

    if (actor.role !== "superadmin" && names.some(isPanelPermission)) return fail(403, "forbidden");
    const rows = await db.permission.findMany({ where: { name: { in: names } }, select: { id: true } });

    await db.$transaction([
      db.userPermission.deleteMany({ where: { userId: target.id } }),
      db.userPermission.createMany({ data: rows.map((row) => ({ userId: target.id, permissionId: row.id })), skipDuplicates: true }),
    ]);

    return ok();
  }

  if (isSelf) return fail(409, "self");

  if (body.op === "deleteUser") {
    // Permanent: super admins only, never another super admin (demote first), never yourself.
    if (actor.role !== "superadmin") return fail(403, "forbidden");
    if (target.role === UserRole.superadmin) return fail(403, "forbidden");
    if (typeof body.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) return fail(400, "email-mismatch");

    await db.user.delete({ where: { id: target.id } });

    return ok();
  }

  if (body.op === "setRole") {
    const role = Object.values(UserRole).find((value) => value === body.role);

    if (!role) return fail(400, "invalid");
    if (role === UserRole.superadmin && actor.role !== "superadmin") return fail(403, "forbidden");

    await db.user.update({ where: { id: target.id }, data: { role, status: UserStatus.active } });

    await notifyUsers([target.id], {
      kind: "rank-changed",
      titleHe: "הדרגה שלך עודכנה",
      titleEn: "Your rank was updated",
      bodyHe: "הדרגה החדשה כבר בתוקף בכל האתרים.",
      bodyEn: "The new rank is already in effect on every site.",
      href: `${getAccountUrl()}/profile`,
    });

    return ok();
  }

  if (body.op === "setStatus") {
    const status = body.status === "blocked" ? UserStatus.blocked : body.status === "active" ? UserStatus.active : null;

    if (!status) return fail(400, "invalid");

    await db.user.update({ where: { id: target.id }, data: { status } });

    if (status === UserStatus.blocked) {
      await db.session.deleteMany({ where: { userId: target.id } });
    }

    return ok();
  }

  return fail(400, "invalid");
}
