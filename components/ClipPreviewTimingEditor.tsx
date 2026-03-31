"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatSecondsAsDuration, parseDurationToSeconds } from "@/lib/clip-time";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import { extractYouTubeVideoId } from "@/lib/youtube";

type ClipSourceType = "youtube" | "upload";

type ClipPreviewController = {
  getCurrentTime: () => number;
  playSegment: (start: number, end: number | null) => void;
  seekTo?: (time: number) => void;
};

type ClipPreviewTimingEditorProps = {
  language: AppLanguage;
  sourceType: ClipSourceType;
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  uploadedThumbnailUrl?: string | null;
  initialStartTime: string;
  initialEndTime: string;
  sourcePreviewLabel: string;
  sourcePreviewNote: string;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: unknown }) => void;
            onStateChange?: (event: { data: number; target: unknown }) => void;
          };
        },
      ) => {
        destroy: () => void;
        getDuration: () => number;
        getCurrentTime: () => number;
        pauseVideo: () => void;
        playVideo: () => void;
        seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
      };
      PlayerState: {
        PLAYING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeIframeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is only available in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (youTubeIframeApiPromise) {
    return youTubeIframeApiPromise;
  }

  youTubeIframeApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("YouTube API failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube API failed to load."));
    document.head.appendChild(script);
  });

  return youTubeIframeApiPromise;
}

function isPlausibleHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPlausibleUploadUrl(value: string) {
  return value.startsWith("/") || value.startsWith("blob:") || isPlausibleHttpUrl(value);
}

function resolveStartSeconds(value: string) {
  if (!value.trim()) {
    return 0;
  }

  return parseDurationToSeconds(value);
}

function resolveEndSeconds(value: string) {
  if (!value.trim()) {
    return null;
  }

  return parseDurationToSeconds(value);
}

function clampToDuration(value: number, duration: number | null) {
  const safeValue = Math.max(0, Math.floor(value));

  if (duration === null || duration <= 0) {
    return safeValue;
  }

  return Math.min(safeValue, duration);
}

const getPreviewDerivedState = ({
  sourceType,
  youtubeVideoId,
  uploadedVideoUrl,
  startTime,
  endTime,
  durationSeconds,
  currentTime,
  t,
}: {
  sourceType: ClipSourceType;
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  startTime: string;
  endTime: string;
  durationSeconds: number | null;
  currentTime: number;
  t: ReturnType<typeof getTranslations>["contentEditor"]["clips"];
}) => {
  const resolvedYouTubeVideoId = extractYouTubeVideoId(youtubeVideoId);
  const resolvedUploadUrl = isPlausibleUploadUrl(uploadedVideoUrl) ? uploadedVideoUrl : "";
  const showYouTubePreview = sourceType === "youtube" && Boolean(resolvedYouTubeVideoId);
  const showUploadPreview = sourceType === "upload" && Boolean(resolvedUploadUrl);
  const hasPreviewSource = showYouTubePreview || showUploadPreview;
  const startSeconds = resolveStartSeconds(startTime);
  const endSeconds = resolveEndSeconds(endTime);
  const effectiveEndSeconds = endSeconds ?? durationSeconds;
  const clampedCurrentTime = clampToDuration(currentTime, durationSeconds);
  const hasLoadedDuration = durationSeconds !== null && durationSeconds > 0;
  const selectedDurationSeconds =
    startSeconds !== null &&
    effectiveEndSeconds !== null &&
    effectiveEndSeconds > startSeconds
      ? effectiveEndSeconds - startSeconds
      : null;
  const timingError = (() => {
    if (startSeconds === null) {
      return t.errors["invalid-start"];
    }

    if (endTime.trim() && endSeconds === null) {
      return t.errors["invalid-end"];
    }

    if (typeof endSeconds === "number" && endSeconds <= startSeconds) {
      return t.errors["invalid-range"];
    }

    if (durationSeconds !== null && startSeconds > durationSeconds) {
      return t.startBeyondDuration;
    }

    if (durationSeconds !== null && typeof endSeconds === "number" && endSeconds > durationSeconds) {
      return t.endBeyondDuration;
    }

    return null;
  })();
  const startFieldError =
    startSeconds === null
      ? t.errors["invalid-start"]
      : hasLoadedDuration && startSeconds > durationSeconds
        ? t.startBeyondDuration
        : null;
  const endFieldError =
    endTime.trim() && endSeconds === null
      ? t.errors["invalid-end"]
      : hasLoadedDuration && typeof endSeconds === "number" && endSeconds > durationSeconds
        ? t.endBeyondDuration
        : typeof endSeconds === "number" && startSeconds !== null && endSeconds <= startSeconds
          ? t.errors["invalid-range"]
          : null;
  const canPreview = startSeconds !== null && !timingError;
  const sliderDuration = durationSeconds ?? 0;
  const sliderEnd = endSeconds ?? sliderDuration;
  const startPercent =
    sliderDuration > 0 && startSeconds !== null ? (startSeconds / sliderDuration) * 100 : 0;
  const endPercent = sliderDuration > 0 ? (sliderEnd / sliderDuration) * 100 : 100;

  return {
    resolvedYouTubeVideoId,
    resolvedUploadUrl,
    showYouTubePreview,
    showUploadPreview,
    hasPreviewSource,
    startSeconds,
    endSeconds,
    effectiveEndSeconds,
    clampedCurrentTime,
    hasLoadedDuration,
    selectedDurationSeconds,
    timingError,
    startFieldError,
    endFieldError,
    canPreview,
    sliderDuration,
    sliderEnd,
    startPercent,
    endPercent,
  };
};

