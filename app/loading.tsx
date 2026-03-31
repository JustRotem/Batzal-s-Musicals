import { getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function Loading() {
  const language = await getCurrentLanguage();
  const t = getTranslations(language);

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card app-loading-card" aria-live="polite" aria-busy="true">
          <div className="app-loading-spinner" aria-hidden="true" />
          <h1 className="viewer-title" style={{ marginBottom: 8 }}>
            {language === "he" ? "טוען את Batzal's Musicals" : `Loading ${t.metadata.appName}`}
          </h1>
          <p className="viewer-text" style={{ marginBottom: 0 }}>
            {language === "he"
              ? "עוד רגע התוכן מוכן. אנחנו מסדרים את הדף כדי שהמעבר ירגיש חלק ויציב."
              : "The content is almost ready. We are preparing the page so the transition feels smooth and stable."}
          </p>
        </section>
      </div>
    </main>
  );
}
