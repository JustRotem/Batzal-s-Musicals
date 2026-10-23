"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { slugifyCategory } from "@/lib/library-categories";

function text(formData: FormData, name: string, max = 60) {
  const value = formData.get(name);

  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base;
  let counter = 2;

  while (true) {
    const existing = await db.libraryCategory.findUnique({ where: { slug }, select: { id: true } });

    if (!existing || existing.id === ignoreId) return slug;

    slug = `${base}-${counter}`;
    counter += 1;
  }
}

export async function createCategoryAction(formData: FormData) {
  await requirePermission(PERMISSIONS.musicalEdit);

  const nameHe = text(formData, "nameHe");
  const nameEn = text(formData, "nameEn") || nameHe;
  const emoji = text(formData, "emoji", 8) || null;

  if (!nameHe) redirect("/admin/categories?error=name");

  const last = await db.libraryCategory.aggregate({ _max: { sortOrder: true } });

  await db.libraryCategory.create({
    data: {
      slug: await uniqueSlug(slugifyCategory(nameEn)),
      nameHe,
      nameEn,
      emoji,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

export async function updateCategoryAction(formData: FormData) {
  await requirePermission(PERMISSIONS.musicalEdit);

  const id = text(formData, "id", 100);
  const nameHe = text(formData, "nameHe");
  const nameEn = text(formData, "nameEn") || nameHe;
  const emoji = text(formData, "emoji", 8) || null;

  if (!id || !nameHe) redirect("/admin/categories?error=name");

  await db.libraryCategory.update({ where: { id }, data: { nameHe, nameEn, emoji } });

  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

// Items of a deleted category stay in the library, without a category.
export async function deleteCategoryAction(formData: FormData) {
  await requirePermission(PERMISSIONS.musicalDelete);

  const id = text(formData, "id", 100);

  if (id) {
    await db.libraryCategory.delete({ where: { id } }).catch(() => null);
  }

  revalidatePath("/", "layout");
  redirect("/admin/categories");
}
