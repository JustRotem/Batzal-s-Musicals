import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function ForgotPasswordPage(props: ForgotPasswordPageProps) {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  if (user) {
    redirect("/profile");
  }

  await props.searchParams;
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge">{t.auth.forgotPassword.badge}</div>
          <h1 className="viewer-title">{t.auth.forgotPassword.title}</h1>
          <p className="viewer-text">{t.auth.forgotPassword.description}</p>

          <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} language={language} />

          <div className="auth-help-list">
            <div className="auth-help-item">
              <strong>{t.auth.forgotPassword.howItWorksTitle}</strong>
              <span>{t.auth.forgotPassword.howItWorksText}</span>
            </div>
            <div className="auth-help-item">
              <strong>{t.auth.forgotPassword.phoneTitle}</strong>
              <span>{t.auth.forgotPassword.phoneText}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
