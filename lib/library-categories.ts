import type { AppLanguage } from "@/lib/i18n";
import { db } from "@/lib/db";

// The library holds more than musicals: every item belongs to a section (category) that editors manage.
export type CategoryView = {
  id: string;
  slug: string;
  nameHe: string;
  nameEn: string;
  emoji: string | null;
};

export function getCategoryName(category: Pick<CategoryView, "nameHe" | "nameEn">, language: AppLanguage) {
  return language === "he" ? category.nameHe : category.nameEn;
}

export function getCategoryLabel(
  category: Pick<CategoryView, "nameHe" | "nameEn" | "emoji"> | null | undefined,
  language: AppLanguage,
) {
  if (!category) return "";

  return `${category.emoji ? `${category.emoji} ` : ""}${getCategoryName(category, language)}`;
}

export function listCategories(): Promise<CategoryView[]> {
  return db.libraryCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, nameHe: true, nameEn: true, emoji: true },
  });
}

const FIELD_LABELS = {
  he: {
    category: "קטגוריה",
    noCategory: "ללא קטגוריה",
    all: "הכל",
    manage: "ניהול קטגוריות",
  },
  en: {
    category: "Category",
    noCategory: "No category",
    all: "All",
    manage: "Manage categories",
  },
} as const;

export function getCategoryFieldLabels(language: AppLanguage) {
  return FIELD_LABELS[language];
}

export function slugifyCategory(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `category-${Date.now().toString(36)}`;
}
