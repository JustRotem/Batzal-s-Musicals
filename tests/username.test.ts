import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateUsername } from "../lib/username";

describe("validateUsername", () => {
  it("accepts letters in any language, digits, underscores and single spaces", () => {
    assert.deepEqual(validateUsername("Rotem_2"), { ok: true, value: "Rotem_2" });
    assert.deepEqual(validateUsername("  רותם   לאופר "), { ok: true, value: "רותם לאופר" });
    assert.deepEqual(validateUsername("abc"), { ok: true, value: "abc" });
  });

  it("rejects names that are too short or too long", () => {
    assert.deepEqual(validateUsername("ab"), { ok: false, error: "username-too-short" });
    assert.deepEqual(validateUsername("   a  "), { ok: false, error: "username-too-short" });
    assert.deepEqual(validateUsername("x".repeat(31)), { ok: false, error: "username-too-long" });
    assert.equal(validateUsername("x".repeat(30)).ok, true);
  });

  it("rejects symbols, markup and emoji", () => {
    for (const bad of ["a@b.com", "<script>", "name!", "a-b-c", "name😀x"]) {
      assert.deepEqual(validateUsername(bad), { ok: false, error: "username-invalid" }, bad);
    }
  });
});
