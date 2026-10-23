// Appearance: "light", "dark", or null to follow the system setting.
export type AppTheme = "light" | "dark";

export const THEME_COOKIE_NAME = "bz_theme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseTheme(value: string | null | undefined): AppTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

// The saved account choice wins; the cookie is the choice of a signed-out visitor.
export function resolveTheme(
  accountTheme: string | null | undefined,
  cookieTheme: string | null | undefined,
  signedIn: boolean,
): AppTheme | null {
  return parseTheme(signedIn ? accountTheme : cookieTheme);
}
