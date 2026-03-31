"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "interaction-only" | "execute";
          action?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId?: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  action: string;
  resetKey?: number;
};

export default function TurnstileWidget({
  siteKey,
  action,
  resetKey = 0,
}: TurnstileWidgetProps) {
  const generatedId = useId();
  const containerId = `turnstile-${generatedId.replace(/[:]/g, "")}`;
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady || !window.turnstile) {
      return;
    }

    if (widgetIdRef.current && window.turnstile.remove) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    setToken("");
    setStatusMessage(null);

    widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
      sitekey: siteKey,
      theme: "dark",
      appearance: "always",
      action,
      callback: (nextToken) => {
        setToken(nextToken);
        setStatusMessage(null);
      },
      "expired-callback": () => {
        setToken("");
        setStatusMessage("האימות פג. אפשר לאשר שוב ולהמשיך.");
      },
      "error-callback": () => {
        setToken("");
        setStatusMessage("האימות לא הושלם. אפשר לנסות שוב.");
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, containerId, resetKey, scriptReady, siteKey]);

  return (
    <div className="turnstile-shell">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <div className="turnstile-widget-slot" id={containerId} />
      {statusMessage ? <p className="turnstile-message">{statusMessage}</p> : null}
    </div>
  );
}
