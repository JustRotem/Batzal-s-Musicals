import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTranslations } from "@/lib/i18n";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import LoginForm from "@/components/LoginForm";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
    email?: string;
  }>;
};

function getSuccessMessage(success: string | undefined, messages: Record<string, string>) {
  if (!success) {
    return null;
  }

  return messages[success] ?? null;
}

export default async function LoginPage(props: LoginPageProps) {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  if (user) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const successMessage = getSuccessMessage(searchParams?.success, t.auth.login.success);
  const submittedEmail = searchParams?.email ?? "";
  const initialErrorCode = searchParams?.error;
  const googleAuthEnabled = isGoogleAuthEnabled();
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-card">
          <h1 className="viewer-title">{t.auth.login.title}</h1>
          <p className="viewer-text">{t.auth.login.description}</p>

          {successMessage ? (
            <div className="auth-success-card">
              <p className="form-message success" style={{ marginTop: 0 }}>
                {successMessage}
              </p>
              {submittedEmail ? (
                <div className="auth-readonly-card">
                  <span className="auth-readonly-label">{t.auth.login.successVerifiedEmailLabel}</span>
                  <strong className="auth-readonly-value" dir="ltr">
                    {submittedEmail}
                  </strong>
                </div>
              ) : null}
              <p className="viewer-text auth-success-note">
                {t.auth.login.successVerifiedNote}
              </p>
            </div>
          ) : null}

          <div className="auth-container">
            <LoginForm
              showGoogleAuth={googleAuthEnabled}
              turnstileSiteKey={turnstileSiteKey}
              language={language}
              initialState={{
                status: initialErrorCode ? "error" : "idle",
                email: submittedEmail,
                errorCode: initialErrorCode,
                turnstileResetKey: 0,
              }}
            />
          </div>

          <div className="auth-entry-footer">
            <div className="auth-entry-card">
              <strong>{t.auth.login.noAccountTitle}</strong>
              <span>{t.auth.login.noAccountText}</span>
              <a className="button-secondary" href="/auth/request-account">
                {t.common.signup}
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
