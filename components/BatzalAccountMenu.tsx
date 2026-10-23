"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/app/auth/logout/actions";
import { setPreferredLanguageAction, setPreferredThemeAction } from "@/app/actions";
import { getRankInfo, RANK_LEVELS } from "@/lib/ranks";
import type { AppLanguage } from "@/lib/i18n";

// The sign-in button, rank chip, avatar button and menu of the shared Batzal bar. It renders the same markup as the
// shared script (batzal.js, used by the QR and control-panel sites): change both together.
type BatzalAccountMenuProps = {
  user: {
    username: string;
    email: string;
    avatarUrl: string | null;
    avatarVersion: string;
    role: string;
  } | null;
  // null = follow the system setting
  theme: "light" | "dark" | null;
  language: AppLanguage;
  accountUrl: string;
  signInHref: string;
  // Entries that exist only on this site (shown after the shared ones).
  extras?: Array<{ href: string; label: string; badge?: number }>;
};

const TEXT = {
  he: {
    signIn: "התחברות",
    google: "המשך עם Google",
    account: "החשבון שלי",
    language: "שפה",
    theme: "בהירות",
    dark: "כהה",
    light: "בהיר",
    signOut: "התנתק",
    confirmTitle: "להתנתק?",
    confirmText: "תתנתק מהאתר הזה. אפשר להתחבר שוב בכל רגע.",
    cancel: "ביטול",
    level: "דרגה",
  },
  en: {
    signIn: "Sign in",
    google: "Continue with Google",
    account: "My account",
    language: "Language",
    theme: "Appearance",
    dark: "Dark",
    light: "Light",
    signOut: "Sign out",
    confirmTitle: "Sign out?",
    confirmText: "You will be signed out of this site. You can sign in again at any time.",
    cancel: "Cancel",
    level: "Rank",
  },
} as const;

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

// After signing in, come back to the page (and the clip) the person was on.
function withReturnTo(href: string) {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (here === "/" || here.startsWith("/auth/")) {
    return href;
  }

  return `${href}${href.includes("?") ? "&" : "?"}next=${encodeURIComponent(here)}`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.92h5.45c-.22 1.26-.96 2.33-2.07 3.05l3.34 2.59c1.95-1.8 3.08-4.45 3.08-7.61 0-.72-.06-1.4-.18-2.06H12Z" />
      <path fill="#34A853" d="M12 22c2.79 0 5.13-.92 6.84-2.49l-3.34-2.59c-.93.63-2.11 1-3.5 1-2.69 0-4.96-1.81-5.77-4.24H2.78v2.67A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#4A90E2" d="M6.23 13.68A5.96 5.96 0 0 1 5.91 12c0-.58.1-1.14.32-1.68V7.65H2.78A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.35l3.15-2.67Z" />
      <path fill="#FBBC05" d="M12 6.08c1.52 0 2.88.52 3.95 1.54l2.96-2.96C17.12 2.99 14.79 2 12 2 8.09 2 4.73 4.24 3.08 7.65l3.15 2.67c.81-2.43 3.08-4.24 5.77-4.24Z" />
    </svg>
  );
}

