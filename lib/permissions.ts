import { PermissionName, UserRole } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import type { AppLanguage } from "@/lib/i18n";

type PermissionUser = {
  id: string;
  role: UserRole;
  status?: "pending" | "active" | "blocked";
};

export type PermissionCategory =
  | "musicals"
  | "clips"
  | "users"
  | "roles"
  | "editor-requests"
  | "profile";

export const PERMISSIONS = {
  musicalView: "musical_view",
  musicalCreate: "musical_create",
  musicalEdit: "musical_edit",
  musicalDelete: "musical_delete",
  clipView: "clip_view",
  clipCreate: "clip_create",
  clipEdit: "clip_edit",
  clipDelete: "clip_delete",
  userView: "user_view",
  userManage: "user_manage",
  roleManage: "role_manage",
  editorRequestReview: "editor_request_review",
  profileEdit: "profile_edit",
} as const satisfies Record<string, PermissionName>;

export const CONTENT_VIEW_PERMISSIONS = [
  PERMISSIONS.musicalView,
  PERMISSIONS.clipView,
] as const satisfies PermissionName[];

export const MUSICAL_MANAGEMENT_PERMISSIONS = [
  PERMISSIONS.musicalCreate,
  PERMISSIONS.musicalEdit,
  PERMISSIONS.musicalDelete,
  PERMISSIONS.clipCreate,
  PERMISSIONS.clipEdit,
  PERMISSIONS.clipDelete,
] as const satisfies PermissionName[];

export const ADMIN_AREA_PERMISSIONS = [
  PERMISSIONS.userView,
  PERMISSIONS.userManage,
  PERMISSIONS.roleManage,
  PERMISSIONS.editorRequestReview,
] as const satisfies PermissionName[];

const AVAILABLE_PERMISSION_DEFINITIONS = [
  {
    name: PERMISSIONS.musicalView,
    key: "musicals.view",
    category: "musicals" as const,
  },
  {
    name: PERMISSIONS.musicalCreate,
    key: "musicals.create",
    category: "musicals" as const,
  },
  {
    name: PERMISSIONS.musicalEdit,
    key: "musicals.edit",
    category: "musicals" as const,
  },
  {
    name: PERMISSIONS.musicalDelete,
    key: "musicals.delete",
    category: "musicals" as const,
  },
  {
    name: PERMISSIONS.clipView,
    key: "clips.view",
    category: "clips" as const,
  },
  {
    name: PERMISSIONS.clipCreate,
    key: "clips.create",
    category: "clips" as const,
  },
  {
    name: PERMISSIONS.clipEdit,
    key: "clips.edit",
    category: "clips" as const,
  },
  {
    name: PERMISSIONS.clipDelete,
    key: "clips.delete",
    category: "clips" as const,
  },
  {
    name: PERMISSIONS.userView,
    key: "users.view",
    category: "users" as const,
  },
  {
    name: PERMISSIONS.userManage,
    key: "users.manage",
    category: "users" as const,
  },
  {
    name: PERMISSIONS.roleManage,
    key: "roles.manage",
    category: "roles" as const,
  },
  {
    name: PERMISSIONS.editorRequestReview,
    key: "editor_requests.review",
    category: "editor-requests" as const,
  },
  {
    name: PERMISSIONS.profileEdit,
    key: "profile.edit",
    category: "profile" as const,
  },
] as const;

const PERMISSION_LABELS: Record<
  AppLanguage,
  Record<PermissionName, { label: string; description: string }>
