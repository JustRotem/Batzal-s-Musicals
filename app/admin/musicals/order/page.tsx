import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { PERMISSIONS } from "@/lib/permissions";
import MusicalOrderManager from "@/components/MusicalOrderManager";
import { reorderMusicalsAction } from "@/app/admin/musicals/actions";

function getOrderPageCopy(language: "he" | "en") {
  if (language === "en") {
    return {
      title: "Edit Musicals Order",
      text: "Drag musicals into the order you want them to appear on the site, then save.",
      save: "Save Order",
      reset: "Reset",
      back: "Back to All Musicals",
    };
  }

  return {
    title: "עריכת סדר מחזות",
    text: "גררו את המחזות לסדר הרצוי ולאחר מכן שמרו.",
    save: "שמור סדר",
    reset: "איפוס",
    back: "חזרה לכל המחזות",
  };
}

export default async function MusicalsOrderPage() {
  await requirePermission(PERMISSIONS.musicalEdit);
  const language = await getCurrentLanguage();
  const copy = getOrderPageCopy(language);
  const musicals = await db.musical.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      year: true,
      emoji: true,
      imagePath: true,
      posterDisplayMode: true,
      posterAspect: true,
      thumbnailUrl: true,
    },
  });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />
      <div className="container">
        <MusicalOrderManager language={language} musicals={musicals} action={reorderMusicalsAction} copy={copy} />
      </div>
    </main>
  );
}
