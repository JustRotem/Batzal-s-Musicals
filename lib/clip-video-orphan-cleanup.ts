import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { CLIP_UPLOAD_DIR, CLIP_UPLOAD_PUBLIC_PATH } from "@/lib/clip-video-upload";

const CLIP_UPLOAD_ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const CLIP_UPLOAD_CLEANUP_THROTTLE_MS = 60 * 60 * 1000;

let lastClipUploadCleanupAt = 0;
let activeClipUploadCleanupPromise: Promise<void> | null = null;

function getClipUploadFileNameFromUrl(uploadedVideoUrl: string | null | undefined) {
  if (!uploadedVideoUrl || !uploadedVideoUrl.startsWith(`${CLIP_UPLOAD_PUBLIC_PATH}/`)) {
    return null;
  }

  const fileName = uploadedVideoUrl.slice(`${CLIP_UPLOAD_PUBLIC_PATH}/`.length).trim();
  return fileName ? path.basename(fileName) : null;
}

async function cleanupOrphanedClipUploadFiles() {
  const startedAt = Date.now();
  const referencedClips = await db.clip.findMany({
    where: {
      uploadedVideoUrl: {
        startsWith: `${CLIP_UPLOAD_PUBLIC_PATH}/`,
      },
    },
    select: {
      uploadedVideoUrl: true,
    },
  });

  const referencedFileNames = new Set(
    referencedClips
      .map((clip) => getClipUploadFileNameFromUrl(clip.uploadedVideoUrl))
      .filter((value): value is string => !!value),
  );

  let directoryEntries: string[] = [];

  try {
    directoryEntries = await readdir(CLIP_UPLOAD_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.info("[clip-video-cleanup] skipped-missing-directory", {
        uploadDir: CLIP_UPLOAD_DIR,
      });
      return;
    }

    throw error;
  }

  let deletedCount = 0;
  let keptReferencedCount = 0;
  let keptRecentCount = 0;

  for (const entry of directoryEntries) {
    const fileName = path.basename(entry);

    if (referencedFileNames.has(fileName)) {
      keptReferencedCount += 1;
      continue;
    }

    const filePath = path.join(CLIP_UPLOAD_DIR, fileName);
    const fileStats = await stat(filePath);
    const fileAgeMs = startedAt - fileStats.mtimeMs;

    if (fileAgeMs < CLIP_UPLOAD_ORPHAN_MIN_AGE_MS) {
      keptRecentCount += 1;
      continue;
    }

    await unlink(filePath);
    deletedCount += 1;

    console.info("[clip-video-cleanup] deleted-orphan", {
      fileName,
      filePath,
      ageMs: fileAgeMs,
    });
  }

  console.info("[clip-video-cleanup] completed", {
    uploadDir: CLIP_UPLOAD_DIR,
    scannedCount: directoryEntries.length,
    referencedCount: referencedFileNames.size,
    keptReferencedCount,
    keptRecentCount,
    deletedCount,
    minAgeMs: CLIP_UPLOAD_ORPHAN_MIN_AGE_MS,
  });
}

export function scheduleClipUploadOrphanCleanup(trigger: string) {
  const now = Date.now();

  if (activeClipUploadCleanupPromise) {
    console.info("[clip-video-cleanup] skipped-already-running", {
      trigger,
    });
    return activeClipUploadCleanupPromise;
  }

  if (now - lastClipUploadCleanupAt < CLIP_UPLOAD_CLEANUP_THROTTLE_MS) {
    console.info("[clip-video-cleanup] skipped-throttled", {
      trigger,
      nextEligibleAt: lastClipUploadCleanupAt + CLIP_UPLOAD_CLEANUP_THROTTLE_MS,
    });
    return null;
  }

  lastClipUploadCleanupAt = now;
  activeClipUploadCleanupPromise = cleanupOrphanedClipUploadFiles()
    .catch((error) => {
      console.error("[clip-video-cleanup] failed", {
        trigger,
        reason: error instanceof Error ? error.message : "unknown-error",
        stack: error instanceof Error ? error.stack : null,
      });
    })
    .finally(() => {
      activeClipUploadCleanupPromise = null;
    });

  return activeClipUploadCleanupPromise;
}

export const CLIP_UPLOAD_ORPHAN_CLEANUP_NOTES = {
  minAgeMs: CLIP_UPLOAD_ORPHAN_MIN_AGE_MS,
  throttleMs: CLIP_UPLOAD_CLEANUP_THROTTLE_MS,
};
