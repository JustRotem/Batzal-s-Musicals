"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserRole } from "@prisma/client";
import {
  type AvailablePermission,
  type PermissionCategory,
  getPermissionCategoryLabel,
} from "@/lib/permissions";
import HighlightedText from "@/components/HighlightedText";
import { formatMessage, getTranslations, type AppLanguage } from "@/lib/i18n";

type RolePermissionsManagerProps = {
  language: AppLanguage;
  action: (formData: FormData) => void | Promise<void>;
  availablePermissions: readonly AvailablePermission[];
  roles: Array<{
    role: UserRole;
    label: string;
    description: string;
    selectedPermissionNames: string[];
    isProtectedRole: boolean;
  }>;
};

function matchesSearch(
  permission: AvailablePermission,
  query: string,
  language: AppLanguage,
) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [
    permission.key,
    permission.label,
    permission.description,
    getPermissionCategoryLabel(permission.category, language),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortByCategory(
  permissions: readonly AvailablePermission[],
  selectedPermissionNames: readonly string[],
  language: AppLanguage,
) {
  const selected = new Set(selectedPermissionNames);
  const groups = new Map<PermissionCategory, AvailablePermission[]>();

  for (const permission of permissions) {
    const current = groups.get(permission.category) ?? [];
    current.push(permission);
    groups.set(permission.category, current);
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    label: getPermissionCategoryLabel(category, language),
    permissions: items.map((permission) => ({
      ...permission,
      assigned: selected.has(permission.name),
    })),
  }));
}

