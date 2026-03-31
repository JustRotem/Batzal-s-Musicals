"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import AuthPasswordField from "@/components/AuthPasswordField";
import FormSubmitButton from "@/components/FormSubmitButton";
import {
  changePasswordAction,
} from "@/app/profile/actions";
import {
  INITIAL_CHANGE_PASSWORD_STATE,
  type ChangePasswordFormState,
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

export default function ChangePasswordForm({ language = "he" }: { language?: AppLanguage }) {
  const t = getTranslations(language);
  const [state, formAction] = useActionState<ChangePasswordFormState, FormData>(
    changePasswordAction,
    INITIAL_CHANGE_PASSWORD_STATE,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const newPasswordRef = useRef<HTMLInputElement | null>(null);
  const passwordRules = useMemo(() => getPasswordRules(language), [language]);
  const passwordChecks = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        passed: rule.test(newPassword),
      })),
    [newPassword, passwordRules],
  );
  const passedChecks = passwordChecks.filter((rule) => rule.passed).length;
  const strengthLabel = getPasswordStrengthLabel(passedChecks, language);
  const strengthClassName = getStrengthClassName(passedChecks);

  useEffect(() => {
    if (state.status === "success") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowValidation(false);
      return;
    }

    if (state.fieldErrors.newPassword) {
      setShowValidation(true);
    }
  }, [state]);

  return (
    <form action={formAction} className="form-grid">
      <input type="hidden" name="language" value={language} />
      <div className="field">
        <label className="field-label" htmlFor="security-current-password">
          {language === "he" ? "סיסמה נוכחית" : "Current password"}
        </label>
        <AuthPasswordField
          id="security-current-password"
          className={`input ${state.fieldErrors.currentPassword ? "input-error" : ""}`}
          name="currentPassword"
          language={language}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          aria-invalid={state.fieldErrors.currentPassword ? true : undefined}
          aria-describedby={
            state.fieldErrors.currentPassword ? "security-current-password-error" : undefined
          }
        />
        {state.fieldErrors.currentPassword ? (
          <p id="security-current-password-error" className="field-error" role="alert">
            {state.fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="security-new-password">
          {language === "he" ? "סיסמה חדשה" : "New password"}
        </label>
        <AuthPasswordField
          ref={newPasswordRef}
          id="security-new-password"
          className={`input ${state.fieldErrors.newPassword ? "input-error" : ""}`}
          name="newPassword"
          language={language}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          onFocus={() => setShowValidation(true)}
          onBlur={() => {
            if (newPassword.length > 0) {
              setShowValidation(true);
            }
          }}
          aria-invalid={state.fieldErrors.newPassword ? true : undefined}
          aria-describedby={state.fieldErrors.newPassword ? "security-new-password-error" : undefined}
        />
        {state.fieldErrors.newPassword ? (
          <p id="security-new-password-error" className="field-error" role="alert">
            {state.fieldErrors.newPassword}
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

      <div className="field">
        <label className="field-label" htmlFor="security-confirm-password">
          {t.auth.resetPassword.confirmPassword}
        </label>
        <AuthPasswordField
          id="security-confirm-password"
          className={`input ${state.fieldErrors.confirmPassword ? "input-error" : ""}`}
          name="confirmPassword"
          language={language}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={state.fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={
            state.fieldErrors.confirmPassword ? "security-confirm-password-error" : undefined
          }
        />
        {state.fieldErrors.confirmPassword ? (
          <p id="security-confirm-password-error" className="field-error" role="alert">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p className="form-message error" role="alert">
          {state.formError}
        </p>
      ) : null}

      {state.successMessage ? (
        <p className="form-message success" role="status">
          {state.successMessage}
        </p>
      ) : null}

      <div className="button-row profile-action-row">
        <FormSubmitButton
          idleLabel={t.auth.resetPassword.save}
          pendingLabel={language === "he" ? "מעדכן סיסמה..." : "Updating password..."}
        />
      </div>
    </form>
  );
}
