// Appearance and language cookies are shared by every Batzal site (*.batzal.net), so a choice made on one site holds on all of them.
// They are readable by the shared script (not HttpOnly) and hold nothing sensitive.
export const SHARED_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function sharedCookieOptions() {
  const configured = process.env.SHARED_COOKIE_DOMAIN?.trim();
  const domain = configured || (process.env.NODE_ENV === "production" ? ".batzal.net" : undefined);

  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SHARED_COOKIE_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}
