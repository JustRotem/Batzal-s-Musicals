import Link from "next/link";

export default function ForgotEmailPage() {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge">איתור אימייל החשבון</div>
          <h1 className="viewer-title">שכחת עם איזה אימייל פתחת את החשבון?</h1>
          <p className="viewer-text">
            אפשר להתחיל מכמה בדיקות פשוטות כבר עכשיו, ובשלב הבא המערכת תהיה מוכנה
            לתהליכי עזרה ושחזור מתקדמים יותר.
          </p>

          <div className="auth-help-list">
            <div className="auth-help-item">
              <strong>איפה כדאי לבדוק קודם?</strong>
              <span>בתיבת המייל שלך, במנהל הסיסמאות, או בכל מקום שבו שמרת את פרטי החשבון כשהוא נוצר.</span>
            </div>
            <div className="auth-help-item">
              <strong>ומה לגבי טלפון?</strong>
              <span>טלפון מתחיל להיכנס עכשיו כחלק ממבנה החשבון, כדי לאפשר בעתיד מסלולי עזרה ושחזור ברורים יותר.</span>
            </div>
          </div>

          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/auth/login">
              חזרה להתחברות
            </Link>
            <Link className="button-primary" href="/auth/request-account">
              צור חשבון
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
