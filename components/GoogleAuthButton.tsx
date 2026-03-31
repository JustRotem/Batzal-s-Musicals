import Link from "next/link";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type GoogleAuthButtonProps = {
  mode: "login" | "signup";
  language: AppLanguage;
};

export default function GoogleAuthButton({ mode, language }: GoogleAuthButtonProps) {
  const t = getTranslations(language);

  return (
    <Link
      href={`/auth/google/start?mode=${mode}`}
      className="google-auth-button"
      prefetch={false}
    >
      <span className="google-auth-button-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <path
            fill="#EA4335"
            d="M12 10.2v3.92h5.45c-.22 1.26-.96 2.33-2.07 3.05l3.34 2.59c1.95-1.8 3.08-4.45 3.08-7.61 0-.72-.06-1.4-.18-2.06H12Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.79 0 5.13-.92 6.84-2.49l-3.34-2.59c-.93.63-2.11 1-3.5 1-2.69 0-4.96-1.81-5.77-4.24H2.78v2.67A9.99 9.99 0 0 0 12 22Z"
          />
          <path
            fill="#4A90E2"
            d="M6.23 13.68A5.96 5.96 0 0 1 5.91 12c0-.58.1-1.14.32-1.68V7.65H2.78A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.35l3.15-2.67Z"
          />
          <path
            fill="#FBBC05"
            d="M12 6.08c1.52 0 2.88.52 3.95 1.54l2.96-2.96C17.12 2.99 14.79 2 12 2 8.09 2 4.73 4.24 3.08 7.65l3.15 2.67c.81-2.43 3.08-4.24 5.77-4.24Z"
          />
        </svg>
      </span>
      <span>{t.auth.continueWithGoogle}</span>
    </Link>
  );
}
