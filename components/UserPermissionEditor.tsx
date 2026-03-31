"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  type AvailablePermission,
  type PermissionCategory,
  PERMISSIONS,
  getPermissionCategoryLabel,
} from "@/lib/permissions";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type UserPermissionEditorProps = {
  language: AppLanguage;
  userId: string;
  backHref?: string;
  userLabel?: string;
  inheritedPermissionNames: string[];
  directPermissionNames: string[];
  effectivePermissionNames: string[];
  availablePermissions: readonly AvailablePermission[];
  canEditDirectPermissions: boolean;
  canManagePermissionAssignments: boolean;
  canManageRolePermission: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

function groupPermissionNames(
  availablePermissions: readonly AvailablePermission[],
  selectedPermissionNames: readonly string[],
  language: AppLanguage,
) {
  const selected = new Set(selectedPermissionNames);
  const groups = new Map<PermissionCategory, AvailablePermission[]>();

  for (const permission of availablePermissions) {
    if (!selected.has(permission.name)) {
      continue;
    }

    const current = groups.get(permission.category) ?? [];
    current.push(permission);
    groups.set(permission.category, current);
  }

  return Array.from(groups.entries()).map(([category, permissions]) => ({
    category,
    label: getPermissionCategoryLabel(category, language),
    permissions,
  }));
}

function groupEditablePermissions(
  availablePermissions: readonly AvailablePermission[],
  language: AppLanguage,
) {
  const groups = new Map<PermissionCategory, AvailablePermission[]>();

  for (const permission of availablePermissions) {
    const current = groups.get(permission.category) ?? [];
    current.push(permission);
    groups.set(permission.category, current);
  }

  return Array.from(groups.entries()).map(([category, permissions]) => ({
    category,
    label: getPermissionCategoryLabel(category, language),
    permissions,
  }));
}

export default function UserPermissionEditor({
  language,
  userId,
  backHref,
  userLabel,
  inheritedPermissionNames,
  directPermissionNames,
  effectivePermissionNames,
  availablePermissions,
  canEditDirectPermissions,
  canManagePermissionAssignments,
  canManageRolePermission,
  action,
}: UserPermissionEditorProps) {
  const t = getTranslations(language);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [, setSelectionVersion] = useState(0);
  const effectiveGroups = groupPermissionNames(
    availablePermissions,
    effectivePermissionNames,
    language,
  );
  const editableGroups = groupEditablePermissions(availablePermissions, language);

  function updateDirectSelections(checked: boolean) {
    const form = formRef.current;

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

  function areAllDirectSelectionsChecked() {
    const form = formRef.current;

    if (!form) {
      return directPermissionNames.length > 0 && directPermissionNames.length === editableGroups.reduce((sum, group) => sum + group.permissions.filter((permission) => {
        const isRestricted =
          !canManageRolePermission && permission.name === PERMISSIONS.roleManage;
        return !isRestricted;
      }).length, 0);
    }

    const checkboxes = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="permissions"]:not(:disabled)'),
    );

    return checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
  }

  function toggleDirectSelections() {
    updateDirectSelections(!areAllDirectSelectionsChecked());
    setSelectionVersion((value) => value + 1);
  }

  function isDirectPermissionDirty(permissionName: string, assignedByDefault: boolean) {
    const form = formRef.current;
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

  function isUserPermissionEditorDirty() {
    return editableGroups.some((group) =>
      group.permissions.some((permission) =>
        isDirectPermissionDirty(permission.name, directPermissionNames.includes(permission.name)),
      ),
    );
  }

  return (
    <div className={`admin-permission-panel admin-permission-panel-user admin-role-permission-card admin-role-permission-card-active ${isUserPermissionEditorDirty() ? "is-dirty" : ""}`}>
      <div className="admin-user-permission-context">
        <div className="admin-user-permission-context-copy">
          <strong>{t.admin.userSpecificAccessTitle}</strong>
          <span>
            {userLabel
              ? language === "he"
                ? `כאן עורכים רק את ההרשאות הישירות של ${userLabel}, בלי לשנות את ההרשאות ברמת התפקיד.`
                : `You are editing direct permissions only for ${userLabel}, without changing the role-level bundle.`
              : t.admin.userSpecificAccessText}
          </span>
        </div>
        {isUserPermissionEditorDirty() ? (
          <span className="admin-role-permission-count admin-role-permission-count-dirty">
            {t.admin.unsavedChanges}
          </span>
        ) : null}
        {backHref ? (
          <Link className="button-secondary button-small" href={backHref}>
            {t.admin.backToRolePermissions}
          </Link>
        ) : null}
      </div>

      <div className="admin-permission-columns admin-permission-columns-single">
        <section className="admin-permission-column admin-permission-column-full">
          <div className="admin-permission-column-head">
            <strong className="admin-permission-column-title">
              {t.admin.effectivePermissions}{" "}
              <span className="admin-permission-count-text">({effectivePermissionNames.length})</span>
            </strong>
          </div>

          {effectiveGroups.length > 0 ? (
            <div className="admin-permission-group-list compact">
              {effectiveGroups.map((group) => (
                <section key={`${userId}-effective-${group.category}`} className="admin-permission-group compact">
                  <div className="admin-permission-group-header">
                    <strong>
                      {group.label}{" "}
                      <span className="admin-permission-count-text">({group.permissions.length})</span>
                    </strong>
                  </div>
                  <div className="admin-permission-summary">
                    {group.permissions.map((permission) => {
                      const isDirect = directPermissionNames.includes(permission.name);

                      return (
                        <span
                          key={`${userId}-effective-${permission.name}`}
                          className={`admin-permission-pill ${isDirect ? "admin-permission-pill-direct" : ""}`}
                        >
                          {permission.label}
                          {isDirect ? <small>{t.admin.directRoleChip}</small> : null}
                        </span>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <span className="admin-permission-empty">{t.admin.noEffectivePermissions}</span>
          )}
        </section>
      </div>

      {canManagePermissionAssignments ? (
        canEditDirectPermissions ? (
          <form
            action={action}
            className="admin-permission-form"
            ref={formRef}
            onReset={() => {
              window.setTimeout(() => {
                setSelectionVersion((value) => value + 1);
              }, 0);
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            {backHref ? <input type="hidden" name="returnTo" value={backHref} /> : null}

            <div className="admin-permission-edit-intro">
              <strong>{t.admin.editDirectPermissions}</strong>
              <span>{t.admin.editDirectPermissionsText}</span>
            </div>

            <div className="admin-permission-bulk-actions">
              <button
                type="button"
                className="button-secondary button-small"
                onClick={toggleDirectSelections}
              >
                {areAllDirectSelectionsChecked() ? t.admin.clearAll : t.admin.selectAll}
              </button>
            </div>

            <div className="admin-permission-group-list">
              {editableGroups.map((group) => (
                <section key={`${userId}-edit-${group.category}`} className="admin-permission-group">
                  <div className="admin-permission-group-header">
                    <strong>{group.label}</strong>
                    <span>
                      {
                        group.permissions.filter((permission) =>
                          directPermissionNames.includes(permission.name),
                        ).length
                      }
                      /{group.permissions.length}
                    </span>
                  </div>

                  <div className="admin-permission-grid">
                    {group.permissions.map((permission) => {
                      const isRestricted =
                        !canManageRolePermission && permission.name === PERMISSIONS.roleManage;
                      const isDirectlyAssigned = directPermissionNames.includes(permission.name);
                      const isInherited = inheritedPermissionNames.includes(permission.name);

                      return (
                        <label
                          key={`${userId}-${permission.name}`}
                          className={`admin-permission-option ${
                            isRestricted ? "is-disabled" : ""
                          } ${isDirectlyAssigned ? "is-assigned-direct" : ""} ${
                            isInherited ? "is-inherited" : ""
                          } ${
                            isDirectPermissionDirty(permission.name, isDirectlyAssigned)
                              ? "is-dirty"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="permissions"
                            value={permission.name}
                            defaultChecked={isDirectlyAssigned}
                            disabled={isRestricted}
                            onChange={() => setSelectionVersion((value) => value + 1)}
                          />
                          <div className="admin-permission-option-copy">
                            <strong>{permission.label}</strong>
                            <span dir="ltr">{permission.key}</span>
                            <span>{permission.description}</span>
                            {isInherited ? (
                              <small className="admin-permission-helper-chip">
                                {t.admin.inheritedByRole}
                              </small>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="button-row" style={{ marginTop: 0 }}>
              <button type="submit" className="button-primary">
                {t.common.saveChanges}
              </button>
              {backHref ? (
                <Link href={backHref} className="button-secondary">
                  {t.common.cancelChanges}
                </Link>
              ) : (
                <button type="reset" className="button-secondary">
                  {t.common.cancelChanges}
                </button>
              )}
            </div>
          </form>
        ) : (
          <p className="admin-section-text" style={{ margin: 0 }}>
            {t.admin.directPermissionsReadOnly}
          </p>
        )
      ) : null}
    </div>
  );
}
