import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLanguage, resolveLanguage } from "../lib/i18n";

describe("resolveLanguage", () => {
  it("prefers the language saved on the account over the cookie", () => {
    assert.equal(resolveLanguage("en", "he"), "en");
    assert.equal(resolveLanguage("he", "en"), "he");
  });

  it("uses the cookie for signed-out visitors", () => {
    assert.equal(resolveLanguage(undefined, "en"), "en");
    assert.equal(resolveLanguage(null, "he"), "he");
  });

  it("ignores unsupported values and falls back to Hebrew", () => {
    assert.equal(resolveLanguage("fr", "de"), "he");
    assert.equal(resolveLanguage(undefined, undefined), "he");
  });

  it("normalizes unknown codes to Hebrew", () => {
    assert.equal(normalizeLanguage("en"), "en");
    assert.equal(normalizeLanguage("xx"), "he");
    assert.equal(normalizeLanguage(null), "he");
  });
});
