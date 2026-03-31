import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";

const DEFAULT_ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const DEFAULT_MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

export class ImageUploadError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

function getImageUploadErrorPath(basePath: string, error: string) {
  return `${basePath}?error=${error}`;
}

export function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function saveUploadedImage({
  file,
  uploadDir,
  publicPathPrefix,
  maxFileSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES,
  allowedImageTypes = DEFAULT_ALLOWED_IMAGE_TYPES,
}: {
  file: File | null;
  uploadDir: string;
  publicPathPrefix: string;
  maxFileSizeBytes?: number;
  allowedImageTypes?: Record<string, string>;
}): Promise<string | null> {
  console.info("[image-upload] save:start", {
    hasFile: Boolean(file),
    name: file?.name ?? null,
    size: file?.size ?? null,
    type: file?.type ?? null,
    uploadDir,
    publicPathPrefix,
  });
  if (!file || file.size === 0) {
    console.warn("[image-upload] save:skipped-empty", {
      hasFile: Boolean(file),
      size: file?.size ?? null,
    });
    return null;
  }

  if (!(file.type in allowedImageTypes)) {
    console.warn("[image-upload] save:invalid-type", { type: file.type });
    throw new ImageUploadError("invalid-image-type");
  }

  if (file.size > maxFileSizeBytes) {
    console.warn("[image-upload] save:too-large", {
      size: file.size,
      maxFileSizeBytes,
    });
    throw new ImageUploadError("image-too-large");
  }

  await mkdir(uploadDir, { recursive: true });

  const extension = allowedImageTypes[file.type];
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, fileName);

  console.info("[image-upload] save:writing", { filePath });
  await writeFile(filePath, buffer);
  console.info("[image-upload] save:complete", { filePath });

  return `${publicPathPrefix}/${fileName}`;
}

export function redirectForImageUploadError(basePath: string, error: string): never {
  redirect(getImageUploadErrorPath(basePath, error));
}

export async function deleteUploadedImage(
  imagePath: string | null | undefined,
  publicPathPrefix: string,
) {
  if (!imagePath || !imagePath.startsWith(`${publicPathPrefix}/`)) {
    return;
  }

  const absolutePath = path.join(process.cwd(), "public", imagePath.replace(/^\//, ""));

  try {
    await unlink(absolutePath);
  } catch (error) {
    console.error("[uploaded-image-delete] failed", { imagePath, error });
  }
}