export default function RolePermissionsManager({
  language,
  action,
  availablePermissions,
  roles,
}: RolePermissionsManagerProps) {
  const t = getTranslations(language);
  const [activeRole, setActiveRole] = useState<UserRole>(roles[0]?.role ?? UserRole.user);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | PermissionCategory>("all");
  const [, setSelectionVersion] = useState(0);
  const formRefs = useRef<Record<string, HTMLFormElement | null>>({});

  const filterItems: Array<{ value: "all" | PermissionCategory; label: string }> = [
    { value: "all", label: t.admin.allPermissionFilters },
    { value: "musicals", label: getPermissionCategoryLabel("musicals", language) },
    { value: "clips", label: getPermissionCategoryLabel("clips", language) },
    { value: "users", label: getPermissionCategoryLabel("users", language) },
    { value: "roles", label: getPermissionCategoryLabel("roles", language) },
    {
      value: "editor-requests",
      label: getPermissionCategoryLabel("editor-requests", language),
    },
  ];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  const visiblePermissions = availablePermissions.filter((permission) => {
    if (activeFilter !== "all" && permission.category !== activeFilter) {
      return false;
    }

    return matchesSearch(permission, search, language);
  });

  const activeFilterCount =
    activeFilter === "all"
      ? availablePermissions.length
      : availablePermissions.filter((permission) => permission.category === activeFilter).length;
  const activeRoleData = useMemo(
    () => roles.find((role) => role.role === activeRole) ?? roles[0],
    [activeRole, roles],
  );

  useEffect(() => {
    if (!roles.some((role) => role.role === activeRole) && roles[0]) {
      setActiveRole(roles[0].role);
    }
  }, [activeRole, roles]);

  function updateRoleSelection(role: UserRole, checked: boolean) {
    const form = formRefs.current[role];

    if (!form) {
      return;
    }

    const checkboxes = form.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="permissions"]:not(:disabled)',
    );

    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
    });
  }

  function areAllRoleSelectionsChecked(role: UserRole) {
    const form = formRefs.current[role];

    if (!form) {
      const active = roles.find((item) => item.role === role);
      if (!active) {
        return false;
      }

      return (
        visiblePermissions.length > 0 &&
        visiblePermissions.every((permission) => active.selectedPermissionNames.includes(permission.name))
      );
    }

    const checkboxes = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="permissions"]:not(:disabled)'),
    );

    return checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
  }

  function toggleRoleSelections(role: UserRole) {
    updateRoleSelection(role, !areAllRoleSelectionsChecked(role));
    setSelectionVersion((value) => value + 1);
  }

  function isRolePermissionDirty(role: UserRole, permissionName: string, assignedByDefault: boolean) {
    const form = formRefs.current[role];
    if (!form) {
      return false;
    }

    const checkbox = form.querySelector<HTMLInputElement>(
      `input[type="checkbox"][name="permissions"][value="${permissionName}"]`,
    );

    if (!checkbox) {
      return false;
    }

    return checkbox.checked !== assignedByDefault;
  }

  function isActiveRoleDirty() {
    if (!activeRoleData) {
      return false;
    }

    return visiblePermissions.some((permission) =>
      isRolePermissionDirty(
        activeRoleData.role,
        permission.name,
        activeRoleData.selectedPermissionNames.includes(permission.name),
      ),
    );
  }

  return (
    <div className="admin-permission-manager">
      <div className="admin-permission-toolbar">
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="permission-search">
            {t.admin.searchPermissionsLabel}
          </label>
          <input
            id="permission-search"
            className="input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t.admin.searchPermissionsPlaceholder}
            dir="ltr"
          />
        </div>

        <div
          className="admin-permission-filter-row"
          role="tablist"
          aria-label={t.admin.filterPermissionsAria}
        >
          {filterItems.map((item) => {
            const count =
              item.value === "all"
                ? availablePermissions.length
                : availablePermissions.filter((permission) => permission.category === item.value)
                    .length;

            return (
              <button
                key={item.value}
                type="button"
                className={`admin-filter-chip ${activeFilter === item.value ? "is-active" : ""}`}
                onClick={() => setActiveFilter(item.value)}
              >
                <span>{item.label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>

        <p className="admin-section-text" style={{ margin: 0 }}>
          {formatMessage(t.admin.visiblePermissionsSummary, {
            visible: visiblePermissions.length,
            total: activeFilterCount,
          })}
        </p>
      </div>

      {visiblePermissions.length === 0 ? (
        <div className="link-card admin-empty-state admin-permission-empty-state">
          {t.admin.noPermissionMatches}
        </div>
      ) : (
        <>
          <div className="admin-role-selector" style={{ marginTop: 24 }}>
            {roles.map((role) => {
              const assignedCount = role.selectedPermissionNames.length;
              return (
                <button
                  key={role.role}
                  type="button"
                  className={`admin-role-selector-card ${activeRole === role.role ? "is-active" : ""}`}
                  onClick={() => setActiveRole(role.role)}
                >
                  <div className="admin-role-selector-head">
                    <strong>{role.label}</strong>
                    <span className={`admin-badge ${role.role}`}>{role.label}</span>
                  </div>
                  <span className="admin-role-permission-count">
                    {formatMessage(t.admin.assignedPermissionsCount, { count: assignedCount })}
                  </span>
                  <span className="admin-role-selector-text">{role.description}</span>
                </button>
              );
            })}
          </div>

          {activeRoleData ? (() => {
            const groupedPermissions = sortByCategory(
              visiblePermissions,
              activeRoleData.selectedPermissionNames,
              language,
            );
            const assignedPermissions = availablePermissions.filter((permission) =>
              activeRoleData.selectedPermissionNames.includes(permission.name),
            );

            return (
              <section
                className={`admin-user-card admin-role-permission-card admin-role-permission-card-active ${
                  activeRoleData.role === "superadmin" ? "is-superadmin" : ""
                } ${isActiveRoleDirty() ? "is-dirty" : ""}`}
                style={{ marginTop: 20 }}
              >
                <div className="admin-section-heading">
                  <div className="admin-role-permission-heading">
                    <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
                      {activeRoleData.label}
                    </h2>
                    <span className="admin-role-permission-count">
                      {formatMessage(t.admin.assignedPermissionsCount, {
                        count: assignedPermissions.length,
                      })}
                    </span>
                    {isActiveRoleDirty() ? (
                      <span className="admin-role-permission-count admin-role-permission-count-dirty">
                        {t.admin.unsavedChanges}
                      </span>
                    ) : null}
                  </div>
                  <span className={`admin-badge ${activeRoleData.role}`}>{activeRoleData.label}</span>
                </div>

                <p className="admin-section-text" style={{ marginTop: 0 }}>
                  {activeRoleData.description}
                </p>

                <div className="admin-permission-summary">
                  {assignedPermissions.length > 0 ? (
                    assignedPermissions.map((permission) => (
                      <span key={permission.name} className="admin-permission-pill">
                        <HighlightedText text={permission.label} query={search} />
                        <small>
                          <HighlightedText text={permission.key} query={search} />
                        </small>
                      </span>
                    ))
                  ) : (
                    <span className="admin-permission-empty">{t.admin.noAssignedPermissions}</span>
                  )}
                </div>

                <form
                  action={action}
                  className="admin-permission-form"
                  ref={(node) => {
                    formRefs.current[activeRoleData.role] = node;
                  }}
                  onReset={() => {
                    window.setTimeout(() => {
                      setSelectionVersion((value) => value + 1);
                    }, 0);
                  }}
                >
                  <input type="hidden" name="role" value={activeRoleData.role} />

                  {!activeRoleData.isProtectedRole ? (
                    <div className="admin-permission-bulk-actions">
                      <button
                        type="button"
                        className="button-secondary button-small"
                        onClick={() => toggleRoleSelections(activeRoleData.role)}
                      >
                        {areAllRoleSelectionsChecked(activeRoleData.role) ? t.admin.clearAll : t.admin.selectAll}
                      </button>
                    </div>
                  ) : (
                    <p className="admin-section-text" style={{ margin: 0 }}>
                      {t.admin.protectedRoleNote}
                    </p>
                  )}

                  <div className="admin-permission-group-list">
                    {groupedPermissions.map((group) => (
                      <section key={`${activeRoleData.role}-${group.category}`} className="admin-permission-group">
                        <div className="admin-permission-group-header">
                          <strong>{group.label}</strong>
                          <span>
                            {group.permissions.filter((permission) => permission.assigned).length}/
                            {group.permissions.length}
                          </span>
                        </div>

                        <div className="admin-permission-grid">
                          {group.permissions.map((permission) => (
                            <label
                              key={`${activeRoleData.role}-${permission.name}`}
                              className={`admin-permission-option ${
                                activeRoleData.isProtectedRole ? "is-disabled" : ""
                              } ${permission.assigned ? "is-assigned" : ""} ${
                                isRolePermissionDirty(activeRoleData.role, permission.name, permission.assigned)
                                  ? "is-dirty"
                                  : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                name="permissions"
                                value={permission.name}
                                defaultChecked={permission.assigned}
                                disabled={activeRoleData.isProtectedRole}
                                onChange={() => setSelectionVersion((value) => value + 1)}
                              />
                              <div className="admin-permission-option-copy">
                                <strong>
                                  <HighlightedText text={permission.label} query={search} />
                                </strong>
                                <span dir="ltr">
                                  <HighlightedText text={permission.key} query={search} />
                                </span>
                                <span>
                                  <HighlightedText
                                    text={permission.description}
                                    query={search}
                                  />
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  <div className="button-row" style={{ marginTop: 0 }}>
                    <button
                      type="reset"
                      className="button-secondary"
                      disabled={activeRoleData.isProtectedRole}
                    >
                      {t.common.cancelChanges}
                    </button>
                    <button
                      type="submit"
                      className="button-primary"
                      disabled={activeRoleData.isProtectedRole}
                    >
                      {t.common.saveChanges}
                    </button>
                  </div>
                </form>
              </section>
            );
          })() : null}
        </>
      )}
    </div>
  );
}
