import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ClipVideoUploadError,
  saveUploadedClipVideo,
} from "../lib/clip-video-upload";
import { MAX_CLIP_VIDEO_FILE_SIZE_BYTES } from "../lib/clip-video-config";

const buildMockFile = ({
  name,
  type,
  size,
}: {
  name: string;
  type: string;
  size: number;
}) =>
  ({
    name,
    type,
    size,
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as File;

describe("saveUploadedClipVideo", () => {
  it("rejects invalid upload file types", async () => {
    const file = buildMockFile({
      name: "clip.txt",
      type: "text/plain",
      size: 1024,
    });

    await assert.rejects(
      () => saveUploadedClipVideo(file),
      (error) => error instanceof ClipVideoUploadError && error.code === "invalid-upload-file-type",
    );
  });

  it("rejects files that exceed the max upload size", async () => {
    const file = buildMockFile({
      name: "clip.mp4",
      type: "video/mp4",
      size: MAX_CLIP_VIDEO_FILE_SIZE_BYTES + 1,
    });

    await assert.rejects(
      () => saveUploadedClipVideo(file),
      (error) => error instanceof ClipVideoUploadError && error.code === "upload-file-too-large",
    );
  });
});
