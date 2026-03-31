import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTranslations } from "@/lib/i18n";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { requestAccountAction } from "./actions";
import RequestAccountForm from "@/components/RequestAccountForm";

type RequestAccountPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error: string | undefined, messages: Record<string, string>) {
  if (!error) {
    return null;
  }

  return messages[error] ?? null;
}

function getPasswordErrorMessage(error: string | undefined, messages: Record<string, string>) {
  if (!error) {
    return null;
  }

  return messages[error] ?? null;
}

export default async function RequestAccountPage(
  props: RequestAccountPageProps,
) {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  if (user) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const errorMessage = getErrorMessage(searchParams?.error, t.auth.requestAccount.errors);
  const passwordErrorMessage = getPasswordErrorMessage(
    searchParams?.error,
    t.auth.requestAccount.passwordErrors,
  );
  const googleAuthEnabled = isGoogleAuthEnabled();
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-card">
          <h1 className="viewer-title">{t.auth.requestAccount.title}</h1>
          <p className="viewer-text">{t.auth.requestAccount.description}</p>

          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="auth-container">
            <RequestAccountForm
              action={requestAccountAction}
              passwordError={passwordErrorMessage}
              showGoogleAuth={googleAuthEnabled}
              turnstileSiteKey={turnstileSiteKey}
              language={language}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
