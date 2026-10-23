import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { before, describe, it } from "node:test";
import { sanitizeNextPath } from "../lib/login-next";
import {
  SSO_TOKEN_TTL_SECONDS,
  buildSsoCallbackUrl,
  getSsoPublicKeyPem,
  SSO_ISSUER,
  parseSsoRequest,
  signSsoToken,
  verifySsoToken,
} from "../lib/sso";

const user = {
  sub: "user-1",
  gsub: "google-sub-1",
  email: "a@example.com",
  name: "Rotem L",
  username: "rotem",
  picture: null,
  role: "user",
  lang: "he",
  theme: "dark",
  perms: ["panel_view"],
  sid: "group-1",
};
const STATE = "abcdefghijklmnop1234";
const QR = "https://qr.batzal.net";

describe("single sign-on tokens", () => {
  let publicPem = "";

  before(() => {
    const { privateKey } = generateKeyPairSync("ed25519");
    process.env.SSO_PRIVATE_KEY = Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    ).toString("base64");
    delete process.env.SSO_ALLOWED_ORIGINS;
    publicPem = getSsoPublicKeyPem() ?? "";
  });

  it("round-trips a signed token for the right audience", () => {
    const token = signSsoToken(user, QR, STATE);
    const claims = verifySsoToken(token, publicPem, QR);

    assert.ok(claims);
    assert.equal(claims.sub, "user-1");
    assert.equal(claims.gsub, "google-sub-1");
    assert.equal(claims.lang, "he");
    assert.equal(claims.state, STATE);
    assert.equal(claims.exp - claims.iat, SSO_TOKEN_TTL_SECONDS);
  });

  it("rejects a token meant for another site", () => {
    const token = signSsoToken(user, QR, STATE);

    assert.equal(verifySsoToken(token, publicPem, "https://admin.batzal.net"), null);
  });

  it("rejects an expired token", () => {
    const issuedAt = Date.now() - (SSO_TOKEN_TTL_SECONDS + 5) * 1000;
    const token = signSsoToken(user, QR, STATE, issuedAt);

    assert.equal(verifySsoToken(token, publicPem, QR), null);
  });

  it("rejects a tampered payload or signature", () => {
    const token = signSsoToken(user, QR, STATE);
    const [version, payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "superadmin" }),
    ).toString("base64url");

    assert.equal(verifySsoToken(`${version}.${forged}.${signature}`, publicPem, QR), null);
    assert.equal(verifySsoToken(`${version}.${payload}.${signature}x`, publicPem, QR), null);
    assert.equal(verifySsoToken("garbage", publicPem, QR), null);
  });

  it("rejects a token signed with a different key", () => {
    const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const token = signSsoToken(user, QR, STATE);

    assert.equal(verifySsoToken(token, other, QR), null);
  });
});

describe("sso request validation", () => {
  it("accepts only pre-approved origins", () => {
    assert.deepEqual(parseSsoRequest("https://qr.batzal.net/anything", STATE), { origin: QR, state: STATE });
    assert.equal(parseSsoRequest("https://evil.example", STATE), null);
    assert.equal(parseSsoRequest("https://qr.batzal.net.evil.example", STATE), null);
    assert.equal(parseSsoRequest("http://qr.batzal.net", STATE), null);
    assert.equal(parseSsoRequest("not a url", STATE), null);
  });

  it("requires a long enough random state", () => {
    assert.equal(parseSsoRequest(QR, "short"), null);
    assert.equal(parseSsoRequest(QR, "has spaces in the state value!"), null);
    assert.equal(parseSsoRequest(QR, null), null);
  });
});

describe("post-login redirect target", () => {
  it("allows same-site paths only", () => {
    assert.equal(sanitizeNextPath("/auth/sso?return=x&state=y"), "/auth/sso?return=x&state=y");
    assert.equal(sanitizeNextPath("/"), "/");
    assert.equal(sanitizeNextPath("//evil.example"), null);
    assert.equal(sanitizeNextPath("https://evil.example"), null);
    assert.equal(sanitizeNextPath("/\\evil.example"), null);
    assert.equal(sanitizeNextPath("/ok\r\nSet-Cookie: x=1"), null);
    assert.equal(sanitizeNextPath(null), null);
  });
});

describe("account site as identity provider", () => {
  it("issues tokens as the account site", () => {
    assert.equal(SSO_ISSUER, "account.batzal.net");
  });

  it("allows the musicals site and sends it to its own callback route", () => {
    delete process.env.SSO_ALLOWED_ORIGINS;
    process.env.MUSICALS_URL = "https://musicals.batzal.net";
    assert.deepEqual(parseSsoRequest("https://musicals.batzal.net", STATE), {
      origin: "https://musicals.batzal.net",
      state: STATE,
    });
    assert.ok(buildSsoCallbackUrl("https://musicals.batzal.net", "t").startsWith("https://musicals.batzal.net/auth/account/callback?token="));
    assert.ok(buildSsoCallbackUrl("https://qr.batzal.net", "t").startsWith("https://qr.batzal.net/api/sso/callback?token="));
  });
});
