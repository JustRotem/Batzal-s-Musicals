import { parseDurationToSeconds } from "@/lib/clip-time";
import { extractYouTubeVideoId } from "@/lib/youtube";

type ClipFormValidationInput = {
  title: string;
  sourceTypeRaw: string;
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  startTimeRaw: string;
  endTimeRaw: string;
};

type ClipFormValidationSuccess = {
  ok: true;
  sourceType: "youtube" | "upload";
  normalizedYouTubeVideoId: string | null;
  resolvedStartSeconds: number;
  resolvedEndSeconds: number | null;
};

type ClipFormValidationFailure = {
  ok: false;
  error:
    | "missing-title"
    | "invalid-source"
    | "missing-youtube-video"
    | "invalid-youtube-video"
    | "missing-upload-video"
    | "invalid-upload-url"
    | "invalid-start"
    | "invalid-end"
    | "invalid-range";
  details?: Record<string, unknown>;
};

type ClipFormValidationResult = ClipFormValidationSuccess | ClipFormValidationFailure;

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidUploadedVideoUrl = (value: string) => {
  if (!value) {
    return false;
  }

  return value.startsWith("/") || isValidHttpUrl(value);
};

const parseClipStartSeconds = (value: string) => {
  if (!value.trim()) {
    return 0;
  }

  return parseDurationToSeconds(value);
};

const parseClipEndSeconds = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  return parseDurationToSeconds(value);
};

export const validateClipFormValues = ({
  title,
  sourceTypeRaw,
  youtubeVideoId,
  uploadedVideoUrl,
  startTimeRaw,
  endTimeRaw,
}: ClipFormValidationInput): ClipFormValidationResult => {
  if (!title) {
    return { ok: false, error: "missing-title" };
  }

  if (sourceTypeRaw !== "youtube" && sourceTypeRaw !== "upload") {
    return { ok: false, error: "invalid-source", details: { sourceType: sourceTypeRaw } };
  }

  const sourceType = sourceTypeRaw;
  const normalizedYouTubeVideoId = extractYouTubeVideoId(youtubeVideoId);

  if (sourceType === "youtube" && !normalizedYouTubeVideoId) {
    return { ok: false, error: "missing-youtube-video" };
  }

  if (sourceType === "youtube" && youtubeVideoId && !extractYouTubeVideoId(youtubeVideoId)) {
    return { ok: false, error: "invalid-youtube-video", details: { youtubeVideoId } };
  }

  if (sourceType === "upload" && !uploadedVideoUrl) {
    return { ok: false, error: "missing-upload-video", details: { uploadedVideoUrl } };
  }

  if (sourceType === "upload" && uploadedVideoUrl && !isValidUploadedVideoUrl(uploadedVideoUrl)) {
    return { ok: false, error: "invalid-upload-url", details: { uploadedVideoUrl } };
  }

  const startSeconds = parseClipStartSeconds(startTimeRaw);
  if (startSeconds === null) {
    return { ok: false, error: "invalid-start", details: { startTimeRaw } };
  }
  const resolvedStartSeconds = startSeconds ?? 0;

  const endSeconds = parseClipEndSeconds(endTimeRaw);
  if (endTimeRaw && endSeconds === null) {
    return { ok: false, error: "invalid-end", details: { endTimeRaw } };
  }
  const resolvedEndSeconds = endSeconds ?? null;

  if (resolvedEndSeconds !== null && resolvedEndSeconds <= resolvedStartSeconds) {
    return {
      ok: false,
      error: "invalid-range",
      details: { startSeconds: resolvedStartSeconds, endSeconds: resolvedEndSeconds },
    };
  }

  return {
    ok: true,
    sourceType,
    normalizedYouTubeVideoId,
    resolvedStartSeconds,
    resolvedEndSeconds,
  };
};
