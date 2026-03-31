"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import AuthPasswordField from "@/components/AuthPasswordField";
import {
  resetPasswordAction,
} from "@/app/reset-password/actions";
import {
  INITIAL_RESET_PASSWORD_STATE,
  type ResetPasswordFormState,
} from "@/lib/form-states";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import {
  getPasswordRules,
  getPasswordStrengthLabel,
} from "@/lib/password-policy";

function getStrengthClassName(score: number) {
  if (score >= 5) {
    return "very-strong";
  }

  if (score >= 4) {
    return "strong";
  }

  if (score >= 3) {
    return "medium";
  }

  if (score >= 1) {
    return "weak";
  }

  return "empty";
}

type ResetPasswordFormProps = {
  token: string;
  language: AppLanguage;
};

export default function ResetPasswordForm({ token, language }: ResetPasswordFormProps) {
  const t = getTranslations(language);
  const [state, formAction] = useActionState<ResetPasswordFormState, FormData>(
    resetPasswordAction,
    INITIAL_RESET_PASSWORD_STATE,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const passwordRules = useMemo(() => getPasswordRules(language), [language]);
  const passwordChecks = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        passed: rule.test(password),
      })),
    [password, passwordRules],
  );
  const passedChecks = passwordChecks.filter((rule) => rule.passed).length;
  const strengthLabel = getPasswordStrengthLabel(passedChecks, language);
  const strengthClassName = getStrengthClassName(passedChecks);

  useEffect(() => {
    if (state.fieldErrors.password) {
      setShowValidation(true);
      passwordInputRef.current?.focus();
    }
  }, [state.fieldErrors.password]);

  return (
    <form action={formAction} className="form-grid auth-form" noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="language" value={language} />

      <div className="field auth-field">
        <label className="field-label" htmlFor="reset-password">
          {t.auth.resetPassword.newPassword}
        </label>
        <AuthPasswordField
          ref={passwordInputRef}
          id="reset-password"
          className={`input ${state.fieldErrors.password ? "input-error" : ""}`}
          name="password"
          language={language}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onFocus={() => setShowValidation(true)}
          onBlur={() => {
            if (password.length > 0) {
              setShowValidation(true);
            }
          }}
          aria-invalid={state.fieldErrors.password ? true : undefined}
          aria-describedby={state.fieldErrors.password ? "reset-password-error" : undefined}
        />
        {state.fieldErrors.password ? (
          <p id="reset-password-error" className="field-error" role="alert">
            {state.fieldErrors.password}
          </p>
        ) : null}

        <div className="password-strength" aria-live="polite">
          <div className="password-strength-header">
            <span>{t.auth.requestAccount.passwordStrength}</span>
            <span className={`password-strength-label ${strengthClassName}`}>{strengthLabel}</span>
          </div>
          <div className="password-strength-track" aria-hidden="true">
            <div
              className={`password-strength-fill ${strengthClassName}`}
              style={{ width: `${(passedChecks / passwordRules.length) * 100}%` }}
            />
          </div>
          <div className="password-requirements">
            {passwordChecks.map((rule) => (
              <div
                key={rule.id}
                className={`password-requirement ${rule.passed ? "met" : "unmet"} ${
                  showValidation && !rule.passed ? "highlight-unmet" : ""
                }`}
              >
                <span className="password-requirement-indicator" aria-hidden="true">
                  {rule.passed ? "✓" : "•"}
                </span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="field auth-field">
        <label className="field-label" htmlFor="reset-password-confirm">
          {t.auth.resetPassword.confirmPassword}
        </label>
        <AuthPasswordField
          id="reset-password-confirm"
          className={`input ${state.fieldErrors.confirmPassword ? "input-error" : ""}`}
          name="confirmPassword"
          language={language}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={state.fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={state.fieldErrors.confirmPassword ? "reset-password-confirm-error" : undefined}
        />
        {state.fieldErrors.confirmPassword ? (
          <p id="reset-password-confirm-error" className="field-error" role="alert">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p className="form-message error" role="alert">
          {state.formError}
        </p>
      ) : null}

      <div className="button-row auth-actions">
        <AuthSubmitButton
          idleLabel={t.auth.resetPassword.save}
          pendingLabel={t.auth.resetPassword.saving}
        />
        <Link className="button-secondary" href="/auth/forgot-password">
          {t.auth.resetPassword.requestNewLink}
        </Link>
      </div>
    </form>
  );
}
