import type { Metadata } from "next";
import "@fontsource/assistant/400.css";
import "@fontsource/assistant/500.css";
import "@fontsource/assistant/600.css";
import "@fontsource/assistant/700.css";
import "@fontsource/assistant/800.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { getDirection } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Batzal's Musicals",
  description: "Batzal's Musicals - ספריית מחזות, קטעים וניהול תוכן עם חוויית צפייה וחשבון מלאה.",
};

export const dynamic = "force-dynamic";

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
