import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { PERMISSIONS } from "@/lib/permissions";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/admin/categories/actions";

export const dynamic = "force-dynamic";

const COPY = {
  he: {
    back: "חזרה לספרייה",
    title: "קטגוריות הספרייה",
    text: "כל פריט בספרייה שייך לקטגוריה: מחזות זמר, הקבוצה, או כל דבר אחר שתרצו להוסיף. מוחקים קטגוריה? הפריטים נשארים, רק בלי קטגוריה.",
    nameHe: "שם בעברית",
    nameEn: "שם באנגלית",
    emoji: "אימוג׳י",
    add: "הוסף קטגוריה",
    save: "שמור",
    del: "מחק",
    items: "פריטים",
    error: "צריך לפחות שם בעברית.",
    confirm: "למחוק את הקטגוריה? הפריטים שלה יישארו בלי קטגוריה.",
  },
  en: {
    back: "Back to library",
    title: "Library categories",
    text: "Every item in the library belongs to a category: items, the friends group, or anything else you want to add. Delete a category and its items stay, just without a category.",
    nameHe: "Hebrew name",
    nameEn: "English name",
    emoji: "Emoji",
    add: "Add category",
    save: "Save",
    del: "Delete",
    items: "items",
    error: "A Hebrew name is required.",
    confirm: "Delete this category? Its items stay without a category.",
  },
} as const;

export default async function CategoriesPage(props: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission(PERMISSIONS.musicalEdit);

  const language = await getCurrentLanguage();
  const copy = COPY[language];
  const searchParams = await props.searchParams;
  const categories = await db.libraryCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  });

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
          {searchParams?.error ? <div className="auth-error">{copy.error}</div> : null}

          <div className="category-list">
            {categories.map((category) => (
              <form key={category.id} action={updateCategoryAction} className="category-row">
                <input type="hidden" name="id" value={category.id} />
                <input className="input category-emoji" name="emoji" defaultValue={category.emoji ?? ""} aria-label={copy.emoji} maxLength={8} />
                <input className="input" name="nameHe" defaultValue={category.nameHe} aria-label={copy.nameHe} required maxLength={60} />
                <input className="input" name="nameEn" defaultValue={category.nameEn} aria-label={copy.nameEn} maxLength={60} dir="ltr" />
                <span className="category-count">
                  {category._count.items} {copy.items}
                </span>
                <button type="submit" className="button-secondary">
                  {copy.save}
                </button>
                <button type="submit" formAction={deleteCategoryAction} className="button-secondary category-delete" formNoValidate>
                  {copy.del}
                </button>
              </form>
            ))}

            <form action={createCategoryAction} className="category-row category-new">
              <input className="input category-emoji" name="emoji" placeholder="🎭" aria-label={copy.emoji} maxLength={8} />
              <input className="input" name="nameHe" placeholder={copy.nameHe} aria-label={copy.nameHe} required maxLength={60} />
              <input className="input" name="nameEn" placeholder={copy.nameEn} aria-label={copy.nameEn} maxLength={60} dir="ltr" />
              <button type="submit" className="button-primary">
                {copy.add}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
