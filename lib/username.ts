export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export type UsernameError = "username-too-short" | "username-too-long" | "username-invalid";

// Letters (any language), digits, underscore and spaces; 3-30 characters.
export function validateUsername(
  raw: string,
): { ok: true; value: string } | { ok: false; error: UsernameError } {
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: "username-too-short" };
  }

  if (value.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: "username-too-long" };
  }

  if (!/^[\p{L}\p{N}_ ]+$/u.test(value)) {
    return { ok: false, error: "username-invalid" };
  }

  return { ok: true, value };
}
