import { DEFAULT_APP_TITLE } from "@/lib/app-config";
import { assertProductionReadyEnv, getAppUrl } from "@/lib/env";

type AccountEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category: "verification" | "password-reset" | "account" | "moderation";
};

type AccountEmailResult = {
  mode: "mock" | "resend";
  from: string;
  providerMessageId?: string;
};

export class AccountEmailDeliveryError extends Error {
  code:
    | "EMAIL_PROVIDER_NOT_CONFIGURED"
    | "EMAIL_PROVIDER_INCOMPLETE"
    | "EMAIL_PROVIDER_REQUEST_FAILED";
  causeSummary?: string;

  constructor(
    code: AccountEmailDeliveryError["code"],
    message: string,
    causeSummary?: string,
  ) {
    super(message);
    this.name = "AccountEmailDeliveryError";
    this.code = code;
    this.causeSummary = causeSummary;
  }
}

let hasWarnedAboutMissingEmailProvider = false;
let hasLoggedEmailProviderStatus = false;

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getEmailRuntimeStatus() {
  const appUrlRaw = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  const fromName = process.env.FROM_EMAIL_NAME?.trim() || "";
  const fromEmail = process.env.FROM_EMAIL?.trim() || "";
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";

  let appUrlStatus: "missing" | "invalid" | "localhost" | "configured" = "missing";

  if (appUrlRaw) {
    try {
      new URL(appUrlRaw);
      appUrlStatus = isLocalhostUrl(appUrlRaw) ? "localhost" : "configured";
    } catch {
      appUrlStatus = "invalid";
    }
  }

  return {
    mode: resendApiKey ? "resend" : "missing",
    appUrlStatus,
    appUrl: appUrlRaw || null,
    fromEmailConfigured: Boolean(fromEmail),
    fromNameConfigured: Boolean(fromName),
  };
}

function resolveAppUrl() {
  return getAppUrl();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(value: string) {
  const [localPart = "", domain = ""] = value.split("@");
  if (!localPart || !domain) {
    return "invalid-email";
  }

  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${"*".repeat(Math.max(1, localPart.length - visiblePrefix.length))}@${domain}`;
}

function summarizeUrlHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

export function getAccountEmailConfig() {
  const fromName =
    process.env.FROM_EMAIL_NAME?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : DEFAULT_APP_TITLE);
  const fromEmail =
    process.env.FROM_EMAIL?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "no-reply@batzal.net");
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";

  if (process.env.NODE_ENV === "production") {
    assertProductionReadyEnv();
  }

  return {
    appUrl: resolveAppUrl(),
    fromName,
    fromEmail,
    resendApiKey,
    from: `${fromName} <${fromEmail}>`,
  };
}

export function logAccountEmailProviderStatus(source: "startup" | "send" = "send") {
  if (hasLoggedEmailProviderStatus) {
    return;
  }

  hasLoggedEmailProviderStatus = true;

  const status = getEmailRuntimeStatus();
  const logPayload = {
    source,
    provider: status.mode,
    appUrlStatus: status.appUrlStatus,
    appUrl: status.appUrl,
    fromEmailConfigured: status.fromEmailConfigured,
    fromNameConfigured: status.fromNameConfigured,
  };

  if (status.mode === "resend" && status.appUrlStatus === "configured") {
    console.info("[account-email] provider active", logPayload);
    return;
  }

  console.warn("[account-email] provider incomplete", logPayload);
}

export async function sendAccountEmail(input: AccountEmailInput): Promise<AccountEmailResult> {
  logAccountEmailProviderStatus("send");

  const config = getAccountEmailConfig();
  const sendLogPayload = {
    category: input.category,
    provider: config.resendApiKey ? "resend" : "mock",
    to: maskEmail(input.to),
    fromConfigured: isValidEmail(config.fromEmail),
    fromDomain: config.fromEmail.includes("@") ? config.fromEmail.split("@")[1] : "invalid-email",
    appUrlHost: summarizeUrlHost(config.appUrl),
  };

  console.info("[account-email] send attempt started", sendLogPayload);

  if (!config.fromName || !isValidEmail(config.fromEmail)) {
    throw new AccountEmailDeliveryError(
      "EMAIL_PROVIDER_INCOMPLETE",
      "Account email sender is not configured correctly.",
      "FROM_EMAIL or FROM_EMAIL_NAME is invalid",
    );
  }

  if (!config.resendApiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new AccountEmailDeliveryError(
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email sending is not configured in production.",
        "RESEND_API_KEY is missing",
      );
    }

    if (!hasWarnedAboutMissingEmailProvider) {
      hasWarnedAboutMissingEmailProvider = true;
      console.warn(
        "[account-email] RESEND_API_KEY is missing. Falling back to dev email logging.",
      );
    }
  }

  if (config.resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
        cache: "no-store",
      });

      const responseText = await response.text();
      let responseJson: { id?: string; message?: string; error?: unknown } | null = null;

      try {
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        const errorSummary = responseJson?.message || responseText || "Unknown provider error";

        console.error("[account-email] send failed", {
          ...sendLogPayload,
          status: response.status,
          errorSummary,
        });

        throw new AccountEmailDeliveryError(
          "EMAIL_PROVIDER_REQUEST_FAILED",
          `Resend request failed with status ${response.status}.`,
          errorSummary,
        );
      }

      console.info("[account-email] send succeeded", {
        ...sendLogPayload,
        providerMessageId: responseJson?.id ?? null,
      });

      return {
        mode: "resend",
        from: config.from,
        providerMessageId: responseJson?.id,
      };
    } catch (error) {
      if (error instanceof AccountEmailDeliveryError) {
        throw error;
      }

      const causeSummary = error instanceof Error ? error.message : "Unknown fetch failure";

      console.error("[account-email] send failed", {
        ...sendLogPayload,
        errorSummary: causeSummary,
      });

      throw new AccountEmailDeliveryError(
        "EMAIL_PROVIDER_REQUEST_FAILED",
        "Resend request failed before a valid response was received.",
        causeSummary,
      );
    }
  }

  console.info("[account-email] mock send", {
    category: input.category,
    to: input.to,
    from: config.from,
    subject: input.subject,
    text: input.text,
  });

  return {
    mode: "mock",
    from: config.from,
  };
}
