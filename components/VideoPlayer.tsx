"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { formatSecondsAsDuration } from "@/lib/clip-time";
import { usePreserveScrollOnFullscreen } from "@/components/usePreserveScrollOnFullscreen";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { clearActivePlayerToken, isActivePlayerToken, setActivePlayerToken } from "@/lib/player-shortcuts";

type Props = {
  videoId: string;
  start: number;
  end: number | null;
  playLabel?: string;
  pauseLabel?: string;
  autoPlay?: boolean;
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

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVolume: () => number;
  getOption?: (module: string, option: string) => unknown;
  loadModule: (moduleName: string) => void;
  isMuted: () => boolean;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setOption?: (module: string, option: string, value: unknown) => void;
  setVolume: (value: number) => void;
  unloadModule: (moduleName: string) => void;
  unMute: () => void;
};

type CaptionTrack = { code: string; name: string };

const CAPTION_PREFERENCE_KEY = "bz-caption-language";

// A language is always shown in its own language (English, Español, עברית), whatever language the site is in.
function nativeLanguageName(code: string) {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);

    return name && name !== code ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : null;
  } catch {
    return null;
  }
}

// The player only lists caption tracks after its captions module has loaded, so the list is read by polling.
function readCaptionTracks(player: YouTubePlayer): CaptionTrack[] {
  const raw = player.getOption?.("captions", "tracklist");

  if (!Array.isArray(raw)) {
    return [];
  }

  const tracks: CaptionTrack[] = [];

  for (const track of raw as Array<{ languageCode?: string; languageName?: string; displayName?: string; kind?: string }>) {
    if (!track?.languageCode || tracks.some((existing) => existing.code === track.languageCode)) {
      continue;
    }

    tracks.push({
      code: track.languageCode,
      name: nativeLanguageName(track.languageCode) || track.languageName || track.displayName || track.languageCode,
    });
  }

  return tracks;
}

// The YouTube player takes the focus when its modules load, and the browser then scrolls the page to the player ("it
// jumps back to the middle while I scroll"). This puts the page back unless the person has just scrolled on purpose.
let lastScrollInput = 0;

function noteScrollInput() {
  lastScrollInput = Date.now();
}

