import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_OAUTH_STATE_COOKIE = "my_musicals_google_oauth_state";

type GoogleAuthMode = "login" | "signup";

type GoogleTokensResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  locale?: string;
};

type GoogleOAuthState = {
  state: string;
  mode: GoogleAuthMode;
};

export class GoogleAuthError extends Error {
  code:
    | "google-unavailable"
    | "google-cancelled"
    | "google-state-invalid"
    | "google-code-missing"
    | "google-token-failed"
    | "google-profile-failed"
    | "google-email-missing"
    | "google-email-unverified"
    | "google-email-conflict";

  constructor(code: GoogleAuthError["code"], message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

function normalizeMode(value: string | null | undefined): GoogleAuthMode {
  return value === "signup" ? "signup" : "login";
}

function normalizeNamePart(value?: string | null, fallback = "") {
  return value?.trim() || fallback;
}

function getGoogleAppUrl() {
  try {
    return getAppUrl();
  } catch (error) {
    throw new GoogleAuthError(
      "google-unavailable",
      error instanceof Error ? error.message : "Missing APP_URL for Google authentication",
    );
  }
}

export function isGoogleAuthEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()),
  );
}

export function getGoogleAuthMode(value: string | null | undefined) {
  return normalizeMode(value);
}

export function getGoogleCallbackUrl() {
  return `${getGoogleAppUrl()}/auth/google/callback`;
}

export function toGoogleAppUrl(pathname: string) {
  return new URL(pathname, getGoogleAppUrl()).toString();
}

export function createGoogleOAuthState(modeInput: string | null | undefined): GoogleOAuthState {
  if (!isGoogleAuthEnabled()) {
    throw new GoogleAuthError(
      "google-unavailable",
      "Google OAuth is not fully configured",
    );
  }

  return {
    state: randomBytes(24).toString("hex"),
    mode: normalizeMode(modeInput),
  };
}

export function serializeGoogleOAuthState(payload: GoogleOAuthState) {
  return JSON.stringify(payload);
}

