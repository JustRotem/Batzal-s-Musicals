import { getMusicalsUrl } from "@/lib/app-mode";
import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from "crypto";

// Single sign-on: the account site is the identity provider for every Batzal site (the musicals site included).
// A site sends the visitor here; we answer with a short-lived, signed token that the site verifies
// with our public key. See docs/SSO.md for the full protocol.

export const SSO_ISSUER = "account.batzal.net";
export const SSO_TOKEN_TTL_SECONDS = 60;
export const SSO_CALLBACK_PATH = "/api/sso/callback";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://library.batzal.net",
  // the previous address stays approved while it redirects to the library
  "https://musicals.batzal.net",
  "https://qr.batzal.net",
  "https://admin.batzal.net",
];
const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const TOKEN_VERSION = "v1";

export type SsoClaims = {
  iss: string;
  aud: string;
  sub: string;
  gsub: string | null;
  email: string;
  name: string;
  username: string;
  picture: string | null;
  role: string;
  lang: string;
  theme: string | null;
  // Effective permissions, so sites without database access can decide what to show
  perms: string[];
  // The browser's sign-in group: sessions that share it end together
  sid: string;
  state: string;
  jti: string;
  iat: number;
  exp: number;
};

export type SsoUserInput = Omit<SsoClaims, "iss" | "aud" | "state" | "jti" | "iat" | "exp">;

export function getAllowedOrigins(): string[] {
  const configured = process.env.SSO_ALLOWED_ORIGINS?.trim();
  const list = configured ? configured.split(",") : DEFAULT_ALLOWED_ORIGINS;

  return list
    .map((value) => {
      try {
        return new URL(value.trim()).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));
}

// Only exact, pre-approved origins may receive a token; `state` binds the answer to the browser that asked.
export function parseSsoRequest(
  returnParam: string | null | undefined,
  stateParam: string | null | undefined,
): { origin: string; state: string } | null {
  if (!returnParam || !stateParam || !STATE_PATTERN.test(stateParam)) {
    return null;
  }

  let origin: string;

  try {
    origin = new URL(returnParam).origin;
  } catch {
    return null;
  }

  if (!getAllowedOrigins().includes(origin)) {
    return null;
  }

  return { origin, state: stateParam };
}

function loadPrivateKey() {
  const raw = process.env.SSO_PRIVATE_KEY?.trim();

  if (!raw) {
    return null;
  }

  try {
    const pem = raw.includes("BEGIN")
      ? raw.replace(/\\n/g, "\n")
      : Buffer.from(raw, "base64").toString("utf8");
    const key = createPrivateKey(pem);

    return key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

export function isSsoEnabled() {
  return loadPrivateKey() !== null;
}

// The public key a consuming site pins in SSO_PUBLIC_KEY (PEM, or base64 of the PEM).
export function readConfiguredPublicKeyPem(): string | null {
  const raw = process.env.SSO_PUBLIC_KEY?.trim();

  if (!raw) {
    return null;
  }

  try {
    const pem = raw.includes("BEGIN")
      ? raw.replace(/\\n/g, "\n")
      : Buffer.from(raw, "base64").toString("utf8");

    return createPublicKey(pem).asymmetricKeyType === "ed25519" ? pem : null;
  } catch {
    return null;
  }
}

export function getSsoPublicKeyPem(): string | null {
  const key = loadPrivateKey();

  return key ? createPublicKey(key).export({ type: "spki", format: "pem" }).toString() : null;
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function signSsoToken(
  user: SsoUserInput,
  audience: string,
  state: string,
  now: number = Date.now(),
): string {
  const key = loadPrivateKey();

  if (!key) {
    throw new Error("SSO is not configured");
  }

  const issuedAt = Math.floor(now / 1000);
  const claims: SsoClaims = {
    ...user,
    iss: SSO_ISSUER,
    aud: audience,
    state,
    jti: randomBytes(16).toString("hex"),
    iat: issuedAt,
    exp: issuedAt + SSO_TOKEN_TTL_SECONDS,
  };

  const payload = encode(JSON.stringify(claims));
  const signature = sign(null, Buffer.from(`${TOKEN_VERSION}.${payload}`), key);

  return `${TOKEN_VERSION}.${payload}.${encode(signature)}`;
}

// Reference verifier. The other sites implement the same checks (see docs/SSO.md).
export function verifySsoToken(
  token: string,
  publicKeyPem: string,
  expectedAudience: string,
  now: number = Date.now(),
): SsoClaims | null {
  const [version, payload, signature, ...rest] = token.split(".");

  if (version !== TOKEN_VERSION || !payload || !signature || rest.length > 0) {
    return null;
  }

  try {
    const valid = verify(
      null,
      Buffer.from(`${version}.${payload}`),
      createPublicKey(publicKeyPem),
      Buffer.from(signature, "base64url"),
    );

    if (!valid) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SsoClaims;
    const nowSeconds = Math.floor(now / 1000);

    if (
      claims.iss !== SSO_ISSUER ||
      claims.aud !== expectedAudience ||
      typeof claims.exp !== "number" ||
      claims.exp <= nowSeconds ||
      typeof claims.state !== "string" ||
      typeof claims.jti !== "string"
    ) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

// The musicals site is a full Next.js app with its own callback route; the small sites use /api/sso/callback.
const MUSICALS_CALLBACK_PATH = "/auth/account/callback";

export function getCallbackPath(origin: string) {
  return origin === new URL(getMusicalsUrl()).origin ? MUSICALS_CALLBACK_PATH : SSO_CALLBACK_PATH;
}

export function buildSsoCallbackUrl(origin: string, token: string) {
  const url = new URL(getCallbackPath(origin), origin);
  url.searchParams.set("token", token);

  return url.toString();
}
