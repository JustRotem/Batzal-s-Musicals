import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getValidPasswordResetTarget } from "@/lib/password-reset";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

function InvalidResetState({ language }: { language: Awaited<ReturnType<typeof getCurrentLanguage>> }) {
  const t = getTranslations(language);

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge auth-state-badge-danger">{t.auth.resetPassword.invalidBadge}</div>
          <h1 className="viewer-title">{t.auth.resetPassword.invalidTitle}</h1>
          <p className="viewer-text">{t.auth.resetPassword.invalidText}</p>
          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/auth/forgot-password">
              {t.auth.resetPassword.requestNewLink}
            </Link>
            <Link className="button-primary" href="/auth/login">
              {t.common.backToLogin}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const currentUser = await getCurrentUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  if (currentUser) {
    redirect("/profile");
  }

  const searchParams = await props.searchParams;
  const token = searchParams?.token?.trim() ?? "";

  if (!token) {
    return <InvalidResetState language={language} />;
  }

  const resetTarget = await getValidPasswordResetTarget(token);

  if (!resetTarget) {
    return <InvalidResetState language={language} />;
  }

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge">{t.auth.resetPassword.badge}</div>
          <h1 className="viewer-title">{t.auth.resetPassword.title}</h1>
          <p className="viewer-text">{t.auth.resetPassword.description}</p>

          <ResetPasswordForm token={token} language={language} />
        </section>
      </div>
    </main>
  );
}