export function parseGoogleOAuthState(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GoogleOAuthState>;

    if (!parsed.state || (parsed.mode !== "login" && parsed.mode !== "signup")) {
      return null;
    }

    return {
      state: parsed.state,
      mode: parsed.mode,
    } satisfies GoogleOAuthState;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(payload: GoogleOAuthState) {
  if (!isGoogleAuthEnabled()) {
    throw new GoogleAuthError(
      "google-unavailable",
      "Google OAuth is not fully configured",
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: getGoogleCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state: payload.state,
  });

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

async function exchangeGoogleCode(code: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: getGoogleCallbackUrl(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleTokensResponse;

  if (!response.ok || !payload.access_token) {
    throw new GoogleAuthError(
      "google-token-failed",
      payload.error_description || payload.error || "Google token exchange failed",
    );
  }

  return payload.access_token;
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleUserInfo & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.sub) {
    throw new GoogleAuthError(
      "google-profile-failed",
      payload.error_description || payload.error || "Google userinfo lookup failed",
    );
  }

  return payload;
}

async function generateUniqueUsername(profile: GoogleUserInfo) {
  const emailLocalPart = profile.email?.split("@")[0] ?? "";
  const baseCandidate = (profile.given_name || profile.name || emailLocalPart || "user")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_")
    .slice(0, 24);

  const normalizedBase = baseCandidate.length >= 3 ? baseCandidate : "user";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
    const nextUsername = `${normalizedBase}${suffix}`.slice(0, 30);
    const existing = await db.user.findFirst({
      where: {
        username: {
          equals: nextUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return nextUsername;
    }
  }

  return `user_${randomBytes(4).toString("hex")}`;
}

function getGoogleNameParts(profile: GoogleUserInfo) {
  const givenName = normalizeNamePart(profile.given_name);
  const familyName = normalizeNamePart(profile.family_name);

  if (givenName || familyName) {
    return {
      firstName: givenName || "Google",
      lastName: familyName || "User",
    };
  }

  const [firstName = "Google", ...rest] = normalizeNamePart(profile.name, "Google User").split(" ");

  return {
    firstName,
    lastName: rest.join(" ") || "User",
  };
}

function getGoogleErrorRedirect(mode: GoogleAuthMode, error: GoogleAuthError["code"]) {
  const basePath = mode === "signup" ? "/auth/request-account" : "/auth/login";
  return `${basePath}?error=${error}`;
}

export async function completeGoogleSignIn({
  code,
  expectedState,
  receivedState,
}: {
  code: string | null;
  expectedState: GoogleOAuthState | null;
  receivedState: string | null;
}) {
  const mode = expectedState?.mode ?? "login";

  if (!isGoogleAuthEnabled()) {
    throw new GoogleAuthError(
      "google-unavailable",
      "Google OAuth is not fully configured",
    );
  }

  if (!expectedState || !receivedState || expectedState.state !== receivedState) {
    throw new GoogleAuthError("google-state-invalid", "Google OAuth state validation failed");
  }

  if (!code) {
    throw new GoogleAuthError("google-code-missing", "Missing Google authorization code");
  }

  const accessToken = await exchangeGoogleCode(code);
  const profile = await fetchGoogleUserInfo(accessToken);

  const email = profile.email?.trim().toLowerCase();

  if (!email) {
    throw new GoogleAuthError("google-email-missing", "Google account did not provide an email");
  }

  if (!profile.email_verified) {
    throw new GoogleAuthError(
      "google-email-unverified",
      "Google account email is not verified",
    );
  }

  const userByGoogleSubject = await db.user.findUnique({
    where: { googleSubject: profile.sub },
  });
  const userByEmail = await db.user.findUnique({
    where: { email },
  });

  if (userByGoogleSubject && userByEmail && userByGoogleSubject.id !== userByEmail.id) {
    throw new GoogleAuthError(
      "google-email-conflict",
      "Google account is linked to a different existing user",
    );
  }

  const targetUser = userByGoogleSubject ?? userByEmail;

  if (targetUser) {
    if (targetUser.googleSubject && targetUser.googleSubject !== profile.sub) {
      throw new GoogleAuthError(
        "google-email-conflict",
        "Existing account is linked to another Google identity",
      );
    }

    if (targetUser.status === "blocked") {
      return {
        redirectTo: "/auth/blocked",
      };
    }

    const shouldImportAvatar = !targetUser.avatarUrl && Boolean(profile.picture);

    const updatedUser = await db.user.update({
      where: { id: targetUser.id },
      data: {
        googleSubject: profile.sub,
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
        emailVerificationSentAt: null,
        avatarUrl: shouldImportAvatar ? profile.picture ?? null : targetUser.avatarUrl,
      },
      select: {
        id: true,
        language: true,
      },
    });

    await createSession(updatedUser.id, updatedUser.language);

    return {
      redirectTo: "/",
    };
  }

  const { firstName, lastName } = getGoogleNameParts(profile);
  const username = await generateUniqueUsername(profile);
  const passwordHash = hashPassword(randomBytes(32).toString("hex"));

  const createdUser = await db.user.create({
    data: {
      firstName,
      lastName,
      username,
      email,
      googleSubject: profile.sub,
      phone: null,
      phoneVerified: false,
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
      emailVerificationSentAt: null,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      passwordResetSentAt: null,
      passwordHash,
      avatarUrl: profile.picture ?? null,
      requestMessage: null,
      language: "he",
      status: "active",
      role: "user",
    },
    select: {
      id: true,
      language: true,
    },
  });

  await createSession(createdUser.id, createdUser.language);

  return {
    redirectTo: "/",
  };
}

export function getGoogleErrorRedirectUrl(
  modeInput: string | null | undefined,
  errorCode: GoogleAuthError["code"],
) {
  return getGoogleErrorRedirect(normalizeMode(modeInput), errorCode);
}
