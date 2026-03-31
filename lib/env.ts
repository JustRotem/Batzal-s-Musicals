function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function deriveUploadOriginFromAppUrl(appUrl: string) {
  try {
    const url = new URL(appUrl);

    if (isLocalhostUrl(url.toString())) {
      return url.toString().replace(/\/$/, "");
    }

    const segments = url.hostname.split(".");

    if (segments.length >= 3) {
      segments[0] = "upload";
      url.hostname = segments.join(".");
      return url.toString().replace(/\/$/, "");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return appUrl;
  }
}

export function getAppUrl() {
  const rawValue = readEnv("APP_URL") || readEnv("NEXT_PUBLIC_APP_URL");

  if (!rawValue) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required production env: APP_URL");
    }

    return "http://localhost:3000";
  }

  try {
    const url = new URL(rawValue);

    if (process.env.NODE_ENV === "production" && isLocalhostUrl(url.toString())) {
      throw new Error("APP_URL must not point to localhost in production");
    }

    return url.toString().replace(/\/$/, "");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        error instanceof Error
          ? error.message
          : "APP_URL must be a valid absolute URL in production",
      );
    }

    return "http://localhost:3000";
  }
}

export function getClipUploadBaseUrl() {
  const rawValue =
    readEnv("CLIP_UPLOAD_BASE_URL") ||
    readEnv("NEXT_PUBLIC_CLIP_UPLOAD_BASE_URL");
  const fallbackAppUrl = getAppUrl();
  const resolvedValue = rawValue || deriveUploadOriginFromAppUrl(fallbackAppUrl);

  try {
    const url = new URL(resolvedValue);

    if (process.env.NODE_ENV === "production" && isLocalhostUrl(url.toString())) {
      throw new Error("CLIP_UPLOAD_BASE_URL must not point to localhost in production");
    }

    return url.toString().replace(/\/$/, "");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        error instanceof Error
          ? error.message
          : "CLIP_UPLOAD_BASE_URL must be a valid absolute URL in production",
      );
    }

    return fallbackAppUrl;
  }
}

export function getClipUploadApiUrl() {
  return new URL("/api/admin/clip-video", getClipUploadBaseUrl()).toString();
}

export function getClipUploadAllowedOrigin() {
  return new URL(getAppUrl()).origin;
}

export function getClipUploadAuthSecret() {
  const explicitSecret = readEnv("CLIP_UPLOAD_AUTH_SECRET");

  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret = readEnv("TURNSTILE_SECRET_KEY") || readEnv("GOOGLE_CLIENT_SECRET");

  if (fallbackSecret) {
    return fallbackSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-clip-upload-secret";
  }

  throw new Error("Missing required production env: CLIP_UPLOAD_AUTH_SECRET");
}

export function assertProductionReadyEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const issues: string[] = [];
  const databaseUrl = readEnv("DATABASE_URL");
  const fromEmail = readEnv("FROM_EMAIL");
  const fromEmailName = readEnv("FROM_EMAIL_NAME");
  const resendApiKey = readEnv("RESEND_API_KEY");

  if (!databaseUrl) {
    issues.push("DATABASE_URL is required.");
  }

  try {
    getAppUrl();
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "APP_URL is invalid.");
  }

  if (!fromEmailName) {
    issues.push("FROM_EMAIL_NAME is required.");
  }

  if (!fromEmail || !isValidEmail(fromEmail)) {
    issues.push("FROM_EMAIL must be a valid email address.");
  }

  if (!resendApiKey) {
    issues.push("RESEND_API_KEY is required for production account emails.");
  }

  if (issues.length > 0) {
    throw new Error(`Production configuration is incomplete:\n- ${issues.join("\n- ")}`);
  }
}
