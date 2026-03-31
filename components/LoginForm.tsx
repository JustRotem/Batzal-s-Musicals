"use client";

import { useActionState } from "react";
import AuthPasswordField from "@/components/AuthPasswordField";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import TurnstileWidget from "@/components/TurnstileWidget";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import { loginAction } from "@/app/auth/login/actions";
import { type LoginFormState } from "@/lib/form-states";

type LoginFormProps = {
  showGoogleAuth?: boolean;
  turnstileSiteKey?: string | null;
  language: AppLanguage;
  initialState: LoginFormState;
};

export default function LoginForm({
  showGoogleAuth = false,
  turnstileSiteKey = null,
  language,
  initialState,
}: LoginFormProps) {
  const t = getTranslations(language);
  const [state, formAction] = useActionState<LoginFormState, FormData>(loginAction, initialState);
  const loginErrorMessages = t.auth.login.errors as Record<string, string>;
  const errorMessage =
    state.status === "error" && state.errorCode
      ? loginErrorMessages[state.errorCode] ?? null
      : null;

  return (
    <form
      action={formAction}
      className="form-grid auth-form auth-form-compact auth-form-login"
      data-lang={language}
      dir={language === "he" ? "rtl" : "ltr"}
      autoComplete="on"
      noValidate
    >
      {showGoogleAuth ? (
        <>
          <GoogleAuthButton mode="login" language={language} />
          <div className="auth-provider-divider" aria-hidden="true">
            <span>{t.auth.or}</span>
          </div>
        </>
      ) : null}

      <div className="field auth-field auth-credential-field">
        <label className="field-label auth-credential-label" htmlFor="login-email">
          {t.auth.email}
        </label>
        <input
          id="login-email"
          className="input"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={initialState.email}
          inputMode="email"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          onInvalid={(e) => {
            const input = e.currentTarget;
            if (input.validity.valueMissing) {
              input.setCustomValidity(t.auth.emailRequired);
            } else if (input.validity.typeMismatch) {
              input.setCustomValidity(t.auth.emailInvalid);
            } else {
              input.setCustomValidity(t.auth.emailGenericInvalid);
            }
          }}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
        />
        <div className="auth-field-help auth-credential-help">
          <a className="auth-recovery-link" href="/auth/forgot-email">
            {t.auth.login.forgotEmail}
          </a>
        </div>
      </div>

      <div className="field auth-field auth-credential-field">
        <label className="field-label auth-credential-label" htmlFor="login-password">
          {t.auth.password}
        </label>
        <AuthPasswordField
          id="login-password"
          className="input"
          name="password"
          autoComplete="current-password"
          language={language}
          required
          onInvalid={(e) => {
            const input = e.currentTarget;
            if (input.validity.valueMissing) {
              input.setCustomValidity(t.auth.passwordRequired);
            } else {
              input.setCustomValidity(t.auth.passwordInvalid);
            }
          }}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
        />
        <div className="auth-field-help auth-credential-help">
          <a className="auth-recovery-link" href="/auth/forgot-password">
            {t.auth.login.forgotPassword}
          </a>
        </div>
      </div>

      <div className="auth-form-feedback" aria-live="polite">
        {errorMessage ? (
          <p className="form-message error" role="alert">
            {errorMessage}
          </p>
        ) : (
          <span className="auth-form-feedback-placeholder" aria-hidden="true" />
        )}
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          action="login"
          resetKey={state.turnstileResetKey}
        />
      ) : null}

      <div className="button-row auth-actions">
        <AuthSubmitButton idleLabel={t.auth.login.submit} pendingLabel={t.auth.login.pending} />
      </div>
    </form>
  );
}
