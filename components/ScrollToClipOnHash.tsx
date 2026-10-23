"use client";

import { useEffect } from "react";

// A link such as /library/<item>#clip-<id> brings the person to that clip, highlights it and wakes its player.
export default function ScrollToClipOnHash() {
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    function focusClip() {
      const id = window.location.hash.slice(1);

      if (!id.startsWith("clip-")) {
        return;
      }

      let tries = 0;

      const attempt = () => {
        if (cancelled) return;

        const target = document.getElementById(id);

        if (!target) {
          tries += 1;
          if (tries < 20) timer = window.setTimeout(attempt, 150);
          return;
        }

        // the bar at the top is sticky (and taller on a phone): stop just below it so the title shows
        const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

        window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
        target.classList.add("is-targeted");
        window.setTimeout(() => target.classList.remove("is-targeted"), 2600);
      };

      attempt();
    }

    focusClip();
    window.addEventListener("hashchange", focusClip);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("hashchange", focusClip);
    };
  }, []);

  return null;
}
