import { randomBytes } from "crypto";
import { getAppUrl } from "@/lib/env";
import { getAccountUrl } from "@/lib/app-mode";
import { readConfiguredPublicKeyPem, verifySsoToken, type SsoClaims } from "@/lib/sso";

// The musicals site signs people in through the account site (single sign-on). This is the consuming side.
export const ACCOUNT_SSO_STATE_COOKIE = "my_musicals_sso_state";

// This site's own origin: the audience a token must be issued for.
export function getOwnOrigin() {
  return new URL(getAppUrl()).origin;
}

export function isAccountSsoConfigured() {
  return readConfiguredPublicKeyPem() !== null;
}

export function createAccountSsoState() {
  return randomBytes(18).toString("base64url");
}

export function buildAccountSsoUrl(state: string) {
  const url = new URL("/auth/sso", getAccountUrl());
  url.searchParams.set("return", getOwnOrigin());
  url.searchParams.set("state", state);

  return url.toString();
}

// A token is accepted once: its id is remembered until it would have expired anyway.
const usedTokens = new Map<string, number>();

function markUsed(jti: string, expSeconds: number) {
  const now = Date.now();

  for (const [id, expiresAt] of usedTokens) {
    if (expiresAt <= now) {
      usedTokens.delete(id);
    }
  }

  if (usedTokens.has(jti)) {
    return false;
  }

  usedTokens.set(jti, expSeconds * 1000 + 60_000);

  return true;
}

// Signature, issuer, audience and expiry (verifySsoToken), then the anti-forgery state and one-time use.
export function acceptAccountToken(token: string | null, expectedState: string | null): SsoClaims | null {
  const pem = readConfiguredPublicKeyPem();

  if (!pem || !token || !expectedState) {
    return null;
  }

  const claims = verifySsoToken(token, pem, getOwnOrigin());

  if (!claims || claims.state !== expectedState || !markUsed(claims.jti, claims.exp)) {
    return null;
  }

  return claims;
}
