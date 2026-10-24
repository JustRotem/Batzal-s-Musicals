import type { AppLanguage } from "@/lib/i18n";

// A person's rank is their role, shown in the shared header. Keep the texts in sync with the shared script (batzal.js).
export const RANK_LEVELS = 4;

const RANKS = {
  user: {
    level: 1,
    he: ["משתמש", "חשבון רגיל. אפשר לצפות בכל התכנים, להגיב ולנהל את הפרופיל. עריכת תכנים ניתנת על ידי מנהלים."],
    en: ["Member", "A regular account. You can browse everything, comment and manage your profile. Editing is granted by the admins."],
  },
  editor: {
    level: 2,
    he: ["עורך", "אפשר להוסיף ולערוך פריטים וקטעים, בנוסף לכל מה שיש למשתמש רגיל."],
    en: ["Editor", "You can add and edit items and clips, on top of everything a member can do."],
  },
  admin: {
    level: 3,
    he: ["מנהל", "מנהל תכנים ומשתמשים: מאשר עורכים, מטפל בדיווחים ומנהל הרשאות."],
    en: ["Admin", "Manages content and people: approves editors, handles reports and manages permissions."],
  },
  superadmin: {
    level: 4,
    he: ["מנהל ראשי", "הדרגה הגבוהה ביותר: גישה מלאה לכל האתרים, כולל לוח הבקרה והשליטה בשרתים."],
    en: ["Super admin", "The highest rank: full access to every site, including the control panel and the servers."],
  },
} as const;

export function getRankInfo(role: string, language: AppLanguage) {
  const rank = RANKS[role as keyof typeof RANKS] ?? RANKS.user;
  const [label, description] = rank[language];

  return { level: rank.level, label, description };
}
