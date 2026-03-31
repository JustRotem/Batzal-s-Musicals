export function buildAvatarUrl(
  avatarUrl: string | null | undefined,
  version?: string | number | null,
) {
  if (!avatarUrl) {
    return null;
  }

  const isLocalUpload = avatarUrl.startsWith("/uploads/avatars/");

  if (
    !version ||
    !isLocalUpload ||
    avatarUrl.startsWith("blob:") ||
    avatarUrl.startsWith("data:")
  ) {
    return avatarUrl;
  }

  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}v=${encodeURIComponent(String(version))}`;
}
