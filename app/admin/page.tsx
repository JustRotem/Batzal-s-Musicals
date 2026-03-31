import Link from "next/link";
import { UserRole, UserStatus } from "@prisma/client";
import { requireAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { formatIsraeliDate } from "@/lib/date-format";
import { getRoleLabel as getLocalizedRoleLabel, getTranslations } from "@/lib/i18n";
import AdminActionButton from "@/components/AdminActionButton";
import RolePromotionControl from "@/components/RolePromotionControl";
import UserPermissionEditor from "@/components/UserPermissionEditor";
import AdminSearchToolbar from "@/components/AdminSearchToolbar";
import HighlightedText from "@/components/HighlightedText";
import AdminManagementNav from "@/components/AdminManagementNav";
import { getCommentReportSummary } from "@/lib/comment-report-summary";
import { formatUserDisplayName } from "@/lib/user-display";
import {
  approveUserAction,
  rejectUserAction,
  makeUserAction,
  deleteUserAction,
  blockUserAction,
  unblockUserAction,
  promoteUserRoleAction,
  updateUserPermissionsAction,
} from "./actions";
import {
  PERMISSIONS,
  getAvailablePermissions,
  hasPermission,
  canDeleteUser,
  canChangeRole,
  getAllowedPromotionRoles,
  getAllowedDemotionRoles,
  isSuperAdminRole,
  syncPermissionDefinitions,
} from "@/lib/permissions";

type AdminPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    status?: string;
  }>;
};

type UserFilters = {
  activeQuery: string;
  activeRole: string;
  activeStatus: string;
  safeRole: "all" | UserRole;
  safeStatus: "all" | UserStatus;
  shouldQueryPendingUsers: boolean;
  shouldQueryUsers: boolean;
  usersWhere: {
    role?: UserRole;
    status:
      | UserStatus
      | {
          in: UserStatus[];
        };
  };
};

const isEnumValue = <T extends string>(set: Set<T>, value: string): value is T => {
  return set.has(value as T);
};

const buildUserFilters = ({
  query,
  role,
  status,
  canReviewEditorRequests,
  canViewUsers,
}: {
  query?: string | null;
  role?: string | null;
  status?: string | null;
  canReviewEditorRequests: boolean;
  canViewUsers: boolean;
}): UserFilters => {
  const activeQuery = query?.trim() ?? "";
  const activeRole = role ?? "all";
  const activeStatus = status ?? "all";
  const validRoles = new Set(Object.values(UserRole));
  const validStatuses = new Set(Object.values(UserStatus));
  const safeRole = activeRole === "all" || isEnumValue(validRoles, activeRole) ? activeRole : "all";
  const safeStatus =
    activeStatus === "all" || isEnumValue(validStatuses, activeStatus) ? activeStatus : "all";
  const shouldQueryPendingUsers =
    canReviewEditorRequests &&
    (safeRole === "all" || safeRole === UserRole.user) &&
    (safeStatus === "all" || safeStatus === UserStatus.pending);
  const shouldQueryUsers =
    canViewUsers && (safeStatus === "all" || safeStatus !== UserStatus.pending);
  const usersWhere =
    safeStatus !== "all"
      ? {
          ...(safeRole !== "all" ? { role: safeRole } : {}),
          status: safeStatus,
        }
      : {
          ...(safeRole !== "all" ? { role: safeRole } : {}),
          status: {
            in: [UserStatus.active, UserStatus.blocked],
          },
        };

  return {
    activeQuery,
    activeRole,
    activeStatus,
    safeRole,
    safeStatus,
    shouldQueryPendingUsers,
    shouldQueryUsers,
    usersWhere,
  };
};

