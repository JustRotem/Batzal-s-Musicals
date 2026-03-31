"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { formatSecondsAsDuration } from "@/lib/clip-time";
import { usePreserveScrollOnFullscreen } from "@/components/usePreserveScrollOnFullscreen";
import { clearActivePlayerToken, isActivePlayerToken, setActivePlayerToken } from "@/lib/player-shortcuts";

type UploadedVideoPlayerProps = {
  src: string;
  start?: number;
  end?: number | null;
  fallbackText?: string;
  playLabel?: string;
  pauseLabel?: string;
  autoPlay?: boolean;
  uploadedThumbnailUrl?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return !!target.closest("button, input, select, textarea, a");
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M8 6.75v10.5L17 12 8 6.75Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M8 6h3.5v12H8V6Zm4.5 0H16v12h-3.5V6Z" fill="currentColor" />
    </svg>
  );
}

function FullscreenEnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M9 5H5v4M19 9V5h-4M15 19h4v-4M5 15v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VolumeHighIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M5 9v6h4l5 4V5l-5 4H5Z" fill="currentColor" />
      <path d="M17 9.5a4 4 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 7a7.5 7.5 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function VolumeMuteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <path d="M5 9v6h4l5 4V5l-5 4H5Z" fill="currentColor" />
      <path d="m17 9 4 4m0-4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadedVideoPlayer({
  src,
  start = 0,
  end = null,
  fallbackText = "Your browser does not support video playback.",
  playLabel = "Play",
  pauseLabel = "Pause",
  autoPlay = false,
  uploadedThumbnailUrl = null,
}: UploadedVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const controlsHideTimeoutRef = useRef<number | null>(null);
  const skipResetTimeoutRef = useRef<number | null>(null);
  const cursorTimeoutRef = useRef<number | null>(null);
  const skipAccumRef = useRef(0);
  const lastVolumeBeforeMuteRef = useRef(1);
  const hasInteractedRef = useRef(false);
  const playerTokenRef = useRef<symbol>(Symbol("uploaded-player"));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sourceDuration, setSourceDuration] = useState<number | null>(null);
  const [currentSourceTime, setCurrentSourceTime] = useState(start);
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackFeedback, setPlaybackFeedback] = useState<"play" | "pause" | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [orientation, setOrientation] = useState<"unknown" | "portrait" | "landscape">("unknown");
  const [skipState, setSkipState] = useState<{
    amount: number;
    direction: "left" | "right" | null;
    visible: boolean;
  }>({ amount: 0, direction: null, visible: false });

  const safeSkipAmount = Math.round(skipState.amount);
  const skipText = useMemo(() => {
    if (safeSkipAmount === 0) {
      return null;
    }
    return `${safeSkipAmount > 0 ? "" : "-"}${Math.abs(safeSkipAmount)}s`;
  }, [safeSkipAmount]);

  usePreserveScrollOnFullscreen(containerRef);

  function markActive() {
    hasInteractedRef.current = true;
    setActivePlayerToken(playerTokenRef.current);
  }

  useEffect(() => {
    return () => {
      clearActivePlayerToken(playerTokenRef.current);
    };
  }, []);

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
    setOrientation("unknown");
    setIsPortrait(false);
    setHasStarted(false);
  }, [src]);

  const safeStart = Math.max(0, Math.floor(start));
  const effectiveEnd = useMemo(() => {
    if (typeof end === "number") {
      return end;
    }

    if (typeof sourceDuration === "number" && sourceDuration > safeStart) {
      return sourceDuration;
    }

    return null;
  }, [end, safeStart, sourceDuration]);

  const segmentDuration = useMemo(() => {
    if (effectiveEnd === null) {
      return null;
    }

    return Math.max(effectiveEnd - safeStart, 0);
  }, [effectiveEnd, safeStart]);

  function clearControlsHideTimeout() {
    if (controlsHideTimeoutRef.current !== null) {
      window.clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }

  function clearSkipResetTimeout() {
    if (skipResetTimeoutRef.current !== null) {
      window.clearTimeout(skipResetTimeoutRef.current);
      skipResetTimeoutRef.current = null;
    }
  }

  function clearCursorTimeout() {
    if (cursorTimeoutRef.current !== null) {
      window.clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = null;
    }
  }

  function clearClickTimeout() {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }

  function showCursorTemporarily() {
    setIsCursorVisible(true);
    clearCursorTimeout();
    cursorTimeoutRef.current = window.setTimeout(() => {
      setIsCursorVisible(false);
    }, 1500);
  }

  function revealControls() {
    setControlsVisible(true);
    clearControlsHideTimeout();

    if (isPlaying) {
      if (isTouchMode) {
        return;
      }
      controlsHideTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, isTouchMode ? 3200 : 1800);
    }
  }

  function pulsePlaybackFeedback(type: "play" | "pause") {
    setPlaybackFeedback(type);
    window.setTimeout(() => {
      setPlaybackFeedback((current) => (current === type ? null : current));
    }, 420);
  }

  function recordSkip(deltaSeconds: number) {
    if (!Number.isFinite(deltaSeconds)) {
      return;
    }
    skipAccumRef.current += deltaSeconds;
    setSkipState({
      amount: skipAccumRef.current,
      direction: deltaSeconds > 0 ? "right" : "left",
      visible: true,
    });
    clearSkipResetTimeout();
    skipResetTimeoutRef.current = window.setTimeout(() => {
      skipAccumRef.current = 0;
      setSkipState({ amount: 0, direction: null, visible: false });
    }, 400);
  }

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const video = videoElement;

    function handleLoadedMetadata() {
      setSourceDuration(Number.isFinite(video.duration) ? video.duration : null);
      if (Number.isFinite(video.videoWidth) && Number.isFinite(video.videoHeight) && video.videoHeight > 0) {
        const portrait = video.videoHeight > video.videoWidth;
        setIsPortrait(portrait);
        setOrientation(portrait ? "portrait" : "landscape");
      } else {
        setIsPortrait(false);
        setOrientation("unknown");
      }
      const maxStart = Number.isFinite(video.duration)
        ? Math.max(video.duration - 0.25, 0)
        : safeStart;
      const nextTime = Math.min(safeStart, maxStart);
      video.currentTime = nextTime;
      setCurrentSourceTime(nextTime);

      if (autoPlay) {
        void video.play().catch(() => undefined);
      }
    }

    function handleTimeUpdate() {
      const current = video.currentTime;

      if (typeof effectiveEnd === "number" && current >= effectiveEnd) {
        video.pause();
        video.currentTime = safeStart;
        setCurrentSourceTime(safeStart);
        setIsPlaying(false);
        return;
      }

      if (!isSeeking) {
        setCurrentSourceTime(current);
        setSeekValue(Math.max(current - safeStart, 0));
      }
    }

    function handlePlay() {
      if (
        video.currentTime < safeStart ||
        (typeof effectiveEnd === "number" && video.currentTime >= effectiveEnd)
      ) {
        video.currentTime = safeStart;
      }

      markActive();
      setIsPlaying(true);
      setHasStarted(true);
    }

    function handlePause() {
      setIsPlaying(false);
    }

    function handleVolumeStateChange() {
      setIsMuted(video.muted);
      setVolume(video.muted ? 0 : video.volume);

      if (!video.muted && video.volume > 0) {
        lastVolumeBeforeMuteRef.current = video.volume;
      }
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeStateChange);
    handleVolumeStateChange();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeStateChange);
    };
  }, [effectiveEnd, isSeeking, safeStart, src]);

  useEffect(() => {
    return () => {
      clearClickTimeout();
      clearControlsHideTimeout();
      clearSkipResetTimeout();
      clearCursorTimeout();
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      const nextFullscreen = document.fullscreenElement === containerRef.current;
      setIsFullscreen(nextFullscreen);
      if (nextFullscreen) {
        showCursorTemporarily();
        return;
      }
      setIsCursorVisible(true);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      clearControlsHideTimeout();
      return;
    }

    revealControls();

    return () => {
      clearControlsHideTimeout();
    };
  }, [isFullscreen, isPlaying]);

  useEffect(() => {
    if (isFullscreen && isPlaying) {
      showCursorTemporarily();
    }
  }, [isFullscreen, isPlaying]);

  const currentClipTime = isSeeking ? seekValue : Math.max(currentSourceTime - safeStart, 0);
  const sliderMax = Math.max(segmentDuration ?? 0, 0);
  const playedPercent = sliderMax > 0 ? clamp((currentClipTime / sliderMax) * 100, 0, 100) : 0;

  function togglePlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    markActive();

    if (video.paused) {
      if (typeof effectiveEnd === "number" && video.currentTime >= effectiveEnd) {
        video.currentTime = safeStart;
        setCurrentSourceTime(safeStart);
      }

      pulsePlaybackFeedback("play");
      void video.play();
      containerRef.current?.focus();
      return;
    }

    pulsePlaybackFeedback("pause");
    video.pause();
    containerRef.current?.focus();
  }

  function handleSeek(nextClipSeconds: number) {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const safeClipTime = clamp(nextClipSeconds, 0, sliderMax);
    const nextSourceTime = safeStart + safeClipTime;
    setSeekValue(safeClipTime);
    video.currentTime = nextSourceTime;
    setCurrentSourceTime(nextSourceTime);
  }

  function skipBy(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextTime = clamp(
      video.currentTime + deltaSeconds,
      safeStart,
      typeof effectiveEnd === "number" ? effectiveEnd : video.duration || 0,
    );
    video.currentTime = nextTime;
    setCurrentSourceTime(nextTime);
    setSeekValue(Math.max(nextTime - safeStart, 0));
    recordSkip(deltaSeconds);
    revealControls();
    containerRef.current?.focus();
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    markActive();
    containerRef.current?.focus();

    if (document.fullscreenElement === container) {
      await document.exitFullscreen().catch(() => undefined);
      containerRef.current?.focus();
      return;
    }

    await container.requestFullscreen?.().catch(() => undefined);
    containerRef.current?.focus();
  }

  function handleSurfaceClick() {
    markActive();
    clearClickTimeout();
    if (isTouchMode) {
      return;
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      togglePlayback();
      clickTimeoutRef.current = null;
    }, 220);
  }

  function handleSurfaceDoubleClick() {
    if (isTouchMode) {
      return;
    }
    markActive();
    clearClickTimeout();
    void toggleFullscreen();
  }

  function handleVolumeChange(nextVolume: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    markActive();
    const clampedVolume = clamp(nextVolume, 0, 1);
    if (clampedVolume > 0) {
      lastVolumeBeforeMuteRef.current = clampedVolume;
    }
    video.volume = clampedVolume;
    video.muted = clampedVolume <= 0;
    revealControls();
    containerRef.current?.focus();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    markActive();
    const nextMuted = !video.muted;

    if (!nextMuted && video.volume === 0) {
      video.volume = lastVolumeBeforeMuteRef.current > 0 ? lastVolumeBeforeMuteRef.current : 0.6;
    }

    if (nextMuted && video.volume > 0) {
      lastVolumeBeforeMuteRef.current = video.volume;
    }

    video.muted = nextMuted;

    revealControls();
    containerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      markActive();
      togglePlayback();
      revealControls();
      return;
    }

    if (event.code === "KeyF") {
      event.preventDefault();
      markActive();
      void toggleFullscreen();
      revealControls();
      containerRef.current?.focus();
      return;
    }

    if (event.code === "ArrowRight") {
      event.preventDefault();
      markActive();
      skipBy(5);
      return;
    }

    if (event.code === "ArrowLeft") {
      event.preventDefault();
      markActive();
      skipBy(-5);
    }

    if (event.code === "KeyM") {
      event.preventDefault();
      markActive();
      toggleMute();
      revealControls();
    }
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      const shouldHandle =
        (hasInteractedRef.current || isPlaying || isFullscreen) &&
        isActivePlayerToken(playerTokenRef.current);
      if (!shouldHandle) {
        return;
      }

      const code = event.code;

      if (code === "Space") {
        event.preventDefault();
        togglePlayback();
        revealControls();
        return;
      }

      if (code === "KeyF") {
        event.preventDefault();
        void toggleFullscreen();
        revealControls();
        containerRef.current?.focus();
        return;
      }

      if (code === "ArrowRight") {
        event.preventDefault();
        skipBy(5);
        return;
      }

      if (code === "ArrowLeft") {
        event.preventDefault();
        skipBy(-5);
      }

      if (code === "KeyM") {
        event.preventDefault();
        toggleMute();
        revealControls();
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isFullscreen, isPlaying]);

  return (
    <div
      ref={containerRef}
      className="clip-segment-player"
      data-source-type="upload"
      data-orientation={orientation}
      data-playing={isPlaying ? "true" : "false"}
      data-controls-visible={controlsVisible ? "true" : "false"}
      data-cursor-hidden={
        isFullscreen && !controlsVisible && !isCursorVisible ? "true" : "false"
      }
      onMouseMove={() => {
        showCursorTemporarily();
        revealControls();
      }}
      onTouchStart={() => {
        showCursorTemporarily();
        revealControls();
      }}
      onFocus={() => {
        showCursorTemporarily();
        revealControls();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className={`video-frame clip-segment-frame ${isPortrait ? "clip-segment-frame-portrait" : ""} ${
          !hasStarted ? "clip-segment-frame-preview" : ""
        }`}
        onClick={isTouchMode ? undefined : handleSurfaceClick}
        onDoubleClick={isTouchMode ? undefined : handleSurfaceDoubleClick}
      >
        <video
          ref={videoRef}
          preload="metadata"
          playsInline
          controls={isTouchMode}
          poster={uploadedThumbnailUrl ?? undefined}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: isPortrait ? "contain" : "cover",
          }}
        >
          <source src={src} />
          {fallbackText}
        </video>
        {!isTouchMode && playbackFeedback ? (
          <div className={`clip-feedback-overlay is-${playbackFeedback}`} aria-hidden="true">
            {playbackFeedback === "play" ? <PlayIcon /> : <PauseIcon />}
          </div>
        ) : null}
        {!isTouchMode && skipState.visible && safeSkipAmount !== 0 && skipState.direction ? (
          <div
            className={`clip-skip-overlay clip-skip-overlay-${skipState.direction}`}
            aria-hidden="true"
          >
            <span className="clip-skip-badge" dir="ltr">
              {skipState.direction === "left" ? `< ${skipText}` : `${skipText} >`}
            </span>
          </div>
        ) : null}
        {!isTouchMode ? (
          <div className="clip-segment-controls-overlay" dir="ltr">
            <div className="clip-segment-controls" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="button-secondary button-small clip-segment-play-button"
                onClick={togglePlayback}
                aria-label={isPlaying ? pauseLabel : playLabel}
                title={isPlaying ? pauseLabel : playLabel}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <div className="clip-segment-progress">
                <input
                  type="range"
                  min="0"
                  max={String(sliderMax)}
                  value={String(clamp(currentClipTime, 0, sliderMax))}
                  style={{ "--clip-progress": `${playedPercent}%` } as CSSProperties}
                  onChange={(event) => {
                    revealControls();
                    handleSeek(Number(event.currentTarget.value));
                  }}
                  onPointerDown={() => setIsSeeking(true)}
                  onPointerUp={() => {
                    setIsSeeking(false);
                  }}
                  onPointerCancel={() => setIsSeeking(false)}
                  onBlur={() => setIsSeeking(false)}
                  disabled={sliderMax <= 0}
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="clip-segment-time">
                  <span>{formatSecondsAsDuration(currentClipTime)}</span>
                  <span>{segmentDuration === null ? "—" : formatSecondsAsDuration(segmentDuration)}</span>
                </div>
              </div>

              <button
                type="button"
                className="button-secondary button-small clip-segment-volume-button"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeMuteIcon /> : <VolumeHighIcon />}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={String(isMuted ? 0 : volume)}
                className="clip-segment-volume-slider"
                onChange={(event) => handleVolumeChange(Number(event.currentTarget.value))}
                aria-label="Volume"
                title="Volume"
                onClick={(event) => event.stopPropagation()}
              />

              <button
                type="button"
                className="button-secondary button-small clip-segment-fullscreen-button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(UploadedVideoPlayer);
