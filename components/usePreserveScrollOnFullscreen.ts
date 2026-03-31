"use client";

import { RefObject, useEffect, useRef } from "react";

function getFullscreenElement() {
  return document.fullscreenElement;
}

export function usePreserveScrollOnFullscreen(
  containerRef: RefObject<HTMLElement | null>,
) {
  const latestScrollYRef = useRef(0);
  const interactionScrollYRef = useRef(0);
  const interactionAtRef = useRef(0);
  const fullscreenScrollYRef = useRef(0);
  const fullscreenOwnerRef = useRef(false);
  const restoreTimeoutsRef = useRef<number[]>([]);
  const restoreUntilRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;

    function clearRestoreTimers() {
      for (const timeoutId of restoreTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }

      restoreTimeoutsRef.current = [];
    }

    function rememberScrollPosition() {
      latestScrollYRef.current = window.scrollY;
    }

    function rememberInteractionScrollPosition() {
      interactionScrollYRef.current = window.scrollY;
      interactionAtRef.current = Date.now();
      latestScrollYRef.current = window.scrollY;
    }

    function restoreScrollPosition() {
      const targetScrollY = fullscreenScrollYRef.current;

      if (Math.abs(window.scrollY - targetScrollY) <= 1) {
        return;
      }

      window.scrollTo({
        top: targetScrollY,
        behavior: "auto",
      });
    }

    function scheduleRestoreSequence() {
      clearRestoreTimers();
      restoreUntilRef.current = Date.now() + 700;

      restoreScrollPosition();

      requestAnimationFrame(() => {
        restoreScrollPosition();

        requestAnimationFrame(() => {
          restoreScrollPosition();
        });
      });

      for (const delay of [0, 40, 120, 240, 420, 650]) {
        const timeoutId = window.setTimeout(() => {
          restoreScrollPosition();
        }, delay);

        restoreTimeoutsRef.current.push(timeoutId);
      }
    }

    function handlePostExitEvent() {
      if (Date.now() > restoreUntilRef.current) {
        return;
      }

      restoreScrollPosition();
    }

    function handleFullscreenChange() {
      const fullscreenElement = getFullscreenElement();

      if (fullscreenElement && container?.contains(fullscreenElement)) {
        const interactionWasRecent = Date.now() - interactionAtRef.current < 1500;

        fullscreenScrollYRef.current = interactionWasRecent
          ? interactionScrollYRef.current
          : latestScrollYRef.current;

        fullscreenOwnerRef.current = true;
        clearRestoreTimers();
        return;
      }

      if (!fullscreenElement && fullscreenOwnerRef.current) {
        fullscreenOwnerRef.current = false;
        scheduleRestoreSequence();
      }
    }

    latestScrollYRef.current = window.scrollY;

    window.addEventListener("scroll", rememberScrollPosition, { passive: true });
    window.addEventListener("resize", handlePostExitEvent);
    window.addEventListener("focus", handlePostExitEvent);
    document.addEventListener("visibilitychange", handlePostExitEvent);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    if (container) {
      container.addEventListener("pointerdown", rememberInteractionScrollPosition, true);
      container.addEventListener("focusin", rememberInteractionScrollPosition, true);
      container.addEventListener("keydown", rememberInteractionScrollPosition, true);
      container.addEventListener("touchstart", rememberInteractionScrollPosition, true);
    }

    return () => {
      clearRestoreTimers();
      window.removeEventListener("scroll", rememberScrollPosition);
      window.removeEventListener("resize", handlePostExitEvent);
      window.removeEventListener("focus", handlePostExitEvent);
      document.removeEventListener("visibilitychange", handlePostExitEvent);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);

      if (container) {
        container.removeEventListener("pointerdown", rememberInteractionScrollPosition, true);
        container.removeEventListener("focusin", rememberInteractionScrollPosition, true);
        container.removeEventListener("keydown", rememberInteractionScrollPosition, true);
        container.removeEventListener("touchstart", rememberInteractionScrollPosition, true);
      }
    };
  }, [containerRef]);
}
