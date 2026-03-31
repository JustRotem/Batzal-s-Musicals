import Link from "next/link";

export default function BlockedAccountPage() {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card">
          <div className="auth-state-badge auth-state-badge-danger">החשבון חסום</div>
          <h1 className="viewer-title">אין כרגע אפשרות להתחבר עם החשבון הזה</h1>
          <p className="viewer-text">
            החשבון נחסם על ידי מנהל מערכת. אם זו טעות, כדאי לפנות לאדמין לקבלת הבהרה.
          </p>

          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/auth/login">
              חזרה להתחברות
            </Link>
            <Link className="button-primary" href="/auth/request-account">
              שלח בקשה חדשה
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
