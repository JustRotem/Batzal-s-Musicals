import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMusicalFormData, parseOptionalYear } from "../app/admin/musicals/actions";
import { saveUploadedImage } from "../lib/image-upload";

const buildFormData = (entries: Array<[string, string | Blob]>) => {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }
  return formData;
};

describe("musical form parsing and validation helpers", () => {
  it("parses valid musical input with optional fields", () => {
    const formData = buildFormData([
      ["title", "My Musical"],
      ["description", "A classic"],
      ["year", "1999"],
      ["posterDisplayMode", "fit"],
      ["isPublished", "on"],
    ]);

    const result = getMusicalFormData(formData);

    assert.equal(result.title, "My Musical");
    assert.equal(result.description, "A classic");
    assert.equal(result.yearRaw, "1999");
    assert.equal(result.posterDisplayMode, "fit");
    assert.equal(result.isPublished, true);
  });

  it("treats a missing title as empty", () => {
    const formData = buildFormData([["description", "No title"]]);
    const result = getMusicalFormData(formData);

    assert.equal(result.title, "");
  });

  it("parses year values correctly", () => {
    assert.equal(parseOptionalYear("1985"), 1985);
    assert.equal(parseOptionalYear("not-a-year"), null);
  });

  it("defaults isPublished to false when missing", () => {
    const formData = buildFormData([["title", "Draft Musical"]]);
    const result = getMusicalFormData(formData);

    assert.equal(result.isPublished, false);
  });

  it("treats an empty image file as null", async () => {
    const emptyFile = new File([], "poster.png", { type: "image/png" });
    const imagePath = await saveUploadedImage({
      file: emptyFile,
      uploadDir: "/tmp/musical-image-tests",
      publicPathPrefix: "/uploads/musicals",
    });

    assert.equal(imagePath, null);
  });
});
