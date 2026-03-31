export function formatUserDisplayName(firstName: string, lastName: string, username?: string) {
  const safeFirstName = firstName.trim();
  const safeLastName = lastName.trim();

  if (safeFirstName && safeLastName.toLowerCase() === "user") {
    return safeFirstName;
  }

  const fullName = `${safeFirstName} ${safeLastName}`.trim();
  return fullName || username?.trim() || "";
}
