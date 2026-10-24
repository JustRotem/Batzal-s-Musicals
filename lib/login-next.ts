import { getAllowedOrigins } from "@/lib/sso";

// The library site and the account site each keep their own "where to go after sign-in" cookie. Locally both run on
// localhost and share cookies, and one flow used to wipe the other's, which sent people home instead of back.
export const LOGIN_NEXT_COOKIE = "my_musicals_login_next";
export const ACCOUNT_LOGIN_NEXT_COOKIE = "bz_account_login_next";
// Present while a person is re-confirming their identity (holds the site to return to, its state and who is confirming)
export const IDENTITY_CONFIRM_COOKIE = "bz_identity_confirm";

// Where to send the visitor after signing in. Only same-site paths are accepted, so this can never
// redirect to another domain.
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 600) {
    return null;
  }

  // A full address is accepted only for the Batzal sites approved for single sign-on (for example the home page)
  if (/^https?:\/\//i.test(value)) {
    try {
      return getAllowedOrigins().includes(new URL(value).origin) ? new URL(value).toString() : null;
    } catch {
      return null;
    }
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }

  return value;
}
