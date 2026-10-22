"use client";

import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/auth/logout/actions";
import type { AppLanguage } from "@/lib/i18n";

// The account button and menu of the shared Batzal bar. It renders exactly the markup of the shared script
// (batzal.js, used by the QR and control-panel sites), so the button looks and behaves the same on every site.
type BatzalAccountMenuProps = {
  user: {
    username: string;
    email: string;
    avatarUrl: string | null;
    avatarVersion: string;
    role: string;
  } | null;
  language: AppLanguage;
  accountUrl: string;
  signInHref: string;
  // Entries that exist only on this site (shown after the shared ones).
  extras?: Array<{ href: string; label: string; badge?: number }>;
};

const TEXT = {
  he: {
    signIn: "התחברות",
    account: "החשבון וההגדרות שלי",
    users: "ניהול משתמשים והרשאות",
    signOut: "התנתק",
  },
  en: {
    signIn: "Sign in",
    account: "My account and settings",
    users: "Users and permissions",
    signOut: "Sign out",
  },
} as const;

export default function BatzalAccountMenu({
  user,
  language,
  accountUrl,
  signInHref,
  extras = [],
}: BatzalAccountMenuProps) {
  const t = TEXT[language];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <a className="bz-signin" href={signInHref}>
        {t.signIn}
      </a>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const avatarSrc = user.avatarUrl
    ? `${user.avatarUrl}${user.avatarUrl.startsWith("/") ? `?v=${encodeURIComponent(user.avatarVersion)}` : ""}`
    : null;

  return (
    <div className="bz-acct" ref={wrapRef}>
      <button
        type="button"
        className="bz-acct-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ini">{user.username.trim().charAt(0).toUpperCase()}</span>
        )}
        <span className="name">{user.username}</span>
      </button>

      {open ? (
        <div className="bz-acct-menu" role="menu">
          <div className="bz-acct-head">
            <strong>{user.username}</strong>
            <small>{user.email}</small>
          </div>
          <a href={`${accountUrl}/profile`} role="menuitem">
            {t.account}
          </a>
          {isAdmin ? (
            <a href={`${accountUrl}/admin/permissions`} role="menuitem">
              {t.users}
            </a>
          ) : null}
          {extras.map((item) => (
            <a key={item.href} href={item.href} role="menuitem">
              {item.label}
              {item.badge ? <span className="bz-acct-badge">{item.badge}</span> : null}
            </a>
          ))}
          <hr />
          <form action={logoutAction}>
            <button type="submit" role="menuitem">
              {t.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
