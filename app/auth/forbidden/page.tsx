import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card">
          <div className="auth-state-badge auth-state-badge-warning">אין הרשאה</div>
          <h1 className="viewer-title">אין לך הרשאה להיכנס לאזור הזה</h1>
          <p className="viewer-text">
            הדף או הפעולה שביקשת זמינים רק לעורכים או לאדמינים, בהתאם להרשאות של
            החשבון שלך כרגע.
          </p>

          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/profile">
              לחשבון שלי
            </Link>
            <Link className="button-primary" href="/">
              חזרה לדף הבית
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