function Html5ClipPreview({
  src,
  startSeconds,
  endSeconds,
  shouldSyncStart,
  onDurationChange,
  onCurrentTimeChange,
  onControllerChange,
  posterUrl,
}: {
  src: string;
  startSeconds: number;
  endSeconds: number | null;
  shouldSyncStart: boolean;
  onDurationChange: (duration: number | null) => void;
  onCurrentTimeChange: (time: number) => void;
  onControllerChange: (controller: ClipPreviewController | null) => void;
  posterUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [orientation, setOrientation] = useState<"unknown" | "portrait" | "landscape">("unknown");

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const video = videoElement;

    function handleLoadedMetadata() {
      onDurationChange(Number.isFinite(video.duration) ? Math.floor(video.duration) : null);
      setHasLoadedFrame(false);
      if (Number.isFinite(video.videoWidth) && Number.isFinite(video.videoHeight) && video.videoHeight > 0) {
        const portrait = video.videoHeight > video.videoWidth;
        setIsPortrait(portrait);
        setOrientation(portrait ? "portrait" : "landscape");
      } else {
        setIsPortrait(false);
        setOrientation("unknown");
      }
      video.currentTime = startSeconds > 0 ? startSeconds : 0.1;
      onCurrentTimeChange(Math.floor(startSeconds));
    }

    function handleLoadedData() {
      setHasLoadedFrame(true);
    }

    function handleTimeUpdate() {
      const current = Math.floor(video.currentTime);
      onCurrentTimeChange(current);

      if (typeof endSeconds === "number" && video.currentTime >= endSeconds) {
        video.currentTime = endSeconds;
        video.pause();
      }
    }

    function handlePlay() {
      if (!shouldSyncStart) {
        return;
      }

      if (
        video.currentTime < startSeconds ||
        (typeof endSeconds === "number" && video.currentTime >= endSeconds)
      ) {
        video.currentTime = startSeconds;
      }
    }

    onControllerChange({
      getCurrentTime: () => Math.floor(video.currentTime || 0),
      playSegment: async (start, end) => {
        video.currentTime = start;
        await video.play().catch(() => undefined);

        if (typeof end === "number" && end <= start) {
          video.pause();
        }
      },
      seekTo: (time) => {
        video.currentTime = time;
      },
    });

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);

    return () => {
      onControllerChange(null);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
    };
  }, [
    endSeconds,
    onControllerChange,
    onCurrentTimeChange,
    onDurationChange,
    shouldSyncStart,
    src,
    startSeconds,
  ]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !shouldSyncStart) {
      return;
    }

    const wasPlaying = !video.paused;
    video.currentTime = startSeconds;
    onCurrentTimeChange(Math.floor(startSeconds));
    if (wasPlaying) {
      void video.play().catch(() => undefined);
    }
  }, [onCurrentTimeChange, shouldSyncStart, startSeconds]);

  useEffect(() => {
    setIsPortrait(false);
    setOrientation("unknown");
  }, [src]);

  return (
    <div
      className={`video-frame clip-segment-frame ${isPortrait ? "clip-segment-frame-portrait" : ""}`}
      data-source-type="upload"
      data-orientation={orientation}
    >
      {!hasLoadedFrame ? <div className="clip-video-preview-skeleton" aria-hidden="true" /> : null}
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        poster={posterUrl ?? undefined}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: isPortrait ? "contain" : "cover",
        }}
      >
        Sorry, your browser does not support embedded video previews.
      </video>
    </div>
  );
}