function PreferenceRows({
  t,
  language,
  theme,
  redirectTo,
}: {
  t: (typeof TEXT)[AppLanguage];
  language: AppLanguage;
  theme: "light" | "dark" | null;
  redirectTo: string;
}) {
  // Without a saved choice the page follows the system, so show what the system currently gives.
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setSystemTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  const activeTheme = theme ?? systemTheme;

  return (
    <>
      <div className="bz-row">
        <span>{t.language}</span>
        <div className="bz-seg">
          {(["he", "en"] as const).map((option) => (
            <form key={option} action={setPreferredLanguageAction}>
              <input type="hidden" name="language" value={option} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button type="submit" aria-pressed={option === language}>
                {option === "he" ? "עברית" : "English"}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="bz-row">
        <span>{t.theme}</span>
        <div className="bz-seg">
          {(["light", "dark"] as const).map((option) => (
            <form key={option} action={setPreferredThemeAction}>
              <input type="hidden" name="theme" value={option} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button type="submit" aria-pressed={option === activeTheme}>
                {option === "light" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />
                  </svg>
                )}
                {option === "light" ? t.light : t.dark}
              </button>
            </form>
          ))}
        </div>
      </div>
    </>
  );
}

export default function BatzalAccountMenu({
  user,
  theme,
  language,
  accountUrl,
  signInHref,
  extras = [],
}: BatzalAccountMenuProps) {
  const t = TEXT[language];
  const [open, setOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const signInRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const redirectTo = `${pathname || "/"}${search ? `?${search}` : ""}`;

  // One network: signed in (or out) at one Batzal site means the same here. The account site answers 200 to
  // /api/preferences when this browser is signed in there and 401 when it is not.
  const signedIn = Boolean(user);
  const ownAccountSite = signInHref.startsWith("/auth/google");

  useEffect(() => {
    if (ownAccountSite) return;

    let cancelled = false;

    const check = async () => {
      let status = 0;

      try {
        status = (await fetch(`${accountUrl}/api/preferences`, { credentials: "include" })).status;
      } catch {
        return;
      }

      if (cancelled) return;

      const tried = Number(sessionStorage.getItem("bz-sso-try") || 0);
      const recently = Date.now() - tried < 30_000;

      if (!signedIn && status === 200 && !recently) {
        sessionStorage.setItem("bz-sso-try", String(Date.now()));
        window.location.href = withReturnTo(signInHref);
      } else if (signedIn && status === 401 && !recently) {
        sessionStorage.setItem("bz-sso-try", String(Date.now()));
        startTransition(() => {
          void logoutAction();
        });
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, accountUrl, signInHref, ownAccountSite]);

  useDismiss(open, () => setOpen(false), wrapRef);
  useDismiss(popOpen, () => setPopOpen(false), signInRef);

  if (!user) {
    return (
      <div className="bz-signin-wrap" ref={signInRef}>
        <button
          type="button"
          className="bz-guest-btn"
          aria-haspopup="true"
          aria-expanded={popOpen}
          aria-label={t.signIn}
          title={t.signIn}
          onClick={() => setPopOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0116 0" />
          </svg>
        </button>
        {popOpen ? (
          <div className="bz-pop">
            <a
              className="bz-google"
              href={signInHref}
              onClick={(event) => {
                event.currentTarget.href = withReturnTo(signInHref);
              }}
            >
              <GoogleIcon />
              {t.google}
            </a>
            <hr />
            <PreferenceRows t={t} language={language} theme={theme} redirectTo={redirectTo} />
          </div>
        ) : null}
      </div>
    );
  }

  const rank = getRankInfo(user.role, language);
  const avatarSrc = user.avatarUrl
    ? `${user.avatarUrl}${user.avatarUrl.startsWith("/") ? `?v=${encodeURIComponent(user.avatarVersion)}` : ""}`
    : null;

  return (
    <div className="bz-acct" ref={wrapRef}>
      <div className="bz-rankwrap">
        <button type="button" className="bz-rank">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" />
          </svg>
          <span>{rank.label}</span>
        </button>
        <div className="bz-rank-tip" role="tooltip">
          <strong>{rank.label}</strong>
          <p>{rank.description}</p>
          <div className="bz-pips">
            {Array.from({ length: RANK_LEVELS }, (_, index) => (
              <i
                key={index}
                className={index < rank.level ? "on" : undefined}
                style={{ "--i": index + 1 } as React.CSSProperties}
              />
            ))}
            <span>
              {t.level} {rank.level}/{RANK_LEVELS}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="bz-acct-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={user.username}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ini">{user.username.trim().charAt(0).toUpperCase()}</span>
        )}
      </button>

      {open ? (
        <div className="bz-acct-menu" role="menu">
          <div className="bz-acct-head">
            <strong dir="auto">{user.username}</strong>
            <small>{user.email}</small>
          </div>
          <a href={`${accountUrl}/profile`} role="menuitem">
            {t.account}
          </a>

          <PreferenceRows t={t} language={language} theme={theme} redirectTo={redirectTo} />

          {extras.map((item) => (
            <a key={item.href} href={item.href} role="menuitem">
              {item.label}
              {item.badge ? <span className="bz-acct-badge">{item.badge}</span> : null}
            </a>
          ))}
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            {t.signOut}
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div
          className="bz-confirm"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <div className="bz-confirm-box">
            <h2>{t.confirmTitle}</h2>
            <p>{t.confirmText}</p>
            <div className="bz-confirm-actions">
              <button type="button" onClick={() => setConfirming(false)} autoFocus>
                {t.cancel}
              </button>
              <form action={logoutAction}>
                <button type="submit" className="bz-danger">
                  {t.signOut}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
