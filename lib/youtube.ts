export function extractYouTubeVideoId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (!trimmed.includes("://") && !trimmed.includes("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.slice(1);
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") ?? "";
      }

      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] ?? "";
      }

      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] ?? "";
      }
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function getYouTubeThumbnailUrl(value: string | null | undefined) {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}
