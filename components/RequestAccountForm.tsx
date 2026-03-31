"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthPasswordField from "@/components/AuthPasswordField";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import TurnstileWidget from "@/components/TurnstileWidget";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import {
  getPasswordRules,
  getPasswordStrengthLabel,
} from "@/lib/password-policy";

type RequestAccountFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  passwordError?: string | null;
  showGoogleAuth?: boolean;
  turnstileSiteKey?: string | null;
  language: AppLanguage;
};

type AvailabilityState =
  | { status: "idle"; message: string | null }
  | { status: "invalid"; message: string }
  | { status: "checking"; message: string }
  | { status: "available"; message: string }
  | { status: "exists"; message: string };

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUsername(value: string) {
  return /^[\p{L}\p{N}_ ]+$/u.test(value);
}

export default function RequestAccountForm({
  action,
  passwordError,
  showGoogleAuth = false,
  turnstileSiteKey = null,
  language,
}: RequestAccountFormProps) {
  const t = getTranslations(language);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [emailAvailability, setEmailAvailability] = useState<AvailabilityState>({
    status: "idle",
    message: null,
  });
  const [usernameAvailability, setUsernameAvailability] = useState<AvailabilityState>({
    status: "idle",
    message: null,
  });
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const emailRequestRef = useRef(0);
  const usernameRequestRef = useRef(0);
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
  const strengthClassName =
    passedChecks >= 5
      ? "very-strong"
      : passedChecks >= 4
        ? "strong"
        : passedChecks >= 3
          ? "medium"
          : passedChecks >= 1
            ? "weak"
            : "empty";
  const passwordValid = passedChecks === passwordRules.length;
  const effectivePasswordError =
    passwordError ||
    (showPasswordValidation && !passwordValid
      ? t.auth.requestAccount.passwordStrengthError
      : null);
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedUsername = username.trim();
  const emailReadyForCheck = isPlausibleEmail(trimmedEmail);
  const usernameReadyForCheck = trimmedUsername.length >= 3 && isValidUsername(trimmedUsername);
  const emailHasBlockingIssue =
    emailAvailability.status === "exists" || emailAvailability.status === "invalid";
  const usernameHasBlockingIssue =
    usernameAvailability.status === "exists" || usernameAvailability.status === "invalid";

  useEffect(() => {
    if (!trimmedEmail) {
      setEmailAvailability({ status: "idle", message: null });
      return;
    }

    if (!emailReadyForCheck) {
      setEmailAvailability({
        status: "invalid",
        message: t.auth.requestAccount.emailCheckInvalid,
      });
      return;
    }

    const requestId = ++emailRequestRef.current;
    const controller = new AbortController();
    setEmailAvailability({ status: "checking", message: t.auth.requestAccount.emailChecking });

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/auth/request-account/availability?email=${encodeURIComponent(trimmedEmail)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const result = await response.json();

        if (emailRequestRef.current !== requestId) {
          return;
        }

        if (result.email?.exists) {
          setEmailAvailability({
            status: "exists",
            message: t.auth.requestAccount.emailExists,
          });
          return;
        }

        setEmailAvailability({
          status: "available",
          message: t.auth.requestAccount.emailAvailable,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setEmailAvailability({ status: "idle", message: null });
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [emailReadyForCheck, t.auth.requestAccount.emailAvailable, t.auth.requestAccount.emailCheckInvalid, t.auth.requestAccount.emailChecking, t.auth.requestAccount.emailExists, trimmedEmail]);

  useEffect(() => {
    if (!trimmedUsername) {
      setUsernameAvailability({ status: "idle", message: null });
      return;
    }

    if (trimmedUsername.length < 3) {
      setUsernameAvailability({
        status: "invalid",
        message: t.auth.requestAccount.usernameTooShort,
      });
      return;
    }

    if (!isValidUsername(trimmedUsername)) {
      setUsernameAvailability({
        status: "invalid",
        message: t.auth.requestAccount.usernameInvalid,
      });
      return;
    }

    if (!usernameReadyForCheck) {
      return;
    }

    const requestId = ++usernameRequestRef.current;
    const controller = new AbortController();
    setUsernameAvailability({ status: "checking", message: t.auth.requestAccount.usernameChecking });

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/auth/request-account/availability?username=${encodeURIComponent(trimmedUsername)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const result = await response.json();

        if (usernameRequestRef.current !== requestId) {
          return;
        }

        if (result.username?.exists) {
          setUsernameAvailability({
            status: "exists",
            message: t.auth.requestAccount.usernameExists,
          });
          return;
        }

        setUsernameAvailability({
          status: "available",
          message: t.auth.requestAccount.usernameAvailable,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setUsernameAvailability({ status: "idle", message: null });
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [t.auth.requestAccount.usernameAvailable, t.auth.requestAccount.usernameChecking, t.auth.requestAccount.usernameExists, t.auth.requestAccount.usernameInvalid, t.auth.requestAccount.usernameTooShort, trimmedUsername, usernameReadyForCheck]);

  return (
    <form
      action={action}
      className="form-grid auth-form auth-form-signup"
      data-lang={language}
      dir={language === "he" ? "rtl" : "ltr"}
      autoComplete="on"
      id="request-account-form"
      name="request-account"
      noValidate
      onInputCapture={() => {
        if (clientError) {
          setClientError(null);
        }
      }}
      onSubmit={(event) => {
        const form = event.currentTarget;
        setClientError(null);

        if (!form.reportValidity()) {
          event.preventDefault();
          setShowPasswordValidation(true);
          setClientError(t.auth.requestAccount.errors["missing-fields"]);
          return;
        }

        if (!passwordValid) {
          event.preventDefault();
          setShowPasswordValidation(true);
          setClientError(t.auth.requestAccount.passwordStrengthError);
          passwordInputRef.current?.focus();
          return;
        }

        if (emailAvailability.status === "checking" || usernameAvailability.status === "checking") {
          event.preventDefault();
          setClientError(
            emailAvailability.status === "checking"
              ? emailAvailability.message
              : usernameAvailability.message,
          );
          return;
        }

        if (emailHasBlockingIssue) {
          event.preventDefault();
          setClientError(emailAvailability.message);
          return;
        }

        if (usernameHasBlockingIssue) {
          event.preventDefault();
          setClientError(usernameAvailability.message);
          return;
        }
      }}
    >
      <input type="hidden" name="language" value={language} />
      {showGoogleAuth ? (
        <>
          <GoogleAuthButton mode="signup" language={language} />
          <div className="auth-provider-divider" aria-hidden="true">
            <span>{t.auth.or}</span>
          </div>
        </>
      ) : null}

      <div className="auth-split-grid">
        <div className="field auth-field">
          <label className="field-label" htmlFor="request-first-name">
            {t.auth.requestAccount.firstName}
          </label>
          <input
            id="request-first-name"
            className="input"
            name="firstName"
            autoComplete="given-name"
            required
          />
        </div>

        <div className="field auth-field">
          <label className="field-label" htmlFor="request-last-name">
            {t.auth.requestAccount.lastName}
          </label>
          <input
            id="request-last-name"
            className="input"
            name="lastName"
            autoComplete="family-name"
            required
          />
        </div>
      </div>

      <div className="field auth-field auth-credential-field">
        <label className="field-label auth-credential-label" htmlFor="email">
          {t.auth.email}
        </label>
        <input
          id="email"
          className={`input ${
            emailAvailability.status === "exists" || emailAvailability.status === "invalid"
              ? "input-error"
              : ""
          }`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          aria-invalid={emailHasBlockingIssue ? "true" : "false"}
          aria-describedby={emailAvailability.message ? "request-email-status" : undefined}
          onChange={(event) => {
            setEmail(event.currentTarget.value);
          }}
          onInvalid={(event) => {
            const input = event.currentTarget;
            if (input.validity.valueMissing) {
              input.setCustomValidity(t.auth.emailRequired);
            } else if (input.validity.typeMismatch) {
              input.setCustomValidity(t.auth.emailInvalid);
            } else {
              input.setCustomValidity(t.auth.emailGenericInvalid);
            }
          }}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
        />
        {emailAvailability.message ? (
          <p
            id="request-email-status"
            className={`field-status field-status-${emailAvailability.status}`}
            role="status"
          >
            {emailAvailability.message}
          </p>
        ) : null}
        <div className="show-meta auth-credential-help" style={{ marginTop: 0 }}>
          {t.auth.requestAccount.emailHint}
        </div>
      </div>

      <div className="field auth-field auth-credential-field">
        <label className="field-label auth-credential-label" htmlFor="request-password">
          {t.auth.password}
        </label>
        <AuthPasswordField
          ref={passwordInputRef}
          id="request-password"
          className={`input ${effectivePasswordError ? "input-error" : ""}`}
          name="password"
          autoComplete="new-password"
          minLength={8}
          language={language}
          required
          value={password}
          aria-invalid={effectivePasswordError ? "true" : "false"}
          aria-describedby={effectivePasswordError ? "request-password-error" : undefined}
          onChange={(event) => {
            setPassword(event.currentTarget.value);
            if (showPasswordValidation) {
              setShowPasswordValidation(true);
            }
          }}
          onInvalid={(event) => {
            const input = event.currentTarget;
            if (input.validity.valueMissing) {
              input.setCustomValidity(t.auth.passwordRequired);
            } else if (passedChecks !== passwordRules.length) {
              input.setCustomValidity(
                t.auth.requestAccount.passwordErrors["password-requirements"],
              );
            } else {
              input.setCustomValidity(t.auth.passwordInvalid);
            }
          }}
          onInput={(event) => {
            event.currentTarget.setCustomValidity("");
          }}
          onBlur={() => {
            if (password.length > 0) {
              setShowPasswordValidation(true);
            }
          }}
        />
        {effectivePasswordError ? (
          <p id="request-password-error" className="field-error" role="alert">
            {effectivePasswordError}
          </p>
        ) : null}
        <div className="password-strength" aria-live="polite">
          <div className="password-strength-header">
            <span>{t.auth.requestAccount.passwordStrength}</span>
            <span className={`password-strength-label ${strengthClassName}`}>{strengthLabel}</span>
          </div>
          <div className="password-strength-track" aria-hidden="true">
            <span
              className={`password-strength-fill ${strengthClassName}`}
              style={{ width: `${(passedChecks / passwordRules.length) * 100}%` }}
            />
          </div>
          <div className="password-requirements">
            {passwordChecks.map((rule) => (
              <div
                key={rule.id}
                className={`password-requirement ${rule.passed ? "met" : "unmet"} ${
                  showPasswordValidation && !rule.passed ? "highlight-unmet" : ""
                }`}
              >
                <span className="password-requirement-indicator" aria-hidden="true">
                  {rule.passed ? "✓" : showPasswordValidation ? "✕" : "•"}
                </span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="field auth-field auth-credential-field">
        <label className="field-label" htmlFor="request-public-username">
          {t.auth.requestAccount.username}
        </label>
        <input
          id="request-public-username"
          className={`input ${
            usernameAvailability.status === "exists" || usernameAvailability.status === "invalid"
              ? "input-error"
              : ""
          }`}
          name="publicUsername"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          required
          value={username}
          aria-invalid={usernameHasBlockingIssue ? "true" : "false"}
          aria-describedby={
            usernameAvailability.message ? "request-username-status" : undefined
          }
          onChange={(event) => {
            setUsername(event.currentTarget.value);
          }}
          onInvalid={(event) => {
            const input = event.currentTarget;
            if (input.validity.valueMissing) {
              input.setCustomValidity(t.auth.requestAccount.usernameRequired);
            } else {
              input.setCustomValidity(t.auth.requestAccount.usernameFieldInvalid);
            }
          }}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
        />
        {usernameAvailability.message ? (
          <p
            id="request-username-status"
            className={`field-status field-status-${usernameAvailability.status}`}
            role="status"
          >
            {usernameAvailability.message}
          </p>
        ) : null}
        <div className="show-meta" style={{ marginTop: 0 }}>
          {t.auth.requestAccount.usernameFieldHint}
        </div>
      </div>

      <div className="auth-form-feedback" aria-live="polite">
        {clientError ? (
          <p className="form-message error" role="alert">
            {clientError}
          </p>
        ) : (
          <span className="auth-form-feedback-placeholder" aria-hidden="true" />
        )}
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} action="request-account" />
      ) : null}

      <div className="button-row auth-actions">
        <AuthSubmitButton
          idleLabel={t.auth.requestAccount.submit}
          pendingLabel={t.auth.requestAccount.pending}
        />
      </div>
    </form>
  );
}
