import Link from "next/link";

export default function PendingAccountPage() {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card">
          <div className="auth-state-badge">בקשת עורך ממתינה</div>
          <h1 className="viewer-title">בקשת גישת העורך שלך עדיין ממתינה</h1>
          <p className="viewer-text">
            החשבון עצמו פעיל, אבל הרשאות העריכה עדיין ממתינות לאישור אדמין. עד אז
            אפשר להמשיך להשתמש במערכת עם הרשאות רגילות.
          </p>

          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/profile">
              חזרה לפרופיל
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
