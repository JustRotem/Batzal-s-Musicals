"use client";

import { useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import UploadedVideoPlayer from "@/components/UploadedVideoPlayer";
import type { AppLanguage } from "@/lib/i18n";
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from "@/lib/youtube";

type LazyClipPlayerProps = {
  language: AppLanguage;
  title: string;
  sourceType: "youtube" | "upload";
  youtubeVideoId: string | null;
  uploadedVideoUrl: string | null;
  uploadedThumbnailUrl?: string | null;
  start: number;
  end: number | null;
  fallbackText?: string;
};

export default function LazyClipPlayer({
  language,
  title,
  sourceType,
  youtubeVideoId,
  uploadedVideoUrl,
  uploadedThumbnailUrl,
  start,
  end,
  fallbackText,
}: LazyClipPlayerProps) {
  const [activated, setActivated] = useState(false);
  const [autoPlayOnActivate, setAutoPlayOnActivate] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [uploadPreviewReady, setUploadPreviewReady] = useState(false);
  const resolvedYouTubeVideoId = extractYouTubeVideoId(youtubeVideoId);
  const youtubePosterUrl = getYouTubeThumbnailUrl(youtubeVideoId);
  const copy =
    language === "en"
      ? {
          action: "Play clip",
          play: "Play",
          pause: "Pause",
        }
      : {
          action: "נגן קליפ",
          play: "נגן",
          pause: "עצור",
        };

  useEffect(() => {
    setUploadPreviewReady(false);
  }, [uploadedVideoUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const handleChange = (event: MediaQueryListEvent) => setIsTouchMode(event.matches);
    setIsTouchMode(media.matches);

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (isTouchMode && sourceType === "youtube" && !activated) {
      setActivated(true);
      setAutoPlayOnActivate(false);
    }
  }, [activated, isTouchMode, sourceType]);

  if (!activated) {
    return (
      <button
        type="button"
        className={`clip-player-surface video-frame ${
          sourceType === "upload" ? "clip-player-surface-upload" : ""
        }`}
        onClick={() => {
          setAutoPlayOnActivate(true);
          setActivated(true);
        }}
        aria-label={`${copy.action}: ${title}`}
      >
        {youtubePosterUrl ? (
          <img src={youtubePosterUrl} alt="" aria-hidden="true" className="clip-player-surface-image" />
        ) : sourceType === "upload" && uploadedThumbnailUrl ? (
          <img
            src={uploadedThumbnailUrl}
            alt=""
            aria-hidden="true"
            className="clip-player-surface-image"
          />
        ) : sourceType === "upload" && uploadedVideoUrl ? (
          <>
            {!uploadPreviewReady ? <div className="clip-player-surface-upload-placeholder" aria-hidden="true" /> : null}
            <video
              className="clip-player-surface-video"
              src={uploadedVideoUrl}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;

                if (!Number.isFinite(video.duration)) {
                  setUploadPreviewReady(true);
                  return;
                }

                video.currentTime = Math.min(Math.max(start, 0.15), Math.max(video.duration - 0.15, 0.15));
              }}
              onSeeked={() => setUploadPreviewReady(true)}
              onLoadedData={() => setUploadPreviewReady(true)}
            />
          </>
        ) : null}
        <div className="clip-player-surface-overlay" />
        <div className="clip-player-surface-play" aria-hidden="true">
          <span className="clip-player-surface-play-icon" />
        </div>
      </button>
    );
  }

  if (sourceType === "youtube" && resolvedYouTubeVideoId) {
    return (
      <VideoPlayer
        videoId={resolvedYouTubeVideoId}
        start={start}
        end={end}
        autoPlay={autoPlayOnActivate}
        playLabel={copy.play}
        pauseLabel={copy.pause}
      />
    );
  }

  if (sourceType === "upload" && uploadedVideoUrl) {
    return (
      <UploadedVideoPlayer
        src={uploadedVideoUrl}
        uploadedThumbnailUrl={uploadedThumbnailUrl ?? null}
        start={start}
        end={end}
        autoPlay={autoPlayOnActivate}
        playLabel={copy.play}
        pauseLabel={copy.pause}
        fallbackText={fallbackText}
      />
    );
  }

  return null;
}
