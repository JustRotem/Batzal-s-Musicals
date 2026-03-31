"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { setPreferredLanguageAction } from "@/app/actions";
import { logoutAction } from "@/app/auth/logout/actions";
import UserAvatar from "@/components/UserAvatar";
import {
  formatMessage,
  getLanguageLabel,
  getRoleLabel,
  type AppLanguage,
  getTranslations,
} from "@/lib/i18n";

type UserMenuProps = {
  user: {
    username: string;
    email: string;
    avatarUrl: string | null;
    avatarVersion: string;
    status: "pending" | "active" | "blocked";
    role: "user" | "editor" | "admin" | "superadmin";
    canAccessAdminArea: boolean;
    canAccessCommentReports: boolean;
    openCommentReportsCount: number;
    canRequestEditorAccess: boolean;
    adminHref: string;
    language: string;
  } | null;
  language: AppLanguage;
};

export default function UserMenu({ user, language }: UserMenuProps) {
  const t = getTranslations(language);
  const [open, setOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => {
    const search = searchParams?.toString();
    return `${pathname || "/"}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (confirmLogoutOpen) {
          setConfirmLogoutOpen(false);
          return;
        }

        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [confirmLogoutOpen]);

  const canAccessAdmin = user?.canAccessAdminArea ?? false;
  const canRequestEditor = user?.canRequestEditorAccess ?? false;
  const isEditorRequestPending = user?.role === "user" && user.status === "pending";

  return (
    <div className={`profile-menu ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="profile-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          user
            ? formatMessage(t.header.accountMenuFor, { name: user.username })
            : t.header.openAccountMenu
        }
      >
        {user ? (
          <UserAvatar
            name={user.username}
            avatarUrl={user.avatarUrl}
            avatarVersion={user.avatarVersion}
            size="md"
            className="profile-trigger-avatar"
          />
        ) : (
          <span className="user-avatar user-avatar-md user-avatar-fallback profile-trigger-avatar">
            👤
          </span>
        )}

        <span className="profile-trigger-text">
          {user ? user.username : t.common.account}
        </span>
      </button>

      {open ? (
        <div className="profile-dropdown" role="menu">
          {user ? (
            <>
              <div className="profile-dropdown-header">
                <strong>{user.username}</strong>
                <span className="profile-dropdown-role">{getRoleLabel(user.role, language)}</span>
                <span className="profile-dropdown-email">{user.email}</span>
              </div>

              <div className="profile-dropdown-language">
                <span className="profile-dropdown-language-label">{t.header.languageSection}</span>
                <div className="profile-dropdown-language-actions">
                  {(["he", "en"] as const).map((option) => (
                    <form key={option} action={setPreferredLanguageAction}>
                      <input type="hidden" name="language" value={option} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <button
                        type="submit"
                        className={`profile-language-chip ${
                          option === language ? "is-active" : ""
                        }`}
                      >
                        {getLanguageLabel(option)}
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              <Link
                href="/profile?section=profile"
                className="profile-dropdown-link"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {t.common.account}
              </Link>

              {canAccessAdmin ? (
                <Link
                  href={user.adminHref}
                  className="profile-dropdown-link"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {t.header.adminArea}
                </Link>
              ) : null}

              {canRequestEditor ? (
                <Link
                  href="/profile#account-access-summary"
                  className="profile-dropdown-link"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {t.header.requestEditorAccess}
                </Link>
              ) : null}

              {isEditorRequestPending ? (
                <Link
                  href="/profile#account-access-summary"
                  className="profile-dropdown-link profile-dropdown-link-muted"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {t.header.editorRequestPending}
                </Link>
              ) : null}

              <button
                type="button"
                className="profile-dropdown-button"
                onClick={() => {
                  setOpen(false);
                  setConfirmLogoutOpen(true);
                }}
              >
                {t.common.logout}
              </button>
            </>
          ) : (
            <>
              <div className="profile-dropdown-language">
                <span className="profile-dropdown-language-label">{t.header.languageSection}</span>
                <div className="profile-dropdown-language-actions">
                  {(["he", "en"] as const).map((option) => (
                    <form key={option} action={setPreferredLanguageAction}>
                      <input type="hidden" name="language" value={option} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <button
                        type="submit"
                        className={`profile-language-chip ${
                          option === language ? "is-active" : ""
                        }`}
                      >
                        {getLanguageLabel(option)}
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              <Link
                href="/auth/login"
                className="profile-dropdown-link"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {t.header.login}
              </Link>

              <Link
                href="/auth/request-account"
                className="profile-dropdown-link"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {t.header.signup}
              </Link>
            </>
          )}
        </div>
      ) : null}

      {confirmLogoutOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="confirm-modal-overlay"
              onClick={() => setConfirmLogoutOpen(false)}
            >
              <div
                className="card confirm-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="confirm-modal-copy">
                  <h2 id="logout-confirm-title" className="panel-title">
                    {t.header.logoutConfirmTitle}
                  </h2>
                  <p className="viewer-text">
                    {t.header.logoutConfirmText}
                  </p>
                </div>

                <div className="button-row confirm-modal-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setConfirmLogoutOpen(false)}
                  >
                    {t.common.cancel}
                  </button>

                  <form action={logoutAction}>
                    <button className="button-danger" type="submit">
                      {t.header.logoutAction}
                    </button>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
