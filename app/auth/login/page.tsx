import Link from "next/link";
import { redirect } from "next/navigation";
import { getMusicalsUrl, isAccountMode } from "@/lib/app-mode";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTranslations } from "@/lib/i18n";
import { sanitizeNextPath } from "@/lib/login-next";
import GoogleAuthButton from "@/components/GoogleAuthButton";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage(props: LoginPageProps) {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const searchParams = await props.searchParams;
  const next = sanitizeNextPath(searchParams?.next);

  if (user) {
    redirect(next ?? "/");
  }

  const errorMessages = t.auth.login.errors as Record<string, string>;
  // "unauthorized" only means "sign in first": go straight to Google instead of showing a screen.
  const errorCode = searchParams?.error && searchParams.error !== "unauthorized" ? searchParams.error : undefined;
  const errorMessage = errorCode ? errorMessages[errorCode] ?? null : null;
  const accountSite = isAccountMode();

  // On the musicals site signing in happens at the account site: go straight there unless something went wrong.
  const accountStartHref = next
    ? `/auth/account/start?next=${encodeURIComponent(next)}`
    : "/auth/account/start";

  // There is no sign-in screen: this page only exists to explain a failed sign-in.
  if (!errorCode) {
    redirect(
      accountSite
        ? next
          ? `/auth/google/start?next=${encodeURIComponent(next)}`
          : "/auth/google/start"
        : accountStartHref,
    );
  }

  const googleAuthEnabled = accountSite ? isGoogleAuthEnabled() : true;

  const closeHref = accountSite ? getMusicalsUrl() : "/";

  // A floating window over the site, not a page of its own: pressing outside it or the X goes back to the site.
  return (
    <div className="confirm-modal-overlay login-window-overlay">
      <Link className="login-window-backdrop" href={closeHref} aria-label={language === "he" ? "סגור" : "Close"} tabIndex={-1} />

      <section className="confirm-modal-card card login-window" role="dialog" aria-modal="true" aria-labelledby="login-window-title">
        <Link className="modal-x" href={closeHref} aria-label={language === "he" ? "סגור" : "Close"} title={language === "he" ? "סגור" : "Close"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <h1 id="login-window-title" className="panel-title">
          {language === "he" ? "ההתחברות לא הושלמה" : "Sign-in did not complete"}
        </h1>

        {errorMessage ? (
          <p className="form-message error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="login-window-actions">
          {googleAuthEnabled ? (
            <GoogleAuthButton language={language} next={next} href={accountSite ? undefined : accountStartHref} />
          ) : (
            <p className="form-message error" role="alert">
              {errorMessages["google-unavailable"]}
            </p>
          )}

          <Link className="button-secondary" href={closeHref}>
            {language === "he" ? "המשך כאורח" : "Continue as guest"}
          </Link>
        </div>
      </section>
    </div>
  );
}
