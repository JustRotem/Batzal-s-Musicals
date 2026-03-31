import { notFound } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getRoleLabel as getLocalizedRoleLabel, getTranslations } from "@/lib/i18n";
import {
  setUserRoleAction,
  updateUserPermissionsAction,
} from "@/app/admin/actions";
import AdminManagementNav from "@/components/AdminManagementNav";
import RolePromotionControl from "@/components/RolePromotionControl";
import UserPermissionEditor from "@/components/UserPermissionEditor";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { formatUserDisplayName } from "@/lib/user-display";
import {
  PERMISSIONS,
  getAvailablePermissions,
  getAllowedDemotionRoles,
  getAllowedPromotionRoles,
  hasPermission,
  isSuperAdminRole,
  syncPermissionDefinitions,
} from "@/lib/permissions";

function getRoleChangeDescription(targetRole: UserRole, language: "he" | "en") {
  switch (targetRole) {
    case UserRole.superadmin:
      return language === "he"
        ? "גישה מלאה לכל המערכת ולהרשאות המוגנות."
        : "Full access to the entire system and its protected permissions.";
    case UserRole.admin:
      return language === "he"
        ? "ניהול משתמשים, הרשאות ובקשות עורך."
        : "Manage users, permissions, and editor requests.";
    case UserRole.editor:
      return language === "he"
        ? "עריכת תוכן מחזות וקליפים."
        : "Edit musicals and clip content.";
    default:
      return language === "he"
        ? "חזרה לחשבון רגיל עם הרשאות בסיס בלבד."
        : "Return to a regular account with baseline permissions only.";
  }
}

type UserPermissionsPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function UserPermissionsPage(props: UserPermissionsPageProps) {
  const currentUser = await requirePermission(PERMISSIONS.roleManage);
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  const { userId } = await props.params;
  const availablePermissions = getAvailablePermissions(language);
  const canManageUserRoles = await hasPermission(currentUser, PERMISSIONS.userManage);
  const canAccessCommentReports =
    (await hasPermission(currentUser, PERMISSIONS.userView)) ||
    (await hasPermission(currentUser, PERMISSIONS.userManage));
  const commentReportSummary = canAccessCommentReports ? await getCommentReportSummary() : null;

  const target = await db.user.findUnique({
    where: { id: userId },
    include: {
      userPermissions: {
        include: {
          permission: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!target) {
    notFound();
  }

  const rolePermissions = await db.rolePermission.findMany({
    where: {
      role: target.role,
    },
    include: {
      permission: {
        select: {
          name: true,
        },
      },
    },
  });

  const inheritedPermissionNames =
    target.role === UserRole.superadmin
      ? availablePermissions.map((permission) => permission.name)
      : rolePermissions.map((permission) => permission.permission.name);
  const directPermissionNames = target.userPermissions.map((permission) => permission.permission.name);
  const effectivePermissionNames =
    target.role === UserRole.superadmin
      ? availablePermissions.map((permission) => permission.name)
      : Array.from(new Set([...inheritedPermissionNames, ...directPermissionNames]));

  const isSelf = currentUser.id === target.id;
  const isProtectedTarget =
    target.role === UserRole.superadmin && !isSuperAdminRole(currentUser.role);
  const canEditDirectPermissions =
    !isProtectedTarget && (isSuperAdminRole(currentUser.role) || target.role !== UserRole.superadmin);
  const availableRoleTargets = canManageUserRoles
    ? Array.from(
        new Set([
          ...getAllowedPromotionRoles(currentUser.role, target.role, isSelf),
          ...getAllowedDemotionRoles(currentUser.role, target.role, isSelf),
        ]),
      )
    : [];
  const roleChangeOptions = availableRoleTargets.map((role) => ({
    value: role,
    label: getLocalizedRoleLabel(role, language),
    description: getRoleChangeDescription(role, language),
  }));
  const fullName = formatUserDisplayName(target.firstName, target.lastName, target.username);
  const statusLabel =
    target.status === "active"
      ? t.admin.statusActive
      : target.status === "blocked"
        ? t.admin.statusBlocked
        : t.admin.statusPending;

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{t.admin.permissions}</span>
              <h1 className="viewer-title">{t.admin.userPermissionsTitle}</h1>
              <p className="viewer-text">{t.admin.userPermissionsText}</p>
            </div>
          </div>

          <AdminManagementNav
            language={language}
            active="permissions"
            showComments={canAccessCommentReports}
            openCommentReports={commentReportSummary?.open ?? 0}
          />

          <section className="admin-access-hero">
            <div className="admin-access-identity">
              <div className="button-row" style={{ marginTop: 0 }}>
                <Link className="button-secondary button-small" href="/admin/permissions">
                  {t.admin.backToRolePermissions}
                </Link>
              </div>
              <strong>{fullName || target.username}</strong>
              <span className="admin-email" dir="ltr">
                {target.email}
              </span>
              <span className="admin-user-created">
                {t.profile.username}: {target.username}
              </span>
            </div>

            <div className="admin-badge-row">
              <span className={`admin-badge ${target.role}`}>
                {getLocalizedRoleLabel(target.role, language)}
              </span>
              <span
                className={`admin-badge ${
                  target.status === "active"
                    ? "active"
                    : target.status === "blocked"
                      ? "blocked"
                      : "pending"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </section>

          <div className="admin-access-summary-grid">
            <article className="admin-access-summary-card">
              <span className="admin-access-summary-label">{t.admin.effectivePermissions}</span>
              <strong>{effectivePermissionNames.length}</strong>
              <p>{t.admin.effectivePermissionsText}</p>
            </article>
          </div>

          <section className="admin-access-section">
            <div className="admin-section-heading">
              <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
                {t.admin.roleAndAccessTitle}
              </h2>
              {roleChangeOptions.length > 0 ? (
                <RolePromotionControl
                  action={setUserRoleAction}
                  userId={target.id}
                  options={roleChangeOptions}
                  triggerLabel={t.admin.changeRole}
                  dialogTitle={t.admin.chooseNewRole}
                  dialogDescription={t.admin.chooseNewRoleText}
                  cancelLabel={t.common.cancel}
                  pendingDescriptionLabel={language === "he" ? "מעדכן..." : "Updating..."}
                />
              ) : null}
            </div>

            {!canManageUserRoles ? (
              <div className="admin-access-note">{t.admin.roleViewOnlyNote}</div>
            ) : null}

            {isSelf ? <div className="admin-access-note">{t.admin.selfRoleNote}</div> : null}

            {isProtectedTarget ? (
              <div className="admin-access-note">{t.admin.protectedSuperadminNote}</div>
            ) : null}

            <UserPermissionEditor
              language={language}
              userId={target.id}
              userLabel={fullName || target.username}
              backHref="/admin/permissions"
              inheritedPermissionNames={inheritedPermissionNames}
              directPermissionNames={directPermissionNames}
              effectivePermissionNames={effectivePermissionNames}
              availablePermissions={availablePermissions}
              canEditDirectPermissions={canEditDirectPermissions}
              canManagePermissionAssignments
              canManageRolePermission={isSuperAdminRole(currentUser.role)}
              action={updateUserPermissionsAction}
            />
          </section>
        </section>
      </div>
    </main>
  );
}
