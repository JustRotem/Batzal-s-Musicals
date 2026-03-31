import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateClipFormValues } from "../lib/clip-validation";

describe("validateClipFormValues", () => {
  it("accepts a valid upload clip payload", () => {
    const result = validateClipFormValues({
      title: "New Clip",
      sourceTypeRaw: "upload",
      youtubeVideoId: "",
      uploadedVideoUrl: "/uploads/clips/example.mp4",
      startTimeRaw: "0:05",
      endTimeRaw: "0:20",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sourceType, "upload");
      assert.equal(result.normalizedYouTubeVideoId, null);
      assert.equal(result.resolvedStartSeconds, 5);
      assert.equal(result.resolvedEndSeconds, 20);
    }
  });

  it("rejects missing upload video", () => {
    const result = validateClipFormValues({
      title: "Missing Upload",
      sourceTypeRaw: "upload",
      youtubeVideoId: "",
      uploadedVideoUrl: "",
      startTimeRaw: "",
      endTimeRaw: "",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "missing-upload-video");
    }
  });

  it("rejects invalid time ranges where start >= end", () => {
    const result = validateClipFormValues({
      title: "Invalid Range",
      sourceTypeRaw: "upload",
      youtubeVideoId: "",
      uploadedVideoUrl: "/uploads/clips/example.mp4",
      startTimeRaw: "0:10",
      endTimeRaw: "0:05",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "invalid-range");
    }
  });

  it("rejects invalid start time format", () => {
    const result = validateClipFormValues({
      title: "Invalid Start",
      sourceTypeRaw: "upload",
      youtubeVideoId: "",
      uploadedVideoUrl: "/uploads/clips/example.mp4",
      startTimeRaw: "bad",
      endTimeRaw: "0:10",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "invalid-start");
    }
  });

  it("rejects invalid end time format", () => {
    const result = validateClipFormValues({
      title: "Invalid End",
      sourceTypeRaw: "upload",
      youtubeVideoId: "",
      uploadedVideoUrl: "/uploads/clips/example.mp4",
      startTimeRaw: "0:05",
      endTimeRaw: "0:99",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "invalid-end");
    }
  });
});
