import Link from "next/link";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import { resendVerificationEmailAction } from "./actions";

type VerifyRequiredPageProps = {
  searchParams?: Promise<{
    email?: string;
    sent?: string;
    changed?: string;
    error?: string;
    retryAfter?: string;
  }>;
};

function getErrorMessage(error?: string, retryAfter?: string) {
  switch (error) {
    case "missing-email":
      return "חסרה כתובת אימייל כדי לשלוח קישור אימות חדש.";
    case "unknown-email":
      return "לא מצאנו חשבון לא מאומת עם כתובת האימייל הזו.";
    case "send-failed":
      return "החשבון נשמר, אבל הייתה בעיה בשליחת מייל האימות. אפשר לנסות שוב עכשיו.";
    case "too-soon":
      return retryAfter
        ? `כבר נשלח קישור אימות לאחרונה. אפשר לנסות שוב בעוד כ-${retryAfter} שניות.`
        : "כבר נשלח קישור אימות לאחרונה. אפשר לנסות שוב בעוד רגע.";
    default:
      return null;
  }
}

export default async function VerifyRequiredPage(props: VerifyRequiredPageProps) {
  const searchParams = await props.searchParams;
  const email = searchParams?.email ?? "";
  const sent = searchParams?.sent === "1";
  const changed = searchParams?.changed === "1";
  const errorMessage = getErrorMessage(searchParams?.error, searchParams?.retryAfter);

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge">אימות חשבון</div>
          <h1 className="viewer-title">צריך לאמת את כתובת האימייל שלך</h1>
          <p className="viewer-text">
            כדי להפעיל את החשבון ולהיכנס למערכת, צריך לפתוח את קישור האימות שנשלח לכתובת
            האימייל שלך.
          </p>

          {sent ? (
            <p className="form-message success">
              {changed
                ? "כתובת האימייל עודכנה וקישור אימות חדש כבר נשלח לכתובת החדשה."
                : "שלחנו קישור אימות לכתובת האימייל של החשבון."}
            </p>
          ) : null}

          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          {email ? (
            <div className="auth-readonly-card">
              <span className="auth-readonly-label">האימייל שאליו נשלח הקישור</span>
              <strong className="auth-readonly-value" dir="ltr">
                {email}
              </strong>
            </div>
          ) : null}

          <form action={resendVerificationEmailAction} className="form-grid auth-form" noValidate>
            <input type="hidden" name="email" value={email} />

            <div className="button-row auth-actions">
              <AuthSubmitButton
                idleLabel="שלח שוב קישור אימות"
                pendingLabel="שולח קישור אימות..."
              />
              <Link
                className="button-secondary"
                href={
                  email
                    ? `/auth/verify-required/change-email?email=${encodeURIComponent(email)}`
                    : "/auth/verify-required/change-email"
                }
              >
                האימייל לא נכון?
              </Link>
              <Link className="button-secondary" href="/auth/login">
                חזרה להתחברות
              </Link>
            </div>
          </form>

          <div className="auth-help-list">
            <div className="auth-help-item">
              <strong>לא מצאת את המייל?</strong>
              <span>כדאי לבדוק גם בתיקיית הספאם. אם צריך, אפשר לשלוח שוב קישור אימות.</span>
            </div>
            <div className="auth-help-item">
              <strong>מה קורה עד האימות?</strong>
              <span>החשבון נשמר במערכת, אבל אי אפשר להתחבר ולהשתמש בו עד לאישור האימייל.</span>
            </div>
            <div className="auth-help-item">
              <strong>מה יקרה אחרי הלחיצה על הקישור?</strong>
              <span>האימייל יאומת, ותועבר אוטומטית למסך ההתחברות כדי להיכנס לחשבון ולהמשיך לאפליקציה.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
