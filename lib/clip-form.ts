import { formatSecondsAsDuration } from "@/lib/clip-time";

export function buildClipInitialValues(values: {
  title?: string | null;
  description?: string | null;
  sourceType?: string | null;
  youtubeVideoId?: string | null;
  uploadedVideoUrl?: string | null;
  uploadedThumbnailUrl?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
}) {
  return {
    title: values.title ?? "",
    description: values.description ?? "",
    sourceType: values.sourceType === "upload" ? "upload" : "youtube",
    youtubeVideoId: values.youtubeVideoId ?? "",
    uploadedVideoUrl: values.uploadedVideoUrl ?? "",
    uploadedThumbnailUrl: values.uploadedThumbnailUrl ?? "",
    startTime: values.startTime ?? formatSecondsAsDuration(values.startSeconds ?? 0),
    endTime: values.endTime ?? formatSecondsAsDuration(values.endSeconds ?? null),
  } as const;
}
