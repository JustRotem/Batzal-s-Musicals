// People are shown by their username everywhere. The first and last name columns are no longer displayed.
export function formatUserDisplayName(firstName: string, lastName: string, username?: string) {
  const safeUsername = username?.trim();

  if (safeUsername) {
    return safeUsername;
  }

  return `${firstName} ${lastName}`.trim();
}
