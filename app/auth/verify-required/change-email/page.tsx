import Link from "next/link";
import { changeVerificationEmailAction } from "../actions";
import AuthSubmitButton from "@/components/AuthSubmitButton";

type ChangeVerificationEmailPageProps = {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    retryAfter?: string;
  }>;
};

function getErrorMessage(error?: string, retryAfter?: string) {
  switch (error) {
    case "missing-current-email":
      return "לא מצאנו את כתובת האימייל הנוכחית של החשבון.";
    case "missing-new-email":
      return "צריך להזין כתובת אימייל חדשה.";
    case "unknown-email":
      return "לא מצאנו חשבון לא מאומת עם כתובת האימייל הזו.";
    case "email-exists":
      return "כתובת האימייל החדשה כבר משויכת לחשבון אחר.";
    case "too-soon":
      return retryAfter
        ? `כבר נשלח קישור אימות לאחרונה. אפשר לנסות שוב בעוד כ-${retryAfter} שניות.`
        : "כבר נשלח קישור אימות לאחרונה. אפשר לנסות שוב בעוד רגע.";
    default:
      return null;
  }
}

export default async function ChangeVerificationEmailPage(
  props: ChangeVerificationEmailPageProps,
) {
  const searchParams = await props.searchParams;
  const email = searchParams?.email ?? "";
  const errorMessage = getErrorMessage(searchParams?.error, searchParams?.retryAfter);

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge">עדכון אימייל</div>
          <h1 className="viewer-title">האימייל לא נכון?</h1>
          <p className="viewer-text">
            אפשר לעדכן כאן את כתובת האימייל של החשבון הלא מאומת. אחרי השמירה יישלח
            קישור אימות חדש לכתובת המעודכנת.
          </p>

          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="auth-readonly-card">
            <span className="auth-readonly-label">האימייל הנוכחי</span>
            <strong className="auth-readonly-value" dir="ltr">
              {email || "לא התקבלה כתובת אימייל"}
            </strong>
          </div>

          <form action={changeVerificationEmailAction} className="form-grid auth-form" noValidate>
            <input type="hidden" name="currentEmail" value={email} />

            <div className="field auth-field">
              <label className="field-label" htmlFor="new-email">
                אימייל חדש
              </label>
              <input
                id="new-email"
                className="input"
                name="nextEmail"
                type="email"
                autoComplete="email"
                inputMode="email"
                dir="ltr"
                required
              />
            </div>

            <div className="button-row auth-actions">
              <AuthSubmitButton
                idleLabel="עדכן אימייל ושלח קישור חדש"
                pendingLabel="מעדכן ושולח..."
              />
              <Link
                className="button-secondary"
                href={
                  email
                    ? `/auth/verify-required?email=${encodeURIComponent(email)}`
                    : "/auth/verify-required"
                }
              >
                חזרה למסך האימות
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