function YouTubeClipPreview({
  videoId,
  startSeconds,
  endSeconds,
  shouldSyncStart,
  onDurationChange,
  onCurrentTimeChange,
  onControllerChange,
}: {
  videoId: string;
  startSeconds: number;
  endSeconds: number | null;
  shouldSyncStart: boolean;
  onDurationChange: (duration: number | null) => void;
  onCurrentTimeChange: (time: number) => void;
  onControllerChange: (controller: ClipPreviewController | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<InstanceType<NonNullable<typeof window.YT>["Player"]> | null>(null);
  const intervalRef = useRef<number | null>(null);
  const segmentEndRef = useRef<number | null>(endSeconds);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    segmentEndRef.current = endSeconds;
  }, [endSeconds]);

  useEffect(() => {
    let cancelled = false;

    function stopPolling() {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    async function mountPlayer() {
      await loadYouTubeIframeApi();

      if (cancelled || !containerRef.current || !window.YT?.Player) {
        return;
      }

      const player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
          start: startSeconds,
        },
        events: {
          onReady: () => {
            const duration = Math.floor(player.getDuration() || 0);
            onDurationChange(duration > 0 ? duration : null);
            onCurrentTimeChange(Math.floor(player.getCurrentTime() || startSeconds || 0));
          },
          onStateChange: (event) => {
            if (!window.YT) {
              wasPlayingRef.current = false;
              stopPolling();
              return;
            }

            wasPlayingRef.current = event.data === window.YT.PlayerState.PLAYING;

            if (event.data !== window.YT.PlayerState.PLAYING) {
              stopPolling();
              return;
            }

            stopPolling();
            intervalRef.current = window.setInterval(() => {
              const current = Math.floor(player.getCurrentTime() || 0);
              onCurrentTimeChange(current);

              if (shouldSyncStart && current < startSeconds) {
                player.seekTo(startSeconds, true);
              }

              if (typeof segmentEndRef.current === "number" && current >= segmentEndRef.current) {
                player.seekTo(segmentEndRef.current, true);
                player.pauseVideo();
                stopPolling();
              }
            }, 250);
          },
        },
      });

      playerRef.current = player;
      onControllerChange({
        getCurrentTime: () => Math.floor(player.getCurrentTime() || 0),
        playSegment: (start, end) => {
          segmentEndRef.current = end;
          player.seekTo(start, true);
          player.playVideo();
        },
        seekTo: (time) => {
          player.seekTo(time, true);
        },
      });
    }

    void mountPlayer();

    return () => {
      cancelled = true;
      stopPolling();
      onControllerChange(null);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [
    onControllerChange,
    onCurrentTimeChange,
    onDurationChange,
    shouldSyncStart,
    startSeconds,
    videoId,
  ]);

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !shouldSyncStart) {
      return;
    }

    player.seekTo(startSeconds, true);
    if (wasPlayingRef.current) {
      player.playVideo();
    }
    onCurrentTimeChange(startSeconds);
  }, [onCurrentTimeChange, shouldSyncStart, startSeconds, videoId]);

  return (
    <div className="video-frame">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function ClipPreviewTimingEditor({
  language,
  sourceType,
  youtubeVideoId,
  uploadedVideoUrl,
  uploadedThumbnailUrl,
  initialStartTime,
  initialEndTime,
  sourcePreviewLabel,
  sourcePreviewNote,
}: ClipPreviewTimingEditorProps) {
  const t = getTranslations(language).contentEditor.clips;
  const [startTime, setStartTime] = useState(initialStartTime || "0:00");
  const [endTime, setEndTime] = useState(initialEndTime || "");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [controller, setController] = useState<ClipPreviewController | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const dragHandleRef = useRef<"start" | "end" | null>(null);
  const [activeHandle, setActiveHandle] = useState<"start" | "end" | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<"start" | "end" | null>(null);
  const {
    resolvedYouTubeVideoId,
    resolvedUploadUrl,
    showYouTubePreview,
    showUploadPreview,
    hasPreviewSource,
    startSeconds,
    endSeconds,
    effectiveEndSeconds,
    clampedCurrentTime,
    hasLoadedDuration,
    selectedDurationSeconds,
    timingError,
    startFieldError,
    endFieldError,
    canPreview,
    sliderDuration,
    sliderEnd,
    startPercent,
    endPercent,
  } = useMemo(
    () =>
      getPreviewDerivedState({
        sourceType,
        youtubeVideoId,
        uploadedVideoUrl,
        startTime,
        endTime,
        durationSeconds,
        currentTime,
        t,
      }),
    [
      currentTime,
      durationSeconds,
      endTime,
      sourceType,
      startTime,
      t,
      uploadedVideoUrl,
      youtubeVideoId,
    ],
  );

  useEffect(() => {
    if (!hasPreviewSource) {
      setDurationSeconds(null);
      setCurrentTime(0);
      setController(null);
    }
  }, [hasPreviewSource]);

  useEffect(() => {
    setDurationSeconds(null);
    setCurrentTime(0);
  }, [sourceType, resolvedUploadUrl, resolvedYouTubeVideoId]);

  const canPreviewSegment = Boolean(controller) && canPreview;
  const shouldSyncStart = startSeconds !== null && !timingError;
  const canScrub = Boolean(controller) && durationSeconds !== null && !timingError;

  function clampTime(value: number) {
    if (!durationSeconds || durationSeconds <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(durationSeconds, value));
  }

  function seekToTimelinePosition(clientX: number) {
    if (!timelineRef.current || !durationSeconds || !controller) {
      return;
    }
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const time = clampTime(percent * durationSeconds);
    controller.seekTo?.(time);
    setCurrentTime(Math.floor(time));
  }

  function handleTimelinePointerDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!canScrub) {
      return;
    }
    isScrubbingRef.current = true;
    seekToTimelinePosition(event.clientX);
  }

  function seekToHandlePosition(clientX: number) {
    if (!timelineRef.current || !durationSeconds) {
      return;
    }
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const rawTime = clampTime(percent * durationSeconds);

    if (dragHandleRef.current === "start") {
      const maxStart = typeof endSeconds === "number" ? Math.max(endSeconds - 1, 0) : durationSeconds;
      const nextStart = Math.min(Math.max(rawTime, 0), maxStart);
      setStartTime(formatSecondsAsDuration(nextStart));
      controller?.seekTo?.(nextStart);
      setCurrentTime(Math.floor(nextStart));
    }

    if (dragHandleRef.current === "end") {
      const minEnd = startSeconds === null ? 1 : startSeconds + 1;
      const nextEnd = Math.max(minEnd, Math.min(rawTime, durationSeconds));
      if (nextEnd >= durationSeconds) {
        setEndTime("");
        return;
      }
      setEndTime(formatSecondsAsDuration(nextEnd));
      controller?.seekTo?.(nextEnd);
      setCurrentTime(Math.floor(nextEnd));
    }
  }

  function startHandleDrag(handle: "start" | "end", event: React.MouseEvent<HTMLDivElement>) {
    if (!canScrub) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragHandleRef.current = handle;
    setActiveHandle(handle);
    seekToHandlePosition(event.clientX);
  }

  useEffect(() => {
    function handleMove(event: MouseEvent) {
      if (dragHandleRef.current) {
        seekToHandlePosition(event.clientX);
        return;
      }

      if (!isScrubbingRef.current) {
        return;
      }
      seekToTimelinePosition(event.clientX);
    }

    function handleUp() {
      isScrubbingRef.current = false;
      dragHandleRef.current = null;
      setActiveHandle(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [canScrub, durationSeconds, controller, endSeconds, startSeconds]);

  function handleStartSliderChange(nextValue: number) {
    if (!sliderDuration) {
      return;
    }

    const safeStart =
      typeof endSeconds === "number" ? Math.min(nextValue, Math.max(endSeconds - 1, 0)) : nextValue;
    setStartTime(formatSecondsAsDuration(safeStart));
  }

  function handleEndSliderChange(nextValue: number) {
    if (!sliderDuration || startSeconds === null) {
      return;
    }

    const safeEnd = Math.max(nextValue, startSeconds + 1);
    if (safeEnd >= sliderDuration) {
      setEndTime("");
      return;
    }

    setEndTime(formatSecondsAsDuration(safeEnd));
  }

  function handleUseCurrentAsStart() {
    const candidate = clampToDuration(clampedCurrentTime, durationSeconds);
    const safeStart =
      typeof endSeconds === "number" ? Math.min(candidate, Math.max(endSeconds - 1, 0)) : candidate;
    setStartTime(formatSecondsAsDuration(safeStart));
  }

  function handleUseCurrentAsEnd() {
    if (startSeconds === null) {
      return;
    }

    const candidate = clampToDuration(clampedCurrentTime, durationSeconds);
    const safeEnd = Math.max(candidate, startSeconds + 1);

    if (durationSeconds !== null && safeEnd >= durationSeconds) {
      setEndTime("");
      return;
    }

    setEndTime(formatSecondsAsDuration(safeEnd));
  }

  function handlePreviewSegment() {
    if (!controller || startSeconds === null || timingError) {
      return;
    }

    controller.playSegment(startSeconds, endSeconds);
  }
  return (
    <section className="clip-preview-panel">
      <div className="clip-media-preview">
        <div className="content-editor-section-header">
          <h3 className="panel-title" style={{ marginBottom: 8 }}>
            {t.previewTitle}
          </h3>
        </div>
        <div className="clip-media-preview-header">
          <strong>{sourcePreviewLabel}</strong>
          <span>{sourcePreviewNote}</span>
        </div>

        {showYouTubePreview ? (
          <YouTubeClipPreview
            key={`youtube-${resolvedYouTubeVideoId}`}
            videoId={resolvedYouTubeVideoId}
            startSeconds={startSeconds ?? 0}
            endSeconds={endSeconds}
            shouldSyncStart={shouldSyncStart}
            onDurationChange={setDurationSeconds}
            onCurrentTimeChange={setCurrentTime}
            onControllerChange={setController}
          />
        ) : null}

        {showUploadPreview ? (
          <Html5ClipPreview
            key={`upload-${resolvedUploadUrl}`}
            src={resolvedUploadUrl}
            startSeconds={startSeconds ?? 0}
            endSeconds={endSeconds}
            shouldSyncStart={shouldSyncStart}
            onDurationChange={setDurationSeconds}
            onCurrentTimeChange={setCurrentTime}
            onControllerChange={setController}
            posterUrl={uploadedThumbnailUrl ?? null}
          />
        ) : null}

        {!showYouTubePreview && !showUploadPreview ? (
          <div className="clip-media-empty-state">
            <strong>{t.noPreviewTitle}</strong>
            <span>{sourceType === "youtube" ? t.noPreviewYoutube : t.noPreviewUpload}</span>
          </div>
        ) : null}
        {durationSeconds && (
          <div
            ref={timelineRef}
            onMouseDown={handleTimelinePointerDown}
            style={{
              marginTop: 12,
              height: 10,
              borderRadius: 999,
              background: "rgba(148, 163, 184, 0.25)",
              position: "relative",
              cursor: canScrub ? "pointer" : "default",
            }}
            aria-hidden={!canScrub}
          >
            <div
              style={{
                position: "absolute",
                left: `${Math.min(100, Math.max(0, startPercent))}%`,
                width: `${Math.max(endPercent - startPercent, 0)}%`,
                top: 0,
                bottom: 0,
                borderRadius: 999,
                background: "rgba(34, 197, 94, 0.6)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${Math.min(100, Math.max(0, (clampedCurrentTime / durationSeconds) * 100))}%`,
                top: -4,
                width: 2,
                height: 18,
                background: "rgba(226, 232, 240, 0.9)",
                borderRadius: 999,
                transform: "translateX(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${Math.min(100, Math.max(0, ((startSeconds ?? 0) / durationSeconds) * 100))}%`,
                top: -2,
                width: activeHandle === "start" ? 10 : hoveredHandle === "start" ? 8 : 6,
                height: activeHandle === "start" ? 18 : hoveredHandle === "start" ? 16 : 14,
                background: activeHandle === "start"
                  ? "rgba(34, 197, 94, 1)"
                  : hoveredHandle === "start"
                    ? "rgba(34, 197, 94, 0.95)"
                    : "rgba(34, 197, 94, 0.9)",
                borderRadius: 999,
                transform: "translateX(-50%)",
                transition: "width 0.12s ease, height 0.12s ease, background 0.12s ease",
                cursor: activeHandle === "start" ? "grabbing" : "grab",
              }}
              onMouseDown={(event) => startHandleDrag("start", event)}
              onMouseEnter={() => setHoveredHandle("start")}
              onMouseLeave={() => setHoveredHandle((current) => (current === "start" ? null : current))}
            />
            {typeof endSeconds === "number" ? (
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(100, Math.max(0, (endSeconds / durationSeconds) * 100))}%`,
                  top: -2,
                  width: activeHandle === "end" ? 10 : hoveredHandle === "end" ? 8 : 6,
                  height: activeHandle === "end" ? 18 : hoveredHandle === "end" ? 16 : 14,
                  background: activeHandle === "end"
                    ? "rgba(34, 197, 94, 1)"
                    : hoveredHandle === "end"
                      ? "rgba(34, 197, 94, 0.95)"
                      : "rgba(34, 197, 94, 0.9)",
                  borderRadius: 999,
                  transform: "translateX(-50%)",
                  transition: "width 0.12s ease, height 0.12s ease, background 0.12s ease",
                  cursor: activeHandle === "end" ? "grabbing" : "grab",
                }}
                onMouseDown={(event) => startHandleDrag("end", event)}
                onMouseEnter={() => setHoveredHandle("end")}
                onMouseLeave={() => setHoveredHandle((current) => (current === "end" ? null : current))}
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="card clip-timing-card">
        <div className="content-editor-section-header">
          <h3 className="panel-title" style={{ marginBottom: 8 }}>
            {t.timingTitle}
          </h3>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.timingText}
          </p>
        </div>

        <div className="clip-timing-metrics">
          <div className="clip-timing-metric">
            <span>{t.currentTimeLabel}</span>
            <strong>{formatSecondsAsDuration(clampedCurrentTime)}</strong>
          </div>
          <div className="clip-timing-metric">
            <span>{t.totalDurationLabel}</span>
            <strong>
              {durationSeconds === null ? "—" : formatSecondsAsDuration(durationSeconds)}
            </strong>
          </div>
          <div className="clip-timing-metric">
            <span>{t.selectedDurationLabel}</span>
            <strong>
              {selectedDurationSeconds === null
                ? effectiveEndSeconds === null && startSeconds !== null
                  ? t.untilVideoEnd
                  : "—"
                : formatSecondsAsDuration(selectedDurationSeconds)}
            </strong>
          </div>
        </div>

        <div className="clip-range-summary" dir="ltr">
          <div className="clip-range-summary-item">
            <span>{t.startLabel}</span>
            <strong>{startSeconds === null ? "—" : formatSecondsAsDuration(startSeconds)}</strong>
          </div>
          <div className="clip-range-summary-item">
            <span>{t.endLabel}</span>
            <strong>
              {typeof endSeconds === "number" ? formatSecondsAsDuration(endSeconds) : t.untilVideoEnd}
            </strong>
          </div>
        </div>

        {durationSeconds !== null ? (
          <div className="clip-range-slider" dir="ltr" aria-label={t.rangeLabel}>
            <div className="clip-range-slider-track" />
            <div
              className="clip-range-slider-fill"
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(endPercent - startPercent, 0)}%`,
              }}
            />
            <input
              type="range"
              min="0"
              max={String(Math.max(sliderDuration, 0))}
              value={String(Math.min(startSeconds ?? 0, Math.max(sliderDuration - 1, 0)))}
              className="clip-range-slider-input clip-range-slider-input-start"
              onChange={(event) => handleStartSliderChange(Number(event.currentTarget.value))}
            />
            <input
              type="range"
              min="0"
              max={String(sliderDuration)}
              value={String(Math.min(Math.max(sliderEnd, 0), sliderDuration))}
              className="clip-range-slider-input clip-range-slider-input-end"
              onChange={(event) => handleEndSliderChange(Number(event.currentTarget.value))}
            />
          </div>
        ) : (
          <div className="show-meta clip-timing-status" style={{ marginTop: 0 }}>
            {hasPreviewSource ? t.timingUnavailable : t.previewUnavailableUntilSource}
          </div>
        )}

        <div className="content-editor-grid content-editor-grid-compact">
          <div className="field">
            <label className="field-label" htmlFor="clip-start-time">
              {t.startLabel}
            </label>
            <input
              id="clip-start-time"
              name="startTime"
              className="input"
              value={startTime}
              onChange={(event) => setStartTime(event.currentTarget.value)}
              placeholder="0:00"
              dir="ltr"
              style={{ textAlign: "left" }}
              aria-invalid={startFieldError ? true : undefined}
            />
            <div className="show-meta" style={{ marginTop: 0 }}>
              {t.startHint}
            </div>
            {startFieldError ? <div className="field-error-text">{startFieldError}</div> : null}
            <button type="button" className="button-secondary button-small" onClick={handleUseCurrentAsStart}>
              {t.useCurrentAsStart}
            </button>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="clip-end-time">
              {t.endLabel}
            </label>
            <input
              id="clip-end-time"
              name="endTime"
              className="input"
              value={endTime}
              onChange={(event) => setEndTime(event.currentTarget.value)}
              placeholder={t.untilVideoEnd}
              dir="ltr"
              style={{ textAlign: "left" }}
              aria-invalid={endFieldError ? true : undefined}
            />
            <div className="show-meta" style={{ marginTop: 0 }}>
              {t.endHint}
            </div>
            {endFieldError ? <div className="field-error-text">{endFieldError}</div> : null}
            <div className="clip-timing-inline-actions">
              <button type="button" className="button-secondary button-small" onClick={handleUseCurrentAsEnd}>
                {t.useCurrentAsEnd}
              </button>
              <button type="button" className="button-secondary button-small" onClick={() => setEndTime("")}>
                {t.clearEnd}
              </button>
            </div>
          </div>
        </div>

        <div className="clip-timing-preview-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handlePreviewSegment}
            disabled={!canPreviewSegment}
          >
            {t.previewSegment}
          </button>
        </div>

        {timingError ? <div className="form-message error">{timingError}</div> : null}
      </div>
    </section>
  );
}
