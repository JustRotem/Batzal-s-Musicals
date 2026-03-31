import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_CLIP_VIDEO_FILE_SIZE_BYTES } from "@/lib/clip-video-config";

export const CLIP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "clips");
export const CLIP_UPLOAD_PUBLIC_PATH = "/uploads/clips";
export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
};

export class ClipVideoUploadError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "ClipVideoUploadError";
    this.code = code;
  }
}

export function getVideoExtensionFromFile(file: File) {
  if (file.type && file.type in ALLOWED_VIDEO_TYPES) {
    return ALLOWED_VIDEO_TYPES[file.type];
  }

  const extension = path.extname(file.name || "").toLowerCase();

  if (Object.values(ALLOWED_VIDEO_TYPES).includes(extension)) {
    return extension;
  }

  return null;
}

export async function saveUploadedClipVideo(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) {
    console.warn("[clip-video-upload] save:empty-file");
    return null;
  }

  const extension = getVideoExtensionFromFile(file);

  console.info("[clip-video-upload] save:start", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || null,
    extension,
    uploadDir: CLIP_UPLOAD_DIR,
  });

  if (!extension) {
    console.warn("[clip-video-upload] save:invalid-extension", {
      fileName: file.name,
      fileType: file.type || null,
    });
    throw new ClipVideoUploadError("invalid-upload-file-type");
  }

  if (file.size > MAX_CLIP_VIDEO_FILE_SIZE_BYTES) {
    console.warn("[clip-video-upload] save:file-too-large", {
      fileName: file.name,
      fileSize: file.size,
      maxBytes: MAX_CLIP_VIDEO_FILE_SIZE_BYTES,
    });
    throw new ClipVideoUploadError("upload-file-too-large");
  }

  console.info("[clip-video-upload] save:mkdir", {
    uploadDir: CLIP_UPLOAD_DIR,
  });
  await mkdir(CLIP_UPLOAD_DIR, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  console.info("[clip-video-upload] save:read-buffer:start", {
    fileName,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  console.info("[clip-video-upload] save:read-buffer:done", {
    fileName,
    bytes: buffer.byteLength,
  });
  const filePath = path.join(CLIP_UPLOAD_DIR, fileName);

  console.info("[clip-video-upload] save:write:start", {
    fileName,
    filePath,
  });
  await writeFile(filePath, buffer);
  console.info("[clip-video-upload] save:write:done", {
    fileName,
    filePath,
  });

  return `${CLIP_UPLOAD_PUBLIC_PATH}/${fileName}`;
}