function keepScrollPosition(action: () => void) {
  const x = window.scrollX;
  const y = window.scrollY;

  action();

  const check = () => {
    if (Date.now() - lastScrollInput > 700 && Math.abs(window.scrollY - y) > 30) {
      window.scrollTo(x, y);
    }
  };

  for (const delay of [30, 150, 400, 900]) window.setTimeout(check, delay);
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

function CaptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="clip-control-icon">
      <rect x="4" y="6.5" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 11h-1a1.5 1.5 0 1 0 0 3h1M14.5 11h1a1.5 1.5 0 1 1 0 3h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function VideoPlayer({
  videoId,
  start,
  end,
  playLabel = "Play",
  pauseLabel = "Pause",
  autoPlay = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const controlsHideTimeoutRef = useRef<number | null>(null);
  const skipResetTimeoutRef = useRef<number | null>(null);
  const skipAccumRef = useRef(0);
  const cursorTimeoutRef = useRef<number | null>(null);
  const skipDirectionTimeoutRef = useRef<number | null>(null);
  const lastVolumeBeforeMuteRef = useRef(1);
  const hasInteractedRef = useRef(false);
  const captionLangRef = useRef<string | null>(null);
  const isSeekingRef = useRef(false);
  const effectiveEndRef = useRef<number | null>(null);
  const actionsRef = useRef<{
    skipBy: (delta: number) => void;
    togglePlayback: () => void;
    toggleCaptions: () => void;
    toggleMute: () => void;
    toggleFullscreen: () => Promise<void>;
    revealControls: () => void;
  } | null>(null);
  const playerTokenRef = useRef<symbol>(Symbol("youtube-player"));
  const resumeTimeRef = useRef<number | null>(null);
  const resumePlayingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const resolvedVideoId = extractYouTubeVideoId(videoId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullDuration, setFullDuration] = useState<number | null>(null);
  const [currentSourceTime, setCurrentSourceTime] = useState(start);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [captionTracks, setCaptionTracks] = useState<CaptionTrack[]>([]);
  const [captionLang, setCaptionLang] = useState<string | null>(null);
  const [captionMenuOpen, setCaptionMenuOpen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [skipAmount, setSkipAmount] = useState(0);
  const [skipVisible, setSkipVisible] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const [skipDirection, setSkipDirection] = useState<"left" | "right" | null>(null);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  // iPhone Safari cannot make a page element fullscreen: the player then fills the screen itself
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);

  const safeSkipAmount = Math.round(skipAmount);
  const skipText = useMemo(() => {
    if (safeSkipAmount === 0) {
      return null;
    }
    return `${safeSkipAmount > 0 ? "" : "-"}${Math.abs(safeSkipAmount)}s`;
  }, [safeSkipAmount]);

  const { captureScroll } = usePreserveScrollOnFullscreen(containerRef);

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

  const effectiveEnd = useMemo(() => {
    if (typeof end === "number") {
      return end;
    }

    if (typeof fullDuration === "number" && fullDuration > start) {
      return fullDuration;
    }

    return null;
  }, [end, fullDuration, start]);

  isSeekingRef.current = isSeeking;
  effectiveEndRef.current = effectiveEnd;
  captionLangRef.current = captionLang;

  const segmentDuration = useMemo(() => {
    if (effectiveEnd === null) {
      return null;
    }

    return Math.max(effectiveEnd - start, 0);
  }, [effectiveEnd, start]);

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

  function clearClickTimeout() {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }

  function showCursorTemporarily() {
    setIsCursorVisible(true);
    if (cursorTimeoutRef.current !== null) {
      window.clearTimeout(cursorTimeoutRef.current);
    }
    cursorTimeoutRef.current = window.setTimeout(() => {
      setIsCursorVisible(false);
    }, 1800);
  }

  function revealControls() {
    setControlsVisible(true);
    clearControlsHideTimeout();

    // on the phone's full screen the bar goes away after a few seconds even when paused: the picture is the whole screen
    if (isPlaying || pseudoFullscreen) {
      controlsHideTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, isTouchMode ? 3200 : 1800);
    }
  }

  function selectCaption(code: string | null) {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    markActive();
    setCaptionLang(code);
    setCaptionMenuOpen(false);

    try {
      window.localStorage.setItem(CAPTION_PREFERENCE_KEY, code ?? "off");
    } catch {
      // the choice still applies for this video
    }

    if (code) {
      keepScrollPosition(() => {
        player.loadModule?.("captions");
        player.setOption?.("captions", "track", { languageCode: code });
      });
    } else {
      player.unloadModule?.("captions");
    }
  }

  useEffect(() => {
    const events = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

    for (const name of events) window.addEventListener(name, noteScrollInput, { passive: true });

    return () => {
      for (const name of events) window.removeEventListener(name, noteScrollInput);
    };
  }, []);

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

      if (cancelled || !mountRef.current || !window.YT?.Player) {
        return;
      }

      const player = new window.YT.Player(mountRef.current, {
        videoId: resolvedVideoId,
        playerVars: {
          controls: 0,
          rel: 0,
          playsinline: 1,
          start,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          cc_load_policy: 0,
        },
        events: {
          onReady: () => {
            const readyPlayer = player as unknown as YouTubePlayer;

            // the iframe is only a picture (our controls drive it). On a phone it stays touchable until the first start,
            // because the very first play has to be YouTube's own button there.
            if (!isTouchMode) {
              (player as unknown as { getIframe?: () => HTMLIFrameElement }).getIframe?.()?.setAttribute("inert", "");
            }

            const duration = readyPlayer.getDuration() || 0;
            const initialTime = start;
            const shouldResumePlayback = autoPlay;
            setFullDuration(duration > 0 ? duration : null);
            setCurrentSourceTime(initialTime);
            setSeekValue(Math.max(initialTime - start, 0));
            setIsReady(true);
            setVolume((readyPlayer.getVolume() ?? 100) / 100);
            setIsMuted(readyPlayer.isMuted() ?? false);
            readyPlayer.seekTo(initialTime, true);
            if (shouldResumePlayback) {
              readyPlayer.playVideo();
            }
          },
          onStateChange: (event) => {
            const isCurrentlyPlaying =
              !!window.YT && event.data === window.YT.PlayerState.PLAYING;
            wasPlayingRef.current = isCurrentlyPlaying;
            setIsPlaying(isCurrentlyPlaying);

            if (isCurrentlyPlaying) setHasPlayed(true);

            if (!isCurrentlyPlaying) {
              stopPolling();
              return;
            }

            markActive();
            stopPolling();
            intervalRef.current = window.setInterval(() => {
              if (typeof player.getCurrentTime !== "function") {
                return;
              }

              const current = player.getCurrentTime() || start;
              const endTime = effectiveEndRef.current;

              if (!isSeekingRef.current) {
                setCurrentSourceTime(current);
                setSeekValue(Math.max(current - start, 0));
              }

              if (typeof endTime === "number" && current >= endTime) {
                player.pauseVideo();
                player.seekTo(endTime, true);
                setCurrentSourceTime(endTime);
                setSeekValue(Math.max(endTime - start, 0));
                setIsPlaying(false);
                stopPolling();
              }
            }, 200);
          },
        },
      });

      const typedPlayer = player as unknown as YouTubePlayer;
      playerRef.current = typedPlayer;
    }

    if (resolvedVideoId) {
      void mountPlayer();
    }

    return () => {
      cancelled = true;
      stopPolling();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [isTouchMode, resolvedVideoId, start]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let tries = 0;
    const timer = window.setInterval(() => {
      const player = playerRef.current;

      if (!player || typeof player.loadModule !== "function") {
        return;
      }

      tries += 1;
      keepScrollPosition(() => player.loadModule("captions"));
      const tracks = readCaptionTracks(player);

      if (tracks.length > 0 || tries >= 12) {
        window.clearInterval(timer);
        setCaptionTracks(tracks);

        let preferred: string | null = null;

        try {
          preferred = window.localStorage.getItem(CAPTION_PREFERENCE_KEY);
        } catch {
          preferred = null;
        }

        const chosen = tracks.find((track) => track.code === preferred);

        if (chosen) {
          setCaptionLang(chosen.code);
          player.setOption?.("captions", "track", { languageCode: chosen.code });
        } else {
          player.unloadModule("captions");
        }
      }
    }, 700);

    return () => window.clearInterval(timer);
  }, [isReady]);

  useEffect(() => {
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      const isNowFullscreen = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isNowFullscreen);
      if (isNowFullscreen) {
        showCursorTemporarily();
      } else {
        setIsCursorVisible(true);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearClickTimeout();
      clearControlsHideTimeout();
      clearSkipResetTimeout();
      if (skipDirectionTimeoutRef.current !== null) {
        window.clearTimeout(skipDirectionTimeoutRef.current);
      }
      if (cursorTimeoutRef.current !== null) {
        window.clearTimeout(cursorTimeoutRef.current);
      }
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
    skipAccumRef.current = 0;
    setSkipAmount(0);
    setSkipVisible(false);
    setSkipDirection(null);

    if (skipResetTimeoutRef.current !== null) {
      window.clearTimeout(skipResetTimeoutRef.current);
      skipResetTimeoutRef.current = null;
    }

    if (skipDirectionTimeoutRef.current !== null) {
      window.clearTimeout(skipDirectionTimeoutRef.current);
      skipDirectionTimeoutRef.current = null;
    }
  }, [videoId, start, end]);

  useEffect(() => {
    setControlsVisible(true);
    setIsCursorVisible(true);
  }, [videoId, start, end]);

  useEffect(() => {
    if (isFullscreen) {
      showCursorTemporarily();
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isReady) {
      skipAccumRef.current = 0;
      setSkipAmount(0);
      setSkipVisible(false);
      setSkipDirection(null);
    }
  }, [isReady]);

  useEffect(() => {
    if (isPlaying && isFullscreen) {
      showCursorTemporarily();
    }
  }, [isPlaying]);

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !isReady) {
      return;
    }

    player.seekTo(start, true);
    if (wasPlayingRef.current) {
      player.playVideo();
    }
    setCurrentSourceTime(start);
  }, [isReady, start]);

  if (!resolvedVideoId) {
    return null;
  }

  const currentClipTime = isSeeking ? seekValue : Math.max(currentSourceTime - start, 0);
  const sliderMax = Math.max(segmentDuration ?? 0, 0);
  const playedPercent = sliderMax > 0 ? clamp((currentClipTime / sliderMax) * 100, 0, 100) : 0;

  function togglePlayback() {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    markActive();

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
      containerRef.current?.focus({ preventScroll: true });
      return;
    }

    if (typeof effectiveEnd === "number" && currentSourceTime >= effectiveEnd) {
      player.seekTo(start, true);
      setCurrentSourceTime(start);
    }

    player.playVideo();
    setIsPlaying(true);
    containerRef.current?.focus({ preventScroll: true });
  }

  function recordSkip(deltaSeconds: number) {
    if (!Number.isFinite(deltaSeconds)) {
      return;
    }
    setSkipVisible(true);
    setSkipDirection(deltaSeconds > 0 ? "right" : "left");
    skipAccumRef.current += deltaSeconds;
    setSkipAmount(skipAccumRef.current);
    clearSkipResetTimeout();
    skipResetTimeoutRef.current = window.setTimeout(() => {
      skipAccumRef.current = 0;
      setSkipAmount(0);
      setSkipVisible(false);
      setSkipDirection(null);
      skipResetTimeoutRef.current = null;
    }, 1000);
  }

  function skipBy(deltaSeconds: number) {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    markActive();
    revealControls();

    const maxTime =
      typeof effectiveEnd === "number"
        ? effectiveEnd
        : typeof fullDuration === "number"
          ? fullDuration
          : start;
    if (typeof player.getCurrentTime !== "function") {
      return;
    }

    const currentTime = player.getCurrentTime() || currentSourceTime;
    const nextTime = clamp(currentTime + deltaSeconds, start, Math.max(maxTime, start));
    player.seekTo(nextTime, true);
    setCurrentSourceTime(nextTime);
    setSeekValue(Math.max(nextTime - start, 0));
    recordSkip(deltaSeconds);
    containerRef.current?.focus({ preventScroll: true });
  }

  function handleSeek(nextClipSeconds: number) {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const safeClipTime = clamp(nextClipSeconds, 0, sliderMax);
    const nextSourceTime = start + safeClipTime;
    setSeekValue(safeClipTime);
    player.seekTo(nextSourceTime, true);
    setCurrentSourceTime(nextSourceTime);
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    markActive();

    // no fullscreen for page elements here (iPhone): the player covers the screen instead, and the page behind stays still
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      setIsFullscreen(false);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      window.setTimeout(() => containerRef.current?.focus({ preventScroll: true }), 0);

      return;
    }

    if (typeof container.requestFullscreen !== "function") {
      captureScroll();
      setPseudoFullscreen(true);
      setIsFullscreen(true);
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      showCursorTemporarily();

      return;
    }

    if (document.fullscreenElement === container) {
      await document.exitFullscreen().catch(() => undefined);
      window.setTimeout(() => {
        containerRef.current?.focus({ preventScroll: true });
      }, 0);
      return;
    }

    captureScroll();
    await container.requestFullscreen?.().catch(() => undefined);
    window.setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    markActive();

    const currentVolume = (player.getVolume?.() ?? Math.round(volume * 100)) / 100;
    const nextMuted = !player.isMuted();

    if (nextMuted) {
      if (currentVolume > 0) {
        lastVolumeBeforeMuteRef.current = currentVolume;
      }
      player.mute();
      setIsMuted(true);
      setVolume(currentVolume);
      revealControls();
      containerRef.current?.focus({ preventScroll: true });
      return;
    }

    const restoredVolume =
      currentVolume > 0
        ? currentVolume
        : lastVolumeBeforeMuteRef.current > 0
          ? lastVolumeBeforeMuteRef.current
          : 0.6;
    player.setVolume(Math.round(restoredVolume * 100));
    player.unMute();
    setIsMuted(false);
    setVolume(restoredVolume);
    revealControls();
    containerRef.current?.focus({ preventScroll: true });
  }

  function handleVolumeChange(nextVolume: number) {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    markActive();

    const clampedVolume = clamp(nextVolume, 0, 1);
    if (clampedVolume > 0) {
      lastVolumeBeforeMuteRef.current = clampedVolume;
    }

    if (clampedVolume === 0) {
      player.mute();
      setIsMuted(true);
      setVolume(0);
      revealControls();
      return;
    } else {
      player.unMute();
      player.setVolume(Math.round(clampedVolume * 100));
    }
    setIsMuted(false);
    setVolume(clampedVolume);
    revealControls();
  }

  function toggleCaptions() {
    if (captionTracks.length === 0) {
      return;
    }

    if (captionLang) {
      selectCaption(null);
    } else {
      let preferred: string | null = null;

      try {
        preferred = window.localStorage.getItem(CAPTION_PREFERENCE_KEY);
      } catch {
        preferred = null;
      }

      const track =
        captionTracks.find((item) => item.code === preferred) ??
        captionTracks.find((item) => item.code.startsWith("en")) ??
        captionTracks[0];

      selectCaption(track.code);
    }

    revealControls();
    containerRef.current?.focus({ preventScroll: true });
  }

  // The keyboard listener lives across renders, so it calls the latest versions of these.
  actionsRef.current = { skipBy, togglePlayback, toggleCaptions, toggleMute, toggleFullscreen, revealControls };

  useEffect(() => {
    if (!isReady) {
      return;
    }

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
        actionsRef.current?.togglePlayback();
        actionsRef.current?.revealControls();
        return;
      }

      if (code === "KeyF") {
        event.preventDefault();
        markActive();
        containerRef.current?.focus({ preventScroll: true });
        void actionsRef.current?.toggleFullscreen();
        actionsRef.current?.revealControls();
        return;
      }

      if (code === "KeyC") {
        event.preventDefault();
        actionsRef.current?.toggleCaptions();
        actionsRef.current?.revealControls();
        return;
      }

      if (code === "KeyM") {
        event.preventDefault();
        actionsRef.current?.toggleMute();
        actionsRef.current?.revealControls();
        return;
      }

      if (code === "ArrowRight") {
        event.preventDefault();
        actionsRef.current?.skipBy(5);
        return;
      }

      if (code === "ArrowLeft") {
        event.preventDefault();
        actionsRef.current?.skipBy(-5);
        return;
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isFullscreen, isPlaying, isReady]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      markActive();
      togglePlayback();
      revealControls();
      return;
    }

    if (event.code === "KeyF") {
      event.preventDefault();
      markActive();
      containerRef.current?.focus({ preventScroll: true });
      void toggleFullscreen();
      revealControls();
      return;
    }

    if (event.code === "KeyC") {
      event.preventDefault();
      markActive();
      toggleCaptions();
      return;
    }

    if (event.code === "KeyM") {
      event.preventDefault();
      markActive();
      toggleMute();
      revealControls();
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
  }

  // Phone: a tap plays or pauses, a double tap on the sides jumps 5 seconds
  // back or forward, and a double tap in the middle goes fullscreen.
  function handleTouchTap(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && now - last.time < 320 && Math.abs(x - last.x) < 60) {
      lastTapRef.current = null;
      clearClickTimeout();

      if (x < box.width / 3) skipBy(-5);
      else if (x > (box.width * 2) / 3) skipBy(5);
      else void toggleFullscreen();

      revealControls();

      return;
    }

    lastTapRef.current = { time: now, x };
    // the controls stay under the picture on a phone, so a single tap simply plays or pauses
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      togglePlayback();
    }, 260);
  }

  function handleSurfaceClick(event: React.MouseEvent<HTMLDivElement>) {
    markActive();
    containerRef.current?.focus({ preventScroll: true });
    clearClickTimeout();
    if (isTouchMode) {
      handleTouchTap(event);

      return;
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      togglePlayback();
      clickTimeoutRef.current = null;
    }, 220);
  }

  function handleSurfaceDoubleClick() {
    markActive();
    containerRef.current?.focus({ preventScroll: true });
    clearClickTimeout();
    void toggleFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="clip-segment-player"
      data-source-type="youtube"
      data-playing={isPlaying ? "true" : "false"}
      data-controls-visible={controlsVisible ? "true" : "false"}
      data-pseudo-fullscreen={pseudoFullscreen ? "true" : "false"}
      data-cursor-hidden={
        !isTouchMode && isFullscreen && !controlsVisible && !isCursorVisible ? "true" : "false"
      }
      style={{
        transition: "opacity 0.2s ease",
      }}
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
      <div className="video-frame clip-segment-frame">
        <div className="clip-segment-picture">
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
        <div
          className="clip-skip-side-indicator"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: skipDirection === "left" ? 0 : "auto",
              right: skipDirection === "right" ? 0 : "auto",
              width: "50%",
              background: "transparent",
              opacity: skipDirection ? 1 : 0,
              transition: "opacity 0.2s ease, transform 0.2s ease",
              transform:
                skipDirection === "left"
                ? "translateX(-20px) scale(1)"
                : skipDirection === "right"
                  ? "translateX(20px) scale(1)"
                  : "scale(1)",
            pointerEvents: "none",
          }}
        />
        {skipVisible && safeSkipAmount !== 0 && skipDirection ? (
          <div
            className={`clip-skip-overlay clip-skip-overlay-${skipDirection}`}
            aria-hidden="true"
          >
            <span className="clip-skip-badge" dir="ltr">
              {skipDirection === "left" ? `< ${skipText}` : `${skipText} >`}
            </span>
          </div>
        ) : null}
        {!isTouchMode || hasPlayed ? (
          <div
            className="clip-segment-hit-target"
            onClick={handleSurfaceClick}
            onDoubleClick={handleSurfaceDoubleClick}
          />
        ) : null}
        </div>
        <div className="clip-segment-controls-overlay" dir="ltr">
          <div className="clip-segment-controls" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="button-secondary button-small clip-segment-play-button"
              onClick={togglePlayback}
              disabled={!isReady}
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
                onPointerUp={() => setIsSeeking(false)}
                onPointerCancel={() => setIsSeeking(false)}
                onBlur={() => setIsSeeking(false)}
                disabled={!isReady || sliderMax <= 0}
                onClick={(event) => event.stopPropagation()}
              />
              <div className="clip-segment-time">
                <span>{formatSecondsAsDuration(currentClipTime)}</span>
                <span>{segmentDuration === null ? "—" : formatSecondsAsDuration(segmentDuration)}</span>
              </div>
            </div>

            {captionTracks.length > 0 ? (
              <div className="clip-caption-wrap">
                <button
                  type="button"
                  className={`button-secondary button-small clip-segment-caption-button ${captionLang ? "is-active" : ""}`}
                  onClick={() => setCaptionMenuOpen((open) => !open)}
                  aria-haspopup="true"
                  aria-expanded={captionMenuOpen}
                  aria-label="Subtitles"
                  title="Subtitles"
                >
                  <CaptionsIcon />
                </button>
                {captionMenuOpen ? (
                  <ul className="clip-caption-menu" role="menu">
                    <li>
                      <button type="button" role="menuitemradio" aria-checked={!captionLang} onClick={() => selectCaption(null)}>
                        Off
                      </button>
                    </li>
                    {captionTracks.map((track) => (
                      <li key={track.code}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={captionLang === track.code}
                          onClick={() => selectCaption(track.code)}
                        >
                          {track.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

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
              disabled={!isReady}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(VideoPlayer);
