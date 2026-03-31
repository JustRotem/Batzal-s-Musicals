export function buildAvatarUrl(
  avatarUrl: string | null | undefined,
  version?: string | number | null,
) {
  if (!avatarUrl) {
    return null;
  }

  if (!version || avatarUrl.startsWith("blob:") || avatarUrl.startsWith("data:")) {
    return avatarUrl;
  }

  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}v=${encodeURIComponent(String(version))}`;
}
