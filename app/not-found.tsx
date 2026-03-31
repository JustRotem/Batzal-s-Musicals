import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <h1 className="viewer-title">העמוד לא נמצא</h1>
          <p className="viewer-text">
            או שהקישור לא נכון, או שפשוט עוד לא בנינו את החלק הזה.
          </p>

          <div className="button-row">
            <Link className="button-primary" href="/">
              חזרה לבית
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
