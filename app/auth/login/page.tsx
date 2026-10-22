import { redirect } from "next/navigation";
import { isAccountMode } from "@/lib/app-mode";
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
  const errorCode = searchParams?.error;
  const errorMessage = errorCode ? errorMessages[errorCode] ?? null : null;
  const accountSite = isAccountMode();

  // On the musicals site signing in happens at the account site: go straight there unless something went wrong.
  const accountStartHref = next
    ? `/auth/account/start?next=${encodeURIComponent(next)}`
    : "/auth/account/start";

  if (!accountSite && !errorCode) {
    redirect(accountStartHref);
  }

  const googleAuthEnabled = accountSite ? isGoogleAuthEnabled() : true;

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-card">
          <h1 className="viewer-title">{t.auth.login.title}</h1>
          <p className="viewer-text">{t.auth.login.description}</p>

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

              <p className="viewer-text auth-success-note">{t.auth.login.googleOnlyNote}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
