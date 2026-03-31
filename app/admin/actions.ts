"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  PERMISSIONS,
  canDeleteUser,
  canChangeRole,
  getAllowedPromotionRoles,
  getAllowedDemotionRoles,
  getAvailablePermissions,
  isSuperAdminRole,
} from "@/lib/permissions";
import {
  notifyUserAboutEditorRequestApproved,
  notifyUserAboutEditorRequestRejected,
} from "@/lib/editor-request-notifications";
import { CommentReportStatus, PermissionName, UserRole, UserStatus } from "@/lib/prisma";

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseUserRole(value: string) {
  return Object.values(UserRole).find((role) => role === value) ?? null;
}

function isPermissionName(value: string): value is PermissionName {
  return getAvailablePermissions().some((permission) => permission.name === value);
}

function getSelectedPermissions(formData: FormData) {
  return formData
    .getAll("permissions")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(isPermissionName);
}

function canManagePermissionAssignment(
  currentRole: UserRole,
  targetRole: UserRole,
  permission: PermissionName,
) {
  if (isSuperAdminRole(currentRole)) {
    return true;
  }

  if (isSuperAdminRole(targetRole)) {
    return false;
  }

  if (permission === PERMISSIONS.roleManage) {
    return false;
  }

  return true;
}

export async function approveUserAction(formData: FormData) {
  await requirePermission(PERMISSIONS.editorRequestReview);

  const userId = normalize(formData.get("userId"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      requestMessage: true,
      status: true,
      role: true,
    },
  });
  if (!target) return;

  const shouldNotify = target.status === UserStatus.pending && target.role === UserRole.user;

  await db.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.active,
      role: UserRole.editor,
      requestMessage: null,
    },
  });

  if (shouldNotify) {
    await notifyUserAboutEditorRequestApproved(target);
  }

  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function rejectUserAction(formData: FormData) {
  await requirePermission(PERMISSIONS.editorRequestReview);

  const userId = normalize(formData.get("userId"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      requestMessage: true,
      status: true,
      role: true,
    },
  });
  if (!target) return;

  const shouldNotify = target.status === UserStatus.pending && target.role === UserRole.user;

  await db.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.active,
      requestMessage: null,
    },
  });

  if (shouldNotify) {
    await notifyUserAboutEditorRequestRejected(target);
  }

  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function blockUserAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) return;

  const isSelf = target.id === current.id;

  if (!canChangeRole(current.role, target.role, isSelf)) return;

  await db.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.blocked,
    },
  });

  revalidatePath("/admin");
}

export async function unblockUserAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) return;

  const isSelf = target.id === current.id;

  if (!canChangeRole(current.role, target.role, isSelf)) return;

  await db.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.active,
    },
  });

  revalidatePath("/admin");
}

export async function promoteUserRoleAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  const targetRoleValue = normalize(formData.get("targetRole"));
  if (!userId || !targetRoleValue) return;

  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) return;

  const isSelf = target.id === current.id;
  if (!canChangeRole(current.role, target.role, isSelf)) return;

  const targetRole =
    targetRoleValue === "editor"
      ? UserRole.editor
      : targetRoleValue === "admin"
        ? UserRole.admin
        : targetRoleValue === "superadmin"
          ? UserRole.superadmin
        : null;

  if (!targetRole) return;

  const allowedPromotionRoles = getAllowedPromotionRoles(current.role, target.role, isSelf);
  if (!allowedPromotionRoles.includes(targetRole)) return;

  await db.user.update({
    where: { id: userId },
    data: {
      role: targetRole,
      status: UserStatus.active,
    },
  });

  revalidatePath("/admin");
}

export async function makeUserAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  const targetRoleValue = normalize(formData.get("targetRole"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) return;

  const isSelf = target.id === current.id;
  if (!canChangeRole(current.role, target.role, isSelf)) return;

  const allowedDemotionRoles = getAllowedDemotionRoles(current.role, target.role, isSelf);
  if (allowedDemotionRoles.length === 0) return;

  const demotionTargetRole =
    targetRoleValue === "editor"
      ? UserRole.editor
      : targetRoleValue === "user" || !targetRoleValue
        ? UserRole.user
        : null;

  if (!demotionTargetRole || !allowedDemotionRoles.includes(demotionTargetRole)) return;

  await db.user.update({
    where: { id: userId },
    data: {
      role: demotionTargetRole,
      status: UserStatus.active,
    },
  });

  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) return;

  const isSelf = target.id === current.id;

  if (!canDeleteUser(current.role, target.role, isSelf)) return;

  await db.user.delete({
    where: { id: userId },
  });

  revalidatePath("/admin");
}

