export const LOGIN_NEXT_COOKIE = "my_musicals_login_next";

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