> = {
  he: {
    musical_view: { label: "צפייה במחזות", description: "גישה לצפייה בתוכן מחזות בממשק המערכת." },
    musical_create: { label: "יצירת מחזה", description: "יצירה וניהול ראשוני של מחזות חדשים." },
    musical_edit: { label: "עריכת מחזה", description: "עדכון פרטי מחזה קיים." },
    musical_delete: { label: "מחיקת מחזה", description: "מחיקת מחזה והקטעים המשויכים אליו." },
    clip_view: { label: "צפייה בקטעים", description: "גישה לצפייה בקטעים ובתוכן הווידאו במערכת." },
    clip_create: { label: "יצירת קליפ", description: "הוספת קטעים חדשים למחזה." },
    clip_edit: { label: "עריכת קליפ", description: "עדכון פרטי קטעים קיימים." },
    clip_delete: { label: "מחיקת קליפ", description: "הסרת קטעים מהמערכת." },
    user_view: { label: "צפייה במשתמשים", description: "גישה לצפייה ברשימות משתמשים ובפרטי ניהול בסיסיים." },
    user_manage: { label: "ניהול משתמשים", description: "ניהול חשבונות, חסימות ועדכוני תפקידים." },
    role_manage: { label: "ניהול הרשאות", description: "ניהול הרשאות תפקיד והרשאות ישירות." },
    editor_request_review: { label: "סקירת בקשות עורך", description: "אישור וטיפול בבקשות להרשאות עריכה." },
    profile_edit: { label: "עריכת פרופיל", description: "עדכון פרטי פרופיל, אבטחה ואמצעי שחזור אישיים." },
  },
  en: {
    musical_view: { label: "View musicals", description: "Access musical content across the app." },
    musical_create: { label: "Create musical", description: "Create new musicals and start managing them." },
    musical_edit: { label: "Edit musical", description: "Update the details of existing musicals." },
    musical_delete: { label: "Delete musical", description: "Delete a musical and its related clips." },
    clip_view: { label: "View clips", description: "Access clips and video content across the app." },
    clip_create: { label: "Create clip", description: "Add new clips to a musical." },
    clip_edit: { label: "Edit clip", description: "Update the details of existing clips." },
    clip_delete: { label: "Delete clip", description: "Remove clips from the system." },
    user_view: { label: "View users", description: "Review user lists and basic account-management details." },
    user_manage: { label: "Manage users", description: "Manage accounts, blocks, and role changes." },
    role_manage: { label: "Manage permissions", description: "Manage role permissions and direct user permissions." },
    editor_request_review: { label: "Review editor requests", description: "Approve and handle requests for editing access." },
    profile_edit: { label: "Edit profile", description: "Update profile details, security, and personal recovery options." },
  },
};

export type AvailablePermission = (typeof AVAILABLE_PERMISSION_DEFINITIONS)[number] & {
  label: string;
  description: string;
};

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  user: [
    PERMISSIONS.musicalView,
    PERMISSIONS.clipView,
    PERMISSIONS.profileEdit,
  ],
  editor: [
    PERMISSIONS.musicalView,
    PERMISSIONS.musicalCreate,
    PERMISSIONS.musicalEdit,
    PERMISSIONS.musicalDelete,
    PERMISSIONS.clipView,
    PERMISSIONS.clipCreate,
    PERMISSIONS.clipEdit,
    PERMISSIONS.clipDelete,
    PERMISSIONS.profileEdit,
  ],
  admin: [
    PERMISSIONS.musicalView,
    PERMISSIONS.musicalCreate,
    PERMISSIONS.musicalEdit,
    PERMISSIONS.musicalDelete,
    PERMISSIONS.clipView,
    PERMISSIONS.clipCreate,
    PERMISSIONS.clipEdit,
    PERMISSIONS.clipDelete,
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
    PERMISSIONS.roleManage,
    PERMISSIONS.editorRequestReview,
    PERMISSIONS.profileEdit,
  ],
  superadmin: [],
};

export function getAvailablePermissions(language: AppLanguage = "he") {
  return AVAILABLE_PERMISSION_DEFINITIONS.map((permission) => ({
    ...permission,
    ...PERMISSION_LABELS[language][permission.name],
  }));
}

export function getPermissionDefinition(
  permission: PermissionName | string,
  language: AppLanguage = "he",
) {
  return getAvailablePermissions(language).find((item) => item.name === permission);
}

export function getPermissionCategoryLabel(
  category: PermissionCategory,
  language: AppLanguage = "he",
) {
  switch (category) {
    case "musicals":
      return language === "he" ? "מחזות" : "Musicals";
    case "clips":
      return language === "he" ? "קטעים" : "Clips";
    case "users":
      return language === "he" ? "משתמשים" : "Users";
    case "roles":
      return language === "he" ? "תפקידים" : "Roles";
    case "editor-requests":
      return language === "he" ? "בקשות עורך" : "Editor requests";
    case "profile":
      return language === "he" ? "פרופיל" : "Profile";
  }
}

export function getDefaultRolePermissions(role: UserRole) {
  return DEFAULT_ROLE_PERMISSIONS[role];
}

