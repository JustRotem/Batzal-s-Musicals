import type { Metadata } from "next";
import "@fontsource/assistant/400.css";
import "@fontsource/assistant/500.css";
import "@fontsource/assistant/600.css";
import "@fontsource/assistant/700.css";
import "@fontsource/assistant/800.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { getAppTitle } from "@/lib/app-config";
import { getDirection } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getCurrentLanguage();
  const appTitle = getAppTitle(language);

  return {
    title: appTitle,
    description:
      language === "he"
        ? `${appTitle} - ספריית מחזות, קטעים וניהול תוכן עם חוויית צפייה וחשבון מלאה.`
        : `${appTitle} - a musical library with clips, accounts, search, and content management.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getCurrentLanguage();
  const direction = getDirection(language);

  return (
    <html lang={language} dir={direction}>
      <body>
        <SiteHeader language={language} />
        {children}
      </body>
    </html>
  );
}