export async function updateRolePermissionsAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.roleManage);

  const roleValue = normalize(formData.get("role"));
  if (!roleValue) return;

  const role = Object.values(UserRole).find((value) => value === roleValue);
  if (!role) return;

  if (role === UserRole.superadmin && !isSuperAdminRole(current.role)) {
    return;
  }

  const selectedPermissions = getSelectedPermissions(formData);

  const existingRolePermissions = await db.rolePermission.findMany({
    where: { role },
    include: {
      permission: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  });

  const preservedPermissionNames = existingRolePermissions
    .map((permission) => permission.permission.name)
    .filter((permissionName) =>
      !canManagePermissionAssignment(current.role, role, permissionName),
    );

  const manageableSelectedPermissionNames = selectedPermissions.filter((permissionName) =>
    canManagePermissionAssignment(current.role, role, permissionName),
  );

  const nextPermissionNames = Array.from(
    new Set([...preservedPermissionNames, ...manageableSelectedPermissionNames]),
  );

  const permissions = await db.permission.findMany({
    where: {
      name: {
        in: nextPermissionNames,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  await db.rolePermission.deleteMany({
    where: { role },
  });

  if (permissions.length > 0) {
    await db.rolePermission.createMany({
      data: permissions.map((permission) => ({
        role,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/permissions");
}

export async function setUserRoleAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const userId = normalize(formData.get("userId"));
  const targetRoleValue = normalize(formData.get("targetRole"));
  if (!userId || !targetRoleValue) return;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!target) return;

  const isSelf = target.id === current.id;
  if (!canChangeRole(current.role, target.role, isSelf)) return;

  const nextRole = parseUserRole(targetRoleValue);
  if (!nextRole || nextRole === target.role) return;

  const allowedRoles = Array.from(
    new Set([
      ...getAllowedPromotionRoles(current.role, target.role, isSelf),
      ...getAllowedDemotionRoles(current.role, target.role, isSelf),
    ]),
  );

  if (!allowedRoles.includes(nextRole)) return;

  await db.user.update({
    where: { id: target.id },
    data: {
      role: nextRole,
      status: UserStatus.active,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/users/${target.id}`);
}

export async function updateUserPermissionsAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.roleManage);

  const userId = normalize(formData.get("userId"));
  const returnTo = normalize(formData.get("returnTo"));
  if (!userId) return;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!target) return;

  if (target.role === UserRole.superadmin && !isSuperAdminRole(current.role)) {
    return;
  }

  const selectedPermissions = getSelectedPermissions(formData);

  const existingUserPermissions = await db.userPermission.findMany({
    where: {
      userId: target.id,
    },
    include: {
      permission: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const preservedPermissionNames = existingUserPermissions
    .map((permission) => permission.permission.name)
    .filter((permissionName) =>
      !canManagePermissionAssignment(current.role, target.role, permissionName),
    );

  const manageableSelectedPermissionNames = selectedPermissions.filter((permissionName) =>
    canManagePermissionAssignment(current.role, target.role, permissionName),
  );

  const nextPermissionNames = Array.from(
    new Set([...preservedPermissionNames, ...manageableSelectedPermissionNames]),
  );

  const permissions = await db.permission.findMany({
    where: {
      name: {
        in: nextPermissionNames,
      },
    },
    select: {
      id: true,
    },
  });

  await db.userPermission.deleteMany({
    where: {
      userId: target.id,
    },
  });

  if (permissions.length > 0) {
    await db.userPermission.createMany({
      data: permissions.map((permission) => ({
        userId: target.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/permissions");
  revalidatePath(`/admin/permissions/users/${target.id}`);

  if (returnTo) {
    redirect(returnTo);
  }
}

export async function markCommentReportReviewedAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const reportId = normalize(formData.get("reportId"));
  if (!reportId) return;

  await db.commentReport.updateMany({
    where: {
      id: reportId,
      status: CommentReportStatus.open,
    },
    data: {
      status: CommentReportStatus.reviewed,
      reviewedAt: new Date(),
      reviewedById: current.id,
    },
  });

  revalidatePath("/admin/comments");
}

export async function dismissCommentReportAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const reportId = normalize(formData.get("reportId"));
  if (!reportId) return;

  await db.commentReport.updateMany({
    where: {
      id: reportId,
      status: {
        in: [CommentReportStatus.open, CommentReportStatus.reviewed],
      },
    },
    data: {
      status: CommentReportStatus.dismissed,
      reviewedAt: new Date(),
      reviewedById: current.id,
    },
  });

  revalidatePath("/admin/comments");
}

export async function actionCommentReportByHidingComment(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const reportId = normalize(formData.get("reportId"));
  if (!reportId) return;

  const report = await db.commentReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      commentId: true,
      comment: {
        select: {
          status: true,
          clip: {
            select: {
              musical: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!report) return;

  await db.$transaction([
    db.comment.update({
      where: { id: report.commentId },
      data: {
        status: "hidden",
        hiddenAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: current.id,
      },
    }),
    db.commentReport.updateMany({
      where: {
        commentId: report.commentId,
        status: {
          in: [CommentReportStatus.open, CommentReportStatus.reviewed],
        },
      },
      data: {
        status: CommentReportStatus.actioned,
        reviewedAt: new Date(),
        reviewedById: current.id,
      },
    }),
  ]);

  revalidatePath("/admin/comments");
  revalidatePath(`/musicals/${report.comment.clip.musical.slug}`, "page");
}

export async function unhideModeratedCommentAction(formData: FormData) {
  const current = await requirePermission(PERMISSIONS.userManage);

  const commentId = normalize(formData.get("commentId"));
  const musicalSlug = normalize(formData.get("musicalSlug"));
  if (!commentId || !musicalSlug) return;

  await db.comment.updateMany({
    where: {
      id: commentId,
      status: "hidden",
    },
    data: {
      status: "visible",
      hiddenAt: null,
      moderatedAt: new Date(),
      moderatedById: current.id,
    },
  });

  revalidatePath("/admin/comments");
  revalidatePath(`/musicals/${musicalSlug}`, "page");
}
