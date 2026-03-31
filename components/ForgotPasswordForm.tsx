"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import TurnstileWidget from "@/components/TurnstileWidget";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import {
  requestPasswordResetAction,
} from "@/app/auth/forgot-password/actions";
import {
  INITIAL_FORGOT_PASSWORD_STATE,
  type ForgotPasswordFormState,
} from "@/lib/form-states";

type ForgotPasswordFormProps = {
  turnstileSiteKey?: string | null;
  language: AppLanguage;
};

export default function ForgotPasswordForm({
  turnstileSiteKey = null,
  language,
}: ForgotPasswordFormProps) {
  const t = getTranslations(language);
  const [state, formAction] = useActionState<ForgotPasswordFormState, FormData>(
    requestPasswordResetAction,
    INITIAL_FORGOT_PASSWORD_STATE,
  );
  const [email, setEmail] = useState("");

  useEffect(() => {
    setEmail(state.email);
  }, [state.email]);

  return (
    <form action={formAction} className="form-grid auth-form" noValidate>
      <input type="hidden" name="language" value={language} />
      <div className="field auth-field">
        <label className="field-label" htmlFor="forgot-password-email">
          {t.auth.forgotPassword.accountEmail}
        </label>
        <input
          id="forgot-password-email"
          className={`input ${state.fieldError ? "input-error" : ""}`}
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          required
          aria-invalid={state.fieldError ? true : undefined}
          aria-describedby={state.fieldError ? "forgot-password-email-error" : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        {state.fieldError ? (
          <p id="forgot-password-email-error" className="field-error" role="alert">
            {state.fieldError}
          </p>
        ) : null}
      </div>

      {state.status === "success" && state.message ? (
        <p className="form-message success" role="status">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" && state.formError ? (
        <p className="form-message error" role="alert">
          {state.formError}
        </p>
      ) : null}

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} action="forgot-password" />
      ) : null}

      <div className="button-row auth-actions">
        <AuthSubmitButton
          idleLabel={t.auth.forgotPassword.submit}
          pendingLabel={t.auth.forgotPassword.pending}
        />
        <Link className="button-secondary" href="/auth/login">
          {t.common.backToLogin}
        </Link>
      </div>
    </form>
  );
}
