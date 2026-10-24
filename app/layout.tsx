import type { Metadata } from "next";
import "@fontsource/assistant/400.css";
import "@fontsource/assistant/500.css";
import "@fontsource/assistant/600.css";
import "@fontsource/assistant/700.css";
import "@fontsource/assistant/800.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { isDevEnvironment } from "@/lib/app-mode";
import { getAppTitle } from "@/lib/app-config";
import { getDirection } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getCurrentTheme } from "@/lib/theme-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getCurrentLanguage();
  const appTitle = getAppTitle(language);

  return {
    // in DEV every tab says so
    title: isDevEnvironment() ? { default: `${appTitle} · DEV`, template: "%s · DEV" } : appTitle,
    description:
      language === "he"
        ? `${appTitle} - ספריית פריטים, קטעים וניהול תוכן עם חוויית צפייה וחשבון מלאה.`
        : `${appTitle} - an item library with clips, accounts, search, and content management.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getCurrentLanguage();
  const direction = getDirection(language);
  const theme = await getCurrentTheme();

  return (
    <html lang={language} dir={direction} data-theme={theme ?? undefined} data-env={isDevEnvironment() ? "dev" : undefined}>
      <head>
        <link rel="stylesheet" href={`${process.env.BATZAL_STATIC_URL ?? "https://static.batzal.net"}/batzal-bar.css?v=16`} />
      </head>
      <body>
        <SiteHeader language={language} />
        {children}
      </body>
    </html>
  );
}