export const syncPermissionDefinitions = cache(async () => {
  await db.$transaction(
    AVAILABLE_PERMISSION_DEFINITIONS.map((permission) =>
      db.permission.upsert({
        where: { name: permission.name },
        update: {},
        create: { name: permission.name },
      }),
    ),
  );

  const rolePermissionCount = await db.rolePermission.count();

  if (rolePermissionCount > 0) {
    return;
  }

  const permissions = await db.permission.findMany({
    where: {
      name: {
        in: AVAILABLE_PERMISSION_DEFINITIONS.map((permission) => permission.name),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const permissionIdByName = new Map(
    permissions.map((permission) => [permission.name, permission.id]),
  );

  const defaultAssignments = Object.entries(DEFAULT_ROLE_PERMISSIONS).flatMap(
    ([role, permissionNames]) =>
      permissionNames
        .map((permissionName) => {
          const permissionId = permissionIdByName.get(permissionName);

          if (!permissionId) {
            return null;
          }

          return {
            role: role as UserRole,
            permissionId,
          };
        })
        .filter(Boolean) as Array<{ role: UserRole; permissionId: string }>,
  );

  if (defaultAssignments.length === 0) {
    return;
  }

  await db.rolePermission.createMany({
    data: defaultAssignments,
    skipDuplicates: true,
  });
});

export function isAdminRole(role: UserRole) {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role: UserRole) {
  return role === "superadmin";
}

export async function hasPermission(
  user: PermissionUser | null,
  permission: PermissionName,
) {
  if (!user) return false;

  if (isSuperAdminRole(user.role)) {
    return true;
  }

  const rolePermissionCount = await getRolePermissionCount();

  if (rolePermissionCount === 0) {
    return DEFAULT_ROLE_PERMISSIONS[user.role].includes(permission);
  }

  const [rolePermission, userPermission] = await Promise.all([
    db.rolePermission.findFirst({
      where: {
        role: user.role,
        permission: {
          name: permission,
        },
      },
      select: {
        id: true,
      },
    }),
    db.userPermission.findFirst({
      where: {
        userId: user.id,
        permission: {
          name: permission,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  return Boolean(rolePermission || userPermission);
}

const getRolePermissionCount = cache(async () => db.rolePermission.count());

export async function hasAnyPermission(
  user: PermissionUser | null,
  permissions: readonly PermissionName[],
) {
  if (!user) {
    return false;
  }

  const checks = await Promise.all(
    permissions.map((permission) => hasPermission(user, permission)),
  );

  return checks.some(Boolean);
}

export async function hasAllPermissions(
  user: PermissionUser | null,
  permissions: readonly PermissionName[],
) {
  if (!user) {
    return false;
  }

  const checks = await Promise.all(
    permissions.map((permission) => hasPermission(user, permission)),
  );

  return checks.every(Boolean);
}

export async function getPermissionFlags<T extends readonly PermissionName[]>(
  user: PermissionUser | null,
  permissions: T,
): Promise<Record<T[number], boolean>> {
  const entries = await Promise.all(
    permissions.map(async (permission) => {
      const allowed = await hasPermission(user, permission);
      return [permission, allowed] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<T[number], boolean>;
}

export async function canAccessAdminArea(user: PermissionUser | null) {
  return hasAnyPermission(user, ADMIN_AREA_PERMISSIONS);
}

export async function canManageMusicalContent(user: PermissionUser | null) {
  return hasAnyPermission(user, MUSICAL_MANAGEMENT_PERMISSIONS);
}

export async function canReviewEditorRequests(user: PermissionUser | null) {
  return hasPermission(user, PERMISSIONS.editorRequestReview);
}

export function canRequestEditorAccess(user: PermissionUser | null) {
  return Boolean(user && user.role === "user" && user.status === "active");
}

export function hasPendingEditorRequest(user: PermissionUser | null) {
  return Boolean(user && user.role === "user" && user.status === "pending");
}

export function canApproveUsers(role: UserRole) {
  return isAdminRole(role);
}

export function canManageMusicals(role: UserRole) {
  return role === "editor" || role === "admin" || role === "superadmin";
}

export function canChangeRole(
  currentRole: UserRole,
  targetRole: UserRole,
  isSelf = false,
) {
  if (isSelf) return false;

  if (currentRole === "superadmin") {
    return targetRole !== "superadmin";
  }

  if (currentRole === "admin") {
    return targetRole === "user" || targetRole === "editor";
  }

  return false;
}

export function canDeleteUser(
  currentRole: UserRole,
  targetRole: UserRole,
  isSelf = false,
) {
  if (isSelf) return false;

  if (currentRole === "superadmin") {
    return targetRole !== "superadmin";
  }

  return currentRole === "admin" && (targetRole === "user" || targetRole === "editor");
}

export function getAllowedPromotionRoles(
  currentRole: UserRole,
  targetRole: UserRole,
  isSelf = false,
) {
  if (isSelf) return [];

  if (currentRole === "admin") {
    return targetRole === "user" ? [UserRole.editor] : [];
  }

  if (currentRole === "superadmin") {
    if (targetRole === "user") return [UserRole.editor, UserRole.admin, UserRole.superadmin];
    if (targetRole === "editor") return [UserRole.admin, UserRole.superadmin];
    if (targetRole === "admin") return [UserRole.superadmin];
  }

  return [];
}

export function getAllowedDemotionRoles(
  currentRole: UserRole,
  targetRole: UserRole,
  isSelf = false,
) {
  if (isSelf) return [];

  if (targetRole === "editor") {
    return currentRole === "admin" || currentRole === "superadmin" ? [UserRole.user] : [];
  }

  if (targetRole === "admin") {
    return currentRole === "superadmin" ? [UserRole.editor, UserRole.user] : [];
  }

  return [];
}