const loadAdminUsersData = async ({
  shouldQueryPendingUsers,
  shouldQueryUsers,
  usersWhere,
}: {
  shouldQueryPendingUsers: boolean;
  shouldQueryUsers: boolean;
  usersWhere: UserFilters["usersWhere"];
}) => {
  const pendingUsers = shouldQueryPendingUsers
    ? await db.user.findMany({
        where: {
          status: UserStatus.pending,
          role: UserRole.user,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const users = shouldQueryUsers
    ? await db.user.findMany({
        where: usersWhere,
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
        orderBy: [{ createdAt: "asc" }],
      })
    : [];

  return { pendingUsers, users };
};

const STATUS_LABELS: Record<"he" | "en", Record<UserStatus, string>> = {
  he: {
    active: "פעיל",
    blocked: "חסום",
    pending: "ממתין",
  },
  en: {
    active: "Active",
    blocked: "Blocked",
    pending: "Pending",
  },
};

const getStatusLabel = (status: UserStatus, language: "he" | "en") => {
  return STATUS_LABELS[language][status];
};

function getStatusClass(status: UserStatus) {
  return status === "active" ? "active" : status === "blocked" ? "blocked" : "pending";
}

function normalizeSearchText(value: string) {
  return value.normalize("NFC").toLocaleLowerCase();
}

function matchesUserQuery(
  user: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  },
  query: string,
) {
  if (!query) {
    return true;
  }

  const haystack = normalizeSearchText(
    [user.firstName, user.lastName, `${user.firstName} ${user.lastName}`, user.username, user.email].join(" "),
  );

  return haystack.includes(normalizeSearchText(query));
}

function getRolePriority(role: UserRole) {
  switch (role) {
    case UserRole.superadmin:
      return 0;
    case UserRole.admin:
      return 1;
    case UserRole.editor:
      return 2;
    default:
      return 3;
  }
}

function getPromotionOption(role: UserRole, language: "he" | "en") {
  if (role === UserRole.editor) {
    return {
      value: "editor" as const,
      label: getLocalizedRoleLabel(role, language),
      description:
        language === "he"
          ? "גישת עריכה למחחזות ולקליפים."
          : "Editing access for musicals and clips.",
    };
  }

  if (role === UserRole.admin) {
    return {
      value: "admin" as const,
      label: getLocalizedRoleLabel(role, language),
      description:
        language === "he" ? "גישת ניהול מלאה למערכת." : "Full management access to the system.",
    };
  }

  return {
    value: "superadmin" as const,
    label: getLocalizedRoleLabel(role, language),
    description:
      language === "he"
        ? "גישת העל הגבוהה ביותר לניהול והרשאות."
        : "The highest level of access for administration and permissions.",
  };
}

function getDemotionOption(role: UserRole, language: "he" | "en") {
  if (role === UserRole.editor) {
    return {
      value: "editor" as const,
      label: getLocalizedRoleLabel(role, language),
      description:
        language === "he"
          ? "הורדה מאדמין חזרה לגישת עריכה."
          : "Step down from admin back to editor access.",
    };
  }

  return {
    value: "user" as const,
    label: getLocalizedRoleLabel("user", language),
    description:
      language === "he"
        ? "החזרה לחשבון רגיל ללא הרשאות עריכה או ניהול."
        : "Return to a regular account without editing or management permissions.",
  };
}

export default async function AdminPage(props: AdminPageProps) {
  const currentAdmin = await requireAnyPermission([
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
    PERMISSIONS.editorRequestReview,
  ]);
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  const canViewUsers = await hasPermission(currentAdmin, PERMISSIONS.userView);
  const canManageUsers = await hasPermission(currentAdmin, PERMISSIONS.userManage);
  const canAccessCommentReports = canViewUsers || canManageUsers;
  const commentReportSummary = canAccessCommentReports ? await getCommentReportSummary() : null;
  const canManagePermissionAssignments = await hasPermission(currentAdmin, PERMISSIONS.roleManage);
  const canReviewEditorRequests = await hasPermission(
    currentAdmin,
    PERMISSIONS.editorRequestReview,
  );
  const availablePermissions = getAvailablePermissions(language);
  const searchParams = await props.searchParams;
  const {
    activeQuery,
    activeRole,
    activeStatus,
    safeRole,
    safeStatus,
    shouldQueryPendingUsers,
    shouldQueryUsers,
    usersWhere,
  } = buildUserFilters({
    query: searchParams?.q,
    role: searchParams?.role,
    status: searchParams?.status,
    canReviewEditorRequests,
    canViewUsers,
  });

  const { pendingUsers, users } = await loadAdminUsersData({
    shouldQueryPendingUsers,
    shouldQueryUsers,
    usersWhere,
  });

  const rolePermissions = canViewUsers
    ? await db.rolePermission.findMany({
        include: {
          permission: {
            select: {
              name: true,
            },
          },
        },
      })
    : [];

  const rolePermissionMap = new Map<UserRole, string[]>();
  for (const role of Object.values(UserRole)) {
    rolePermissionMap.set(role, []);
  }
  for (const rolePermission of rolePermissions) {
    rolePermissionMap.set(rolePermission.role, [
      ...(rolePermissionMap.get(rolePermission.role) ?? []),
      rolePermission.permission.name,
    ]);
  }

  const sortedUsers = [...users].sort((left, right) => {
    const roleDiff = getRolePriority(left.role) - getRolePriority(right.role);
    if (roleDiff !== 0) {
      return roleDiff;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  const filteredPendingUsers = pendingUsers.filter((user) => {
    if (activeRole !== "all" && activeRole !== UserRole.user) {
      return false;
    }

    if (activeStatus !== "all" && activeStatus !== UserStatus.pending) {
      return false;
    }

    return matchesUserQuery(user, activeQuery);
  });

  const filteredUsers = sortedUsers.filter((user) => {
    if (activeRole !== "all" && user.role !== activeRole) {
      return false;
    }

    if (activeStatus !== "all" && user.status !== activeStatus) {
      return false;
    }

    return matchesUserQuery(user, activeQuery);
  });

  const showPendingSection =
    canReviewEditorRequests && (activeStatus === "all" || activeStatus === UserStatus.pending);

  const roleOptions = [
    { value: "all", label: t.admin.allRoles },
    { value: UserRole.user, label: getLocalizedRoleLabel("user", language) },
    { value: UserRole.editor, label: getLocalizedRoleLabel("editor", language) },
    { value: UserRole.admin, label: getLocalizedRoleLabel("admin", language) },
    { value: UserRole.superadmin, label: getLocalizedRoleLabel("superadmin", language) },
  ];

  const statusOptions = [
    { value: "all", label: t.admin.allStatuses },
    { value: UserStatus.active, label: t.admin.statusActive },
    { value: UserStatus.pending, label: t.admin.statusPending },
    { value: UserStatus.blocked, label: t.admin.statusBlocked },
  ];

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{t.admin.accounts}</span>
              <h1 className="viewer-title">{t.admin.dashboardTitle}</h1>
              <p className="viewer-text">{t.admin.dashboardText}</p>
            </div>
          </div>

          <AdminManagementNav
            language={language}
            active="accounts"
            showComments={canAccessCommentReports}
            showPermissions={canManagePermissionAssignments}
            openCommentReports={commentReportSummary?.open ?? 0}
          />

          {showPendingSection ? (
            <div className="admin-section">
              <div className="admin-section-heading">
                <h2 className="admin-section-title">{t.admin.pendingRequestsTitle}</h2>
                <span className="admin-section-count">{filteredPendingUsers.length}</span>
              </div>
              <p className="admin-section-text">{t.admin.pendingRequestsText}</p>

              {filteredPendingUsers.length === 0 ? (
                <div className="link-card admin-empty-state">{t.admin.noPendingRequests}</div>
              ) : (
                <div className="admin-grid">
                  {filteredPendingUsers.map((user) => (
                    <article key={user.id} className="admin-user-card">
                      <div className="admin-user-main">
                        <div className="admin-user-head">
                          <div className="admin-user-identity">
                            <strong dir="auto">
                              <HighlightedText text={user.username} query={activeQuery} />
                            </strong>
                            <span className="admin-email" dir="ltr">
                              <HighlightedText text={user.email} query={activeQuery} />
                            </span>
                            <span className="admin-user-created">
                              {t.admin.registeredAt} {formatIsraeliDate(user.createdAt)}
                            </span>
                          </div>

                          <div className="admin-user-side">
                            <div className="admin-badge-row">
                              <span className="admin-badge user">
                                {getLocalizedRoleLabel("user", language)}
                              </span>
                              <span className="admin-badge pending">{t.admin.statusPending}</span>
                            </div>

                            <div className="admin-actions admin-actions-compact">
                              <form action={approveUserAction}>
                                <input type="hidden" name="userId" value={user.id} />
                                <AdminActionButton
                                  className="button-primary button-small"
                                  idleLabel={t.admin.approveAsEditor}
                                  pendingLabel={t.admin.approving}
                                />
                              </form>

                              <form action={rejectUserAction}>
                                <input type="hidden" name="userId" value={user.id} />
                                <AdminActionButton
                                  className="button-danger button-small"
                                  idleLabel={t.admin.reject}
                                  pendingLabel={t.admin.rejecting}
                                  confirmTitle={t.admin.rejectRequestTitle}
                                  confirmMessage={t.admin.rejectRequestMessage}
                                  confirmLabel={t.admin.rejectRequestConfirm}
                                />
                              </form>
                            </div>
                          </div>
                        </div>

                        <div className="admin-user-meta">
                          <span dir="auto">
                            <HighlightedText
                              text={formatUserDisplayName(user.firstName, user.lastName, user.username) || t.admin.noFullName}
                              query={activeQuery}
                            />
                          </span>
                          <span>
                            {t.admin.requestSentAt}{" "}
                            {formatIsraeliDate(user.updatedAt)}
                          </span>
                        </div>

                        {user.requestMessage ? (
                          <p className="admin-user-note">{user.requestMessage}</p>
                        ) : (
                          <p className="admin-user-note muted">{t.admin.noAdminNote}</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {canViewUsers ? (
            <div className="admin-section">
              <div className="admin-section-heading">
                <h2 className="admin-section-title">{t.admin.existingUsersTitle}</h2>
                <span className="admin-section-count">{filteredUsers.length}</span>
              </div>
              <p className="admin-section-text">{t.admin.existingUsersText}</p>

              <AdminSearchToolbar
                initialQuery={activeQuery}
                initialRole={activeRole}
                initialStatus={activeStatus}
                roleOptions={roleOptions}
                statusOptions={statusOptions}
                placeholder={t.admin.userManagementSearch}
                submitLabel={t.admin.filterButton}
              />

              {filteredUsers.length === 0 ? (
                <div className="link-card admin-empty-state">{t.admin.noFilteredUsers}</div>
              ) : (
                <div className="admin-grid">
                  {filteredUsers.map((user) => {
                    const isSelf = user.id === currentAdmin.id;
                    const canDelete = canDeleteUser(currentAdmin.role, user.role, isSelf);
                    const canChange = canChangeRole(currentAdmin.role, user.role, isSelf);
                    const promotionOptions = getAllowedPromotionRoles(
                      currentAdmin.role,
                      user.role,
                      isSelf,
                    ).map((role) => getPromotionOption(role, language));
                    const demotionOptions = getAllowedDemotionRoles(
                      currentAdmin.role,
                      user.role,
                      isSelf,
                    ).map((role) => getDemotionOption(role, language));
                    const canBlock = canChange && user.status === "active";
                    const canUnblock = canChange && user.status === "blocked";
                    const inheritedPermissions = rolePermissionMap.get(user.role) ?? [];
                    const directPermissions = user.userPermissions.map(
                      (userPermission) => userPermission.permission.name,
                    );
                    const canEditDirectPermissions =
                      canManagePermissionAssignments &&
                      !isSelf &&
                      !(user.role === UserRole.superadmin && !isSuperAdminRole(currentAdmin.role));

                    return (
                      <article key={user.id} className="admin-user-card">
                        <div className="admin-user-main">
                          <div className="admin-user-head">
                            <div className="admin-user-identity">
                              <strong dir="auto">
                                <HighlightedText text={user.username} query={activeQuery} />
                              </strong>
                              <span className="admin-email" dir="ltr">
                                <HighlightedText text={user.email} query={activeQuery} />
                              </span>
                              <span className="admin-user-created">
                                {t.admin.registeredAt}{" "}
                                {formatIsraeliDate(user.createdAt)}
                              </span>
                            </div>

                            <div className="admin-user-side">
                              <div className="admin-badge-row">
                                <span className={`admin-badge ${user.role}`}>
                                  {getLocalizedRoleLabel(user.role, language)}
                                </span>
                                <span className={`admin-badge ${getStatusClass(user.status)}`}>
                                  {getStatusLabel(user.status, language)}
                                </span>
                              </div>

                              {isSelf ? null : (
                                <div className="admin-actions admin-actions-compact">
                                  {promotionOptions.length > 0 ? (
                                    <RolePromotionControl
                                      action={promoteUserRoleAction}
                                      userId={user.id}
                                      options={promotionOptions}
                                      triggerLabel={language === "he" ? "קדם" : "Promote"}
                                      dialogTitle={language === "he" ? "בחר דרגה" : "Choose role"}
                                      dialogDescription={
                                        language === "he"
                                          ? "בחר לאיזו דרגה לקדם את המשתמש. השינוי יתעדכן מיד בכרטיס וברשימת החשבונות."
                                          : "Choose which role to assign. The card and account list will update right away."
                                      }
                                      cancelLabel={language === "he" ? "ביטול" : "Cancel"}
                                      pendingDescriptionLabel={
                                        language === "he" ? "מעדכן..." : "Updating..."
                                      }
                                    />
                                  ) : null}

                                  {demotionOptions.length > 0 ? (
                                    <RolePromotionControl
                                      action={makeUserAction}
                                      userId={user.id}
                                      options={demotionOptions}
                                      triggerLabel={language === "he" ? "החזר" : "Demote"}
                                      dialogTitle={
                                        language === "he" ? "בחר דרגה להחזרה" : "Choose lower role"
                                      }
                                      dialogDescription={
                                        language === "he"
                                          ? "בחר לאיזו דרגה להחזיר את המשתמש. רק אפשרויות חוקיות לפי התפקיד הנוכחי מוצגות כאן."
                                          : "Choose which lower role to return this user to. Only valid options for the current role are shown."
                                      }
                                      cancelLabel={language === "he" ? "ביטול" : "Cancel"}
                                      pendingDescriptionLabel={
                                        language === "he" ? "מעדכן..." : "Updating..."
                                      }
                                    />
                                  ) : null}

                                  {canBlock ? (
                                    <form action={blockUserAction}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <AdminActionButton
                                        className="button-danger button-small"
                                        idleLabel={language === "he" ? "חסום" : "Block"}
                                        pendingLabel={language === "he" ? "חוסם..." : "Blocking..."}
                                        confirmTitle={language === "he" ? "חסימת משתמש" : "Block user"}
                                        confirmMessage={
                                          language === "he"
                                            ? "המשתמש לא יוכל להתחבר עד לשחרור החסימה. מומלץ לבצע רק כשבאמת צריך."
                                            : "The user will not be able to sign in until the block is removed. Use this only when it is really needed."
                                        }
                                        confirmLabel={language === "he" ? "חסום משתמש" : "Block user"}
                                      />
                                    </form>
                                  ) : null}

                                  {canUnblock ? (
                                    <form action={unblockUserAction}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <AdminActionButton
                                        className="button-secondary button-small"
                                        idleLabel={language === "he" ? "שחרר" : "Unblock"}
                                        pendingLabel={language === "he" ? "משחרר..." : "Unblocking..."}
                                      />
                                    </form>
                                  ) : null}

                                  {canDelete ? (
                                    <form action={deleteUserAction}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <AdminActionButton
                                        className="button-danger button-small"
                                        idleLabel={language === "he" ? "מחק" : "Delete"}
                                        pendingLabel={language === "he" ? "מוחק..." : "Deleting..."}
                                        confirmTitle={language === "he" ? "מחיקת משתמש" : "Delete user"}
                                        confirmMessage={
                                          language === "he"
                                            ? "הפעולה מוחקת את המשתמש לצמיתות. כדאי לוודא שאין צורך לשמור את החשבון."
                                            : "This permanently deletes the user. Make sure the account is no longer needed."
                                        }
                                        confirmLabel={language === "he" ? "מחק משתמש" : "Delete user"}
                                      />
                                    </form>
                                  ) : null}

                                  {canManagePermissionAssignments ? (
                                    <Link
                                      className="button-secondary button-small"
                                      href={`/admin/permissions/users/${user.id}`}
                                    >
                                      {t.admin.permissions}
                                    </Link>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="admin-user-meta">
                            <span dir="auto">
                              <HighlightedText
                                text={formatUserDisplayName(user.firstName, user.lastName, user.username) || t.admin.noFullName}
                                query={activeQuery}
                              />
                            </span>
                          </div>

                          <UserPermissionEditor
                            language={language}
                            userId={user.id}
                            inheritedPermissionNames={inheritedPermissions}
                            directPermissionNames={directPermissions}
                            effectivePermissionNames={Array.from(
                              new Set([...inheritedPermissions, ...directPermissions]),
                            )}
                            availablePermissions={availablePermissions}
                            canEditDirectPermissions={canEditDirectPermissions}
                            canManagePermissionAssignments={canManagePermissionAssignments}
                            canManageRolePermission={isSuperAdminRole(currentAdmin.role)}
                            action={updateUserPermissionsAction}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
