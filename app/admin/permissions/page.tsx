import { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getRoleLabel as getLocalizedRoleLabel, getTranslations } from "@/lib/i18n";
import { updateRolePermissionsAction } from "@/app/admin/actions";
import AdminManagementNav from "@/components/AdminManagementNav";
import RolePermissionsManager from "@/components/RolePermissionsManager";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { formatUserDisplayName } from "@/lib/user-display";
import {
  PERMISSIONS,
  getAvailablePermissions,
  hasPermission,
  isSuperAdminRole,
  syncPermissionDefinitions,
} from "@/lib/permissions";

function getRoleDescription(role: UserRole, language: "he" | "en") {
  switch (role) {
    case UserRole.superadmin:
      return language === "he"
        ? "גישה מלאה לכל ההרשאות. תפקיד זה נשאר מוגן וניתן לעריכה רק על ידי סופר אדמין."
        : "Full access to every permission. This role stays protected and can be edited only by a super admin.";
    case UserRole.admin:
      return language === "he"
        ? "ניהול מערכת, משתמשים והרשאות ברמת אדמין."
        : "System, user, and permission management at the admin level.";
    case UserRole.editor:
      return language === "he"
        ? "עריכת מחזות וקטעים ללא גישת ניהול משתמשים מלאה."
        : "Manage musicals and clips without full user-management access.";
    default:
      return language === "he"
        ? "חשבון בסיסי ללא הרשאות ניהול כברירת מחדל."
        : "A baseline account with no management permissions by default.";
  }
}

export default async function AdminPermissionsPage() {
  const currentUser = await requirePermission(PERMISSIONS.roleManage);
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const canAccessCommentReports =
    (await hasPermission(currentUser, PERMISSIONS.userView)) ||
    (await hasPermission(currentUser, PERMISSIONS.userManage));
  const commentReportSummary = canAccessCommentReports ? await getCommentReportSummary() : null;

  const availablePermissions = getAvailablePermissions(language);
  const rolePermissions = await db.rolePermission.findMany({
    include: {
      permission: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ role: "asc" }],
  });
  const users = await db.user.findMany({
    include: {
      userPermissions: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  const rolePermissionMap = new Map<UserRole, Set<string>>();
  for (const role of Object.values(UserRole)) {
    rolePermissionMap.set(role, new Set());
  }

  for (const rolePermission of rolePermissions) {
    rolePermissionMap.get(rolePermission.role)?.add(rolePermission.permission.name);
  }

  const roles = Object.values(UserRole).map((role) => ({
    role,
    label: getLocalizedRoleLabel(role, language),
    description: getRoleDescription(role, language),
    selectedPermissionNames: Array.from(rolePermissionMap.get(role) ?? new Set<string>()),
    isProtectedRole: role === UserRole.superadmin && !isSuperAdminRole(currentUser.role),
  }));

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{t.admin.accounts}</span>
              <h1 className="viewer-title">{t.admin.rolePermissionsTitle}</h1>
              <p className="viewer-text">{t.admin.rolePermissionsText}</p>
            </div>
          </div>

          <AdminManagementNav
            language={language}
            active="permissions"
            showComments={canAccessCommentReports}
            openCommentReports={commentReportSummary?.open ?? 0}
          />

          <section className="admin-access-section">
            <p className="admin-section-text">{t.admin.rolePermissionsEditableText}</p>

            <RolePermissionsManager
              language={language}
              action={updateRolePermissionsAction}
              availablePermissions={availablePermissions}
              roles={roles}
            />
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
                {t.admin.directAccessTitle}
              </h2>
              <span className="admin-section-count">{users.length}</span>
            </div>
            <p className="admin-section-text">{t.admin.directAccessText}</p>

            <div className="admin-grid">
              {users.map((user) => (
                <article key={user.id} className="admin-user-card">
                  <div className="admin-user-head">
                    <div className="admin-user-identity">
                      <strong>{formatUserDisplayName(user.firstName, user.lastName, user.username) || user.username}</strong>
                      <span className="admin-email" dir="ltr">
                        {user.email}
                      </span>
                    </div>

                    <div className="admin-user-side">
                      <div className="admin-badge-row">
                        <span className={`admin-badge ${user.role}`}>
                          {getLocalizedRoleLabel(user.role, language)}
                        </span>
                      </div>
                      <a
                        className="button-secondary button-small"
                        href={`/admin/permissions/users/${user.id}`}
                      >
                        {t.admin.managePermissions}
                      </a>
                    </div>
                  </div>

                  <div className="admin-user-meta">
                    <span>
                      {t.admin.directPermissionsCount} {user.userPermissions.length}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
