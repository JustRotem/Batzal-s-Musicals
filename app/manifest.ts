import type { MetadataRoute } from "next";
import { getAppTitle } from "@/lib/app-config";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { isDevEnvironment, isHomeMode } from "@/lib/app-mode";

// "Add to home screen": the site opens as an app, without the browser's own bars.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const language = await getCurrentLanguage();
  // the home page installs as plain "Batzal"
  const title = isHomeMode() ? "Batzal" : getAppTitle(language);
  const name = isDevEnvironment() ? `${title} · DEV` : title;

  return {
    name,
    short_name: name.length > 14 ? name.slice(0, 14) : name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1f1e1d",
    theme_color: "#232221",
    lang: language,
    dir: language === "he" ? "rtl" : "ltr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
