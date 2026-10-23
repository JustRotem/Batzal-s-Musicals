"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "bz-return-site";

function isBatzalSite(url: URL) {
  return url.hostname === "localhost" || url.hostname.endsWith(".batzal.net");
}

// The account site floats over all the others: its logo leads back to the site the person came from.
export default function AccountBrandLink({
  children,
  ariaLabel,
  fallbackHref,
}: {
  children: ReactNode;
  ariaLabel: string;
  // Where to go when the previous site is not known (the library)
  fallbackHref: string;
}) {
  const [href, setHref] = useState(fallbackHref);

  useEffect(() => {
    try {
      let target = window.sessionStorage.getItem(STORAGE_KEY);

      if (document.referrer) {
        const from = new URL(document.referrer);

        if (from.origin !== window.location.origin && isBatzalSite(from)) {
          target = from.origin;
          window.sessionStorage.setItem(STORAGE_KEY, target);
        }
      }

      if (target) setHref(target);
    } catch {
      // keep the fallback
    }
  }, []);

  return (
    <a className="bz-brand" href={href} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
