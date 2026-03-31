import { headers } from "next/headers";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export class TurnstileVerificationError extends Error {
  code:
    | "turnstile-required"
    | "turnstile-expired"
    | "turnstile-invalid"
    | "turnstile-unavailable";

  constructor(code: TurnstileVerificationError["code"], message: string) {
    super(message);
    this.name = "TurnstileVerificationError";
    this.code = code;
  }
}

function getTurnstileSiteKeyValue() {
  return process.env.TURNSTILE_SITE_KEY?.trim() || "";
}

function getTurnstileSecretKeyValue() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

export function getTurnstileSiteKey() {
  return getTurnstileSiteKeyValue() || null;
}

export function isTurnstileConfigured() {
  return Boolean(getTurnstileSiteKeyValue() && getTurnstileSecretKeyValue());
}

export function isTurnstileEnabled() {
  return isTurnstileConfigured();
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getClientIp(headerValue: string | null) {
  return headerValue?.split(",")[0]?.trim() || "";
}

function normalizeTurnstileToken(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function verifyTurnstileToken({
  formData,
  expectedAction,
  logContext,
}: {
  formData: FormData;
  expectedAction: string;
  logContext: string;
}) {
  if (!isTurnstileConfigured()) {
    if (!isProduction()) {
      console.info("[turnstile] verification skipped in non-production", {
        action: expectedAction,
        context: logContext,
      });
      return;
    }

    console.error("[turnstile] configuration missing in production", {
      action: expectedAction,
      context: logContext,
      hasSiteKey: Boolean(getTurnstileSiteKeyValue()),
      hasSecretKey: Boolean(getTurnstileSecretKeyValue()),
    });
    throw new TurnstileVerificationError(
      "turnstile-unavailable",
      "Turnstile is not configured in production",
    );
  }

  const token = normalizeTurnstileToken(formData.get("cf-turnstile-response"));

  if (!token) {
    throw new TurnstileVerificationError(
      "turnstile-required",
      "Turnstile token is missing",
    );
  }

  const headerStore = await headers();
  const remoteIp = getClientIp(headerStore.get("x-forwarded-for"));
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: getTurnstileSecretKeyValue(),
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
    cache: "no-store",
  }).catch((error) => {
    console.error("[turnstile] verification network failure", {
      action: expectedAction,
      context: logContext,
      reason: error instanceof Error ? error.message : "unknown-error",
    });
    throw new TurnstileVerificationError(
      "turnstile-unavailable",
      "Turnstile verification request failed",
    );
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        action?: string;
        hostname?: string;
        "error-codes"?: string[];
      }
    | null;

  if (!response.ok || !payload?.success) {
    const errorCodes = payload?.["error-codes"] ?? [];
    const code = errorCodes.includes("timeout-or-duplicate")
      ? "turnstile-expired"
      : errorCodes.includes("missing-input-response")
        ? "turnstile-required"
        : errorCodes.some((item) => item.startsWith("internal-error") || item === "bad-request")
          ? "turnstile-unavailable"
          : "turnstile-invalid";

    console.warn("[turnstile] verification rejected", {
      action: expectedAction,
      context: logContext,
      errorCodes,
      status: response.status,
    });

    throw new TurnstileVerificationError(code, "Turnstile verification failed");
  }

  if (payload.action && payload.action !== expectedAction) {
    console.warn("[turnstile] action mismatch", {
      action: expectedAction,
      context: logContext,
      receivedAction: payload.action,
    });
    throw new TurnstileVerificationError(
      "turnstile-invalid",
      "Turnstile action mismatch",
    );
  }
}
