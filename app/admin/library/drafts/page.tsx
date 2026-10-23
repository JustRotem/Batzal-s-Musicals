import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const COPY = {
  he: {
    back: "חזרה לספרייה",
    title: "הטיוטות שלי",
    text: "פריטים וקטעים שנשמרו כטיוטה ועדיין לא פורסמו. רק מי שמנהל את הספרייה רואה אותם.",
    items: "פריטים",
    clips: "קטעים",
    none: "אין טיוטות.",
    edit: "עריכה ופרסום",
    in: "בתוך",
    updated: "עודכן",
  },
  en: {
    back: "Back to library",
    title: "Drafts",
    text: "Items and clips saved as drafts and not published yet. Only people who manage the library see them.",
    items: "Items",
    clips: "Clips",
    none: "No drafts.",
    edit: "Edit and publish",
    in: "in",
    updated: "Updated",
  },
} as const;

export default async function DraftsPage() {
  await requirePermission(PERMISSIONS.musicalEdit);

  const language = await getCurrentLanguage();
  const copy = COPY[language];
  const [items, clips] = await Promise.all([
    db.musical.findMany({
      where: { isPublished: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, title: true, updatedAt: true },
    }),
    db.clip.findMany({
      where: { isDraft: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, musical: { select: { slug: true, title: true } } },
    }),
  ]);
  const when = (date: Date) => date.toLocaleDateString(language === "he" ? "he-IL" : "en-GB");

  return (
    <main className="page-shell">
      <div className="orb one" />

      <div className="container">
        <section className="card">
          <Link href="/library" className="musical-back-link">
            {copy.back}
          </Link>
          <h1 className="viewer-title">{copy.title}</h1>
          <p className="viewer-text">{copy.text}</p>

          {items.length === 0 && clips.length === 0 ? <p className="viewer-text">{copy.none}</p> : null}

          {items.length > 0 ? (
            <>
              <h2 className="panel-title" style={{ marginTop: 24 }}>{copy.items}</h2>
              <div className="draft-list">
                {items.map((item) => (
                  <div key={item.id} className="draft-row">
                    <div>
                      <strong dir="auto">{item.title}</strong>
                      <span className="draft-meta">{copy.updated} {when(item.updatedAt)}</span>
                    </div>
                    <Link href={`/admin/library/${encodeURIComponent(item.slug)}/edit`} className="button-secondary">
                      {copy.edit}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {clips.length > 0 ? (
            <>
              <h2 className="panel-title" style={{ marginTop: 24 }}>{copy.clips}</h2>
              <div className="draft-list">
                {clips.map((clip) => (
                  <div key={clip.id} className="draft-row">
                    <div>
                      <strong dir="auto">{clip.title}</strong>
                      <span className="draft-meta" dir="auto">
                        {copy.in} {clip.musical.title} · {copy.updated} {when(clip.updatedAt)}
                      </span>
                    </div>
                    <Link
                      href={`/admin/library/${encodeURIComponent(clip.musical.slug)}/clips/${clip.id}/edit`}
                      className="button-secondary"
                    >
                      {copy.edit}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
