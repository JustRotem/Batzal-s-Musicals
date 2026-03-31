"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type AuthPasswordFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
  language?: AppLanguage;
};

function assignRef(
  ref: ForwardedRef<HTMLInputElement>,
  value: HTMLInputElement | null,
) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField({ className = "", language = "he", ...props }, ref) {
    const t = getTranslations(language);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const initialValue = useMemo(() => {
      if (typeof props.value === "string") {
        return props.value;
      }

      if (typeof props.defaultValue === "string") {
        return props.defaultValue;
      }

      return "";
    }, [props.defaultValue, props.value]);
    const [hasValue, setHasValue] = useState(Boolean(initialValue));
    const inputClassName = `${className} has-password-toggle`.trim();

    useEffect(() => {
      const syncHasValue = () => {
        const nextValue = inputRef.current?.value ?? initialValue;
        setHasValue(nextValue.length > 0);
      };

      syncHasValue();
      const frameId = window.requestAnimationFrame(syncHasValue);

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }, [initialValue]);

    useEffect(() => {
      if (!hasValue) {
        setIsVisible(false);
      }
    }, [hasValue]);

    return (
      <div className="password-field">
        <input
          {...props}
          ref={(node) => {
            inputRef.current = node;
            assignRef(ref, node);
          }}
          className={inputClassName}
          type={isVisible ? "text" : "password"}
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onInput={(event) => {
            setHasValue(event.currentTarget.value.length > 0);
            props.onInput?.(event);
          }}
          onChange={(event) => {
            setHasValue(event.currentTarget.value.length > 0);
            props.onChange?.(event);
          }}
        />
        {hasValue ? (
          <button
            type="button"
            className="password-toggle-button"
            aria-label={isVisible ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={isVisible}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsVisible((current) => !current)}
          >
            <span className="password-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
                <circle cx="12" cy="12" r="3.25" />
                {isVisible ? null : <path d="M4 4 20 20" />}
              </svg>
            </span>
          </button>
        ) : null}
      </div>
    );
  },
);

export default AuthPasswordField;
