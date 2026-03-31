"use client";

import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card app-error-card">
          <span className="profile-kicker">Batzal&apos;s Musicals</span>
          <h1 className="viewer-title">משהו לא הסתדר בדף הזה</h1>
          <p className="viewer-text">
            לא נחשף כאן מידע טכני, אבל אפשר לנסות שוב מיד או לחזור לעמוד הבית ולהמשיך משם.
          </p>

          <div className="button-row" style={{ marginTop: 0 }}>
            <button type="button" className="button-primary" onClick={() => reset()}>
              נסה שוב
            </button>
            <Link href="/" className="button-secondary">
              חזרה לדף הבית
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
