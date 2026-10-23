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

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-card">
          <h1 className="viewer-title">{language === "he" ? "ההתחברות לא הושלמה" : "Sign-in did not complete"}</h1>

          <div className="auth-container">
            <div className="form-grid auth-form auth-form-compact auth-form-login">
              {googleAuthEnabled ? (
                <GoogleAuthButton
                  language={language}
                  next={next}
                  href={accountSite ? undefined : accountStartHref}
                />
              ) : (
                <p className="form-message error" role="alert">
                  {errorMessages["google-unavailable"]}
                </p>
              )}

              <div className="auth-form-feedback" aria-live="polite">
                {errorMessage ? (
                  <p className="form-message error" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <Link className="button-secondary" href={accountSite ? getMusicalsUrl() : "/"}>
                {language === "he" ? "המשך כאורח" : "Continue as guest"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
