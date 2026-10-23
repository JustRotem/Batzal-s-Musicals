// The library site and the account site each keep their own "where to go after sign-in" cookie. Locally both run on
// localhost and share cookies, and one flow used to wipe the other's, which sent people home instead of back.
export const LOGIN_NEXT_COOKIE = "my_musicals_login_next";
export const ACCOUNT_LOGIN_NEXT_COOKIE = "bz_account_login_next";

// Where to send the visitor after signing in. Only same-site paths are accepted, so this can never
// redirect to another domain.
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 600) {
    return null;
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
