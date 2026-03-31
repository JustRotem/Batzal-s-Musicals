"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ScrollToTopOnLoad({
  param = "updated",
}: {
  param?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldScrollToTop = searchParams.get(param) === "1";

  useLayoutEffect(() => {
    if (!shouldScrollToTop) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete(param);
    const nextUrl = nextSearchParams.toString()
      ? `${pathname}?${nextSearchParams.toString()}`
      : pathname;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.history.replaceState(window.history.state, "", nextUrl);
      window.history.scrollRestoration = previousScrollRestoration;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [param, pathname, searchParams, shouldScrollToTop]);

  return null;
}
