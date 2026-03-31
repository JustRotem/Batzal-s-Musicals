"use server";

import { revalidatePath } from "next/cache";
import path from "node:path";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { CLIP_UPLOAD_PUBLIC_PATH } from "@/lib/clip-video-upload";
import { scheduleClipUploadOrphanCleanup } from "@/lib/clip-video-orphan-cleanup";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeSlug, slugifyTitle } from "@/lib/slug";
import { sanitizeRichTextContent } from "@/lib/musical-description";
import { validateClipFormValues } from "@/lib/clip-validation";
import { getMusicalFormData, parseOptionalYear } from "@/lib/musical-form/helpers";
import {
  deleteUploadedImage,
  ImageUploadError,
  isFileEntry,
  redirectForImageUploadError,
  saveUploadedImage,
} from "@/lib/image-upload";

const MUSICAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "musicals");
const MUSICAL_UPLOAD_PUBLIC_PATH = "/uploads/musicals";
const CLIP_THUMBNAIL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "clip-thumbnails");
const CLIP_THUMBNAIL_PUBLIC_PATH = "/uploads/clip-thumbnails";
function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function encodeSlugSegment(value: string): string {
  return encodeURIComponent(value);
}

function buildMusicalFormRedirect(
  basePath: string,
  error: string,
  values: Record<string, string | boolean | null | undefined>,
): never {
  const searchParams = new URLSearchParams({ error });

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "boolean") {
      if (value) {
        searchParams.set(key, "1");
      }

      continue;
    }

    if (!value) {
      continue;
    }

    searchParams.set(key, value);
  }

  redirect(`${basePath}?${searchParams.toString()}`);
}

async function saveMusicalImage(
  file: File | null,
  errorPath: string,
): Promise<string | null> {
  try {
    return await saveUploadedImage({
      file,
      uploadDir: MUSICAL_UPLOAD_DIR,
      publicPathPrefix: MUSICAL_UPLOAD_PUBLIC_PATH,
    });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      redirectForImageUploadError(errorPath, error.code);
    }

    throw error;
  }
}

async function deleteUploadedMusicalImage(imagePath: string | null | undefined) {
  await deleteUploadedImage(imagePath, MUSICAL_UPLOAD_PUBLIC_PATH);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const cleanBase = normalizeSlug(baseSlug || `musical-${Date.now()}`);
  let slug = cleanBase;
  let counter = 2;

  while (true) {
    const existing = await db.musical.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return slug;

    slug = `${cleanBase}-${counter}`;
    counter += 1;
  }
}

export async function createMusicalAction(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.musicalCreate);

  const {
    title,
    description,
    yearRaw,
    posterDisplayMode,
    posterAspect,
    imageFile,
    isPublished: publishNow,
    formValues,
  } = getMusicalFormData(formData);

  if (!title) {
    buildMusicalFormRedirect("/admin/musicals/new", "missing-title", formValues);
  }

  const year = parseOptionalYear(yearRaw);
  if (yearRaw && year === null) {
    buildMusicalFormRedirect("/admin/musicals/new", "invalid-year", formValues);
  }

  const baseSlug = slugifyTitle(title);

  console.info("[musical-create] imageFile payload", {
    hasFile: Boolean(imageFile),
    name: imageFile?.name ?? null,
    size: imageFile?.size ?? null,
    type: imageFile?.type ?? null,
  });
  const imagePath = await saveMusicalImage(imageFile, "/admin/musicals/new");
  console.info("[musical-create] saveMusicalImage result", { imagePath });
  const slug = await ensureUniqueSlug(baseSlug || `musical-${Date.now()}`);
  const lastOrder = await db.musical.aggregate({
    _max: { sortOrder: true },
  });
  const nextSortOrder = (lastOrder._max.sortOrder ?? -1) + 1;

  const musical = await db.musical.create({
    data: {
      slug: normalizeSlug(slug),
      title,
      description,
      year,
      imagePath,
      posterDisplayMode,
      posterAspect,
      sortOrder: nextSortOrder,
      isPublished: publishNow,
      createdById: currentUser.id,
      updatedById: currentUser.id,
    },
    select: {
      slug: true,
    },
  });

  revalidateMusicalListPages();
  revalidatePath(`/musicals/${musical.slug}`, "page");

  const redirectSlug = encodeURIComponent(musical.slug);
  redirect(`/musicals/${redirectSlug}`);
}

function parseRequiredNonNegativeInteger(value: string): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function buildClipFormRedirect(
  currentSlug: string,
  error: string,
  values: Record<string, string | null>,
  clipId?: string,
): never {
  const searchParams = new URLSearchParams({ error });

  for (const [key, value] of Object.entries(values)) {
    if (!value) {
      continue;
    }

    searchParams.set(key, value);
  }

  const encodedSlug = encodeSlugSegment(currentSlug);
  const basePath = clipId
    ? `/admin/musicals/${encodedSlug}/clips/${clipId}/edit`
    : `/admin/musicals/${encodedSlug}/clips/new`;

  redirect(`${basePath}?${searchParams.toString()}`);
}

function logClipCreateRedirect(
  currentSlug: string,
  reason: string,
  details: Record<string, unknown>,
) {
  console.warn("[clip-create] redirect", {
    slug: currentSlug,
    reason,
    ...details,
  });
}

const revalidateClipPagesAndRedirect = (currentSlug: string): never => {
  revalidateMusicalListPages();
  revalidatePath(`/musicals/${currentSlug}`, "page");

  redirect(`/musicals/${encodeSlugSegment(currentSlug)}`);
};

const revalidateMusicalListPages = () => {
  revalidatePath("/", "page");
  revalidatePath("/musicals", "page");
};

const getClipFormData = (formData: FormData) => {
  const musicalId = normalize(formData.get("musicalId"));
  const currentSlug = normalize(formData.get("currentSlug"));
  const title = normalize(formData.get("title"));
  const description = sanitizeRichTextContent(formData.get("description")?.toString());
  const sourceTypeRaw = normalize(formData.get("sourceType"));
  const youtubeVideoId = normalize(formData.get("youtubeVideoId"));
  const uploadedVideoUrl = normalize(formData.get("uploadedVideoUrl"));
  const uploadedThumbnailFileEntry = formData.get("uploadedThumbnailFile");
  const uploadedThumbnailFile = isFileEntry(uploadedThumbnailFileEntry)
    ? uploadedThumbnailFileEntry
    : null;
  const startTimeRaw = normalize(formData.get("startTime"));
  const endTimeRaw = normalize(formData.get("endTime"));
  const formValues = {
    title,
    description,
    sourceType: sourceTypeRaw,
    youtubeVideoId,
    uploadedVideoUrl,
    startTime: startTimeRaw,
    endTime: endTimeRaw,
  };

  return {
    musicalId,
    currentSlug,
    title,
    description,
    sourceTypeRaw,
    youtubeVideoId,
    uploadedVideoUrl,
    uploadedThumbnailFile,
    startTimeRaw,
    endTimeRaw,
    formValues,
  };
};

const validateClipFormData = ({
  currentSlug,
  title,
  sourceTypeRaw,
  youtubeVideoId,
  uploadedVideoUrl,
  startTimeRaw,
  endTimeRaw,
  formValues,
  clipId,
  logPrefix,
  logDetails,
}: {
  currentSlug: string;
  title: string;
  sourceTypeRaw: string;
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  startTimeRaw: string;
  endTimeRaw: string;
  formValues: Record<string, string | null>;
  clipId?: string;
  logPrefix?: string;
  logDetails?: Record<string, unknown>;
}): {
  sourceType: "youtube" | "upload";
  normalizedYouTubeVideoId: string | null;
  resolvedStartSeconds: number;
  resolvedEndSeconds: number | null;
} => {
  const buildRedirect = (error: string, details?: Record<string, unknown>): never => {
    if (logPrefix && logDetails) {
      console.warn(`[${logPrefix}] redirect`, {
        slug: currentSlug,
        reason: error,
        ...logDetails,
        ...details,
      });
    }

    return buildClipFormRedirect(currentSlug, error, formValues, clipId);
  };

  if (!title) {
    return buildRedirect("missing-title");
  }

  const validation = validateClipFormValues({
    title,
    sourceTypeRaw,
    youtubeVideoId,
    uploadedVideoUrl,
    startTimeRaw,
    endTimeRaw,
  });

  if (validation.ok) {
    return {
      sourceType: validation.sourceType,
      normalizedYouTubeVideoId: validation.normalizedYouTubeVideoId,
      resolvedStartSeconds: validation.resolvedStartSeconds,
      resolvedEndSeconds: validation.resolvedEndSeconds,
    };
  }

  return buildRedirect(validation.error, validation.details);
};

export async function createClipAction(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.clipCreate);

  const {
    musicalId,
    currentSlug,
    title,
    description,
    sourceTypeRaw,
    youtubeVideoId,
    uploadedVideoUrl,
    uploadedThumbnailFile,
    startTimeRaw,
    endTimeRaw,
    formValues,
  } = getClipFormData(formData);

  if (!musicalId) {
    redirect("/musicals");
  }

  if (!currentSlug) {
    redirect("/musicals");
  }

  try {
    console.info("[clip-create] request:start", {
      userId: currentUser.id,
      musicalId,
      slug: currentSlug,
      sourceType: sourceTypeRaw,
      uploadedVideoUrl,
      hasUploadedVideoUrl: !!uploadedVideoUrl,
      youtubeVideoId,
      titleLength: title.length,
      descriptionLength: description?.length ?? 0,
    });

    const { sourceType, normalizedYouTubeVideoId, resolvedStartSeconds, resolvedEndSeconds } =
      validateClipFormData({
        currentSlug,
        title,
        sourceTypeRaw,
        youtubeVideoId,
        uploadedVideoUrl,
        startTimeRaw,
        endTimeRaw,
        formValues,
        logPrefix: "clip-create",
        logDetails: {
          userId: currentUser.id,
          sourceType: sourceTypeRaw,
        },
      });

    const lastClip = await db.clip.findFirst({
      where: {
        musicalId,
      },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      select: {
        sortOrder: true,
      },
    });
    const sortOrder = (lastClip?.sortOrder ?? -1) + 1;

    console.info("[clip-create] request:validated", {
      userId: currentUser.id,
      slug: currentSlug,
      sourceType,
      uploadedVideoUrl: sourceType === "upload" ? uploadedVideoUrl : null,
      youtubeVideoId: sourceType === "youtube" ? normalizedYouTubeVideoId : null,
      startSeconds: resolvedStartSeconds,
      endSeconds: resolvedEndSeconds,
      sortOrder,
    });

    let uploadedThumbnailUrl: string | null = null;
    if (sourceType === "upload" && uploadedThumbnailFile) {
      try {
        uploadedThumbnailUrl = await saveUploadedImage({
          file: uploadedThumbnailFile,
          uploadDir: CLIP_THUMBNAIL_UPLOAD_DIR,
          publicPathPrefix: CLIP_THUMBNAIL_PUBLIC_PATH,
        });
      } catch (error) {
        if (error instanceof ImageUploadError) {
          return buildClipFormRedirect(currentSlug, error.code, formValues);
        }

        throw error;
      }
    }

    const createdClip = await db.clip.create({
      data: {
        musicalId,
        title,
        description: description || null,
        sourceType,
        youtubeVideoId: sourceType === "youtube" ? normalizedYouTubeVideoId : null,
        uploadedVideoUrl: sourceType === "upload" ? uploadedVideoUrl : null,
        uploadedThumbnailUrl: sourceType === "upload" ? uploadedThumbnailUrl : null,
        startSeconds: resolvedStartSeconds,
        endSeconds: resolvedEndSeconds,
        sortOrder,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
      select: {
        id: true,
        uploadedVideoUrl: true,
        sourceType: true,
      },
    });

    console.info("[clip-create] request:success", {
      userId: currentUser.id,
      slug: currentSlug,
      clipId: createdClip.id,
      sourceType: createdClip.sourceType,
      uploadedVideoUrl: createdClip.uploadedVideoUrl,
    });

    void scheduleClipUploadOrphanCleanup("clip-create-success");
    revalidateClipPagesAndRedirect(currentSlug);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[clip-create] failed", {
      slug: currentSlug,
      sourceType: sourceTypeRaw,
      uploadedVideoUrl,
      reason: error instanceof Error ? error.message : "unknown-error",
      stack: error instanceof Error ? error.stack : null,
    });
    buildClipFormRedirect(currentSlug, "save-failed", formValues);
  }
}

export async function updateClipAction(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.clipEdit);

  const clipId = normalize(formData.get("clipId"));
  const {
    musicalId,
    currentSlug,
    title,
    description,
    sourceTypeRaw,
    youtubeVideoId,
    uploadedVideoUrl,
    uploadedThumbnailFile,
    startTimeRaw,
    endTimeRaw,
    formValues,
  } = getClipFormData(formData);

  if (!clipId) {
    redirect(`/musicals/${currentSlug ? encodeSlugSegment(currentSlug) : ""}`);
  }

  if (!musicalId) {
    redirect(`/musicals/${currentSlug ? encodeSlugSegment(currentSlug) : ""}`);
  }

  if (!currentSlug) {
    redirect("/musicals");
  }

  const existingClip = await db.clip.findFirst({
    where: {
      id: clipId,
      musicalId,
    },
    select: {
      id: true,
      sourceType: true,
      uploadedVideoUrl: true,
      uploadedThumbnailUrl: true,
      sortOrder: true,
    },
  });

  if (!existingClip) {
    redirect(`/musicals/${encodeSlugSegment(currentSlug)}`);
  }

  try {
    const { sourceType, normalizedYouTubeVideoId, resolvedStartSeconds, resolvedEndSeconds } =
      validateClipFormData({
        currentSlug,
        title,
        sourceTypeRaw,
        youtubeVideoId,
        uploadedVideoUrl,
        startTimeRaw,
        endTimeRaw,
        formValues,
        clipId,
      });

    const sortOrder = existingClip.sortOrder;

    const nextUploadedVideoUrl = sourceType === "upload" ? uploadedVideoUrl : null;
    let nextUploadedThumbnailUrl =
      sourceType === "upload" ? existingClip.uploadedThumbnailUrl ?? null : null;

    if (sourceType === "upload" && uploadedThumbnailFile) {
      try {
        nextUploadedThumbnailUrl = await saveUploadedImage({
          file: uploadedThumbnailFile,
          uploadDir: CLIP_THUMBNAIL_UPLOAD_DIR,
          publicPathPrefix: CLIP_THUMBNAIL_PUBLIC_PATH,
        });
      } catch (error) {
        if (error instanceof ImageUploadError) {
          return buildClipFormRedirect(currentSlug, error.code, formValues, clipId);
        }

        throw error;
      }
    }

    await db.clip.update({
      where: {
        id: clipId,
      },
      data: {
        title,
        description: description || null,
        sourceType,
        youtubeVideoId: sourceType === "youtube" ? normalizedYouTubeVideoId : null,
        uploadedVideoUrl: nextUploadedVideoUrl,
        uploadedThumbnailUrl: nextUploadedThumbnailUrl,
        startSeconds: resolvedStartSeconds,
        endSeconds: resolvedEndSeconds,
        sortOrder,
        updatedById: currentUser.id,
      },
    });

    if (
      existingClip.uploadedVideoUrl &&
      existingClip.uploadedVideoUrl.startsWith(`${CLIP_UPLOAD_PUBLIC_PATH}/`) &&
      existingClip.uploadedVideoUrl !== nextUploadedVideoUrl
    ) {
      await deleteUploadedImage(existingClip.uploadedVideoUrl, CLIP_UPLOAD_PUBLIC_PATH);
    }

    if (
      existingClip.uploadedThumbnailUrl &&
      existingClip.uploadedThumbnailUrl.startsWith(`${CLIP_THUMBNAIL_PUBLIC_PATH}/`) &&
      existingClip.uploadedThumbnailUrl !== nextUploadedThumbnailUrl
    ) {
      await deleteUploadedImage(existingClip.uploadedThumbnailUrl, CLIP_THUMBNAIL_PUBLIC_PATH);
    }

    void scheduleClipUploadOrphanCleanup("clip-update-success");
    revalidateClipPagesAndRedirect(currentSlug);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[clip-update] failed", {
      slug: currentSlug,
      clipId,
      reason: error instanceof Error ? error.message : "unknown-error",
    });
    buildClipFormRedirect(currentSlug, "save-failed", formValues, clipId);
  }
}

export async function reorderMusicalClipsAction(
  _previousState: { error: string | null; success: boolean },
  formData: FormData,
) {
  const currentUser = await requirePermission(PERMISSIONS.musicalEdit);
  const musicalId = normalize(formData.get("musicalId"));
  const currentSlug = normalize(formData.get("currentSlug"));
  const orderedClipIdsRaw = normalize(formData.get("orderedClipIds"));

  if (!musicalId || !currentSlug || !orderedClipIdsRaw) {
    return { error: "save-failed", success: false };
  }

  try {
    const orderedClipIds = JSON.parse(orderedClipIdsRaw) as unknown;

    if (!Array.isArray(orderedClipIds) || !orderedClipIds.every((value) => typeof value === "string" && value)) {
      return { error: "save-failed", success: false };
    }

    const existingClips = await db.clip.findMany({
      where: {
        musicalId,
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const existingClipIds = existingClips.map((clip) => clip.id);
    const nextClipIds = orderedClipIds.map((clipId) => clipId.trim());

    if (
      existingClipIds.length !== nextClipIds.length ||
      new Set(nextClipIds).size !== nextClipIds.length ||
      existingClipIds.some((clipId) => !nextClipIds.includes(clipId))
    ) {
      console.warn("[clip-reorder] invalid-payload", {
        userId: currentUser.id,
        musicalId,
        existingClipIds,
        nextClipIds,
      });
      return { error: "save-failed", success: false };
    }

    await db.$transaction(
      nextClipIds.map((clipId, index) =>
        db.clip.update({
          where: {
            id: clipId,
          },
          data: {
            sortOrder: index,
            updatedById: currentUser.id,
          },
        }),
      ),
    );

    console.info("[clip-reorder] success", {
      userId: currentUser.id,
      musicalId,
      currentSlug,
      nextClipIds,
    });

    revalidatePath(`/admin/musicals/${currentSlug}/edit`, "page");
    revalidatePath(`/musicals/${currentSlug}`, "page");
    revalidatePath("/musicals", "page");

    return { error: null, success: true };
  } catch (error) {
    console.error("[clip-reorder] failed", {
      userId: currentUser.id,
      musicalId,
      currentSlug,
      reason: error instanceof Error ? error.message : "unknown-error",
      stack: error instanceof Error ? error.stack : null,
    });
    return { error: "save-failed", success: false };
  }
}

export async function reorderMusicalsAction(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.musicalEdit);
  const orderedMusicalIdsRaw = normalize(formData.get("orderedMusicalIds"));

  if (!orderedMusicalIdsRaw) {
    return;
  }

  const orderedMusicalIds = JSON.parse(orderedMusicalIdsRaw) as unknown;
  if (!Array.isArray(orderedMusicalIds) || !orderedMusicalIds.every((value) => typeof value === "string" && value)) {
    return;
  }

  const existingMusicals = await db.musical.findMany({
    select: {
      id: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const existingIds = existingMusicals.map((musical) => musical.id);
  const nextIds = orderedMusicalIds.map((id) => id.trim());

  if (
    existingIds.length !== nextIds.length ||
    new Set(nextIds).size !== nextIds.length ||
    existingIds.some((id) => !nextIds.includes(id))
  ) {
    console.warn("[musical-reorder] invalid-payload", {
      userId: currentUser.id,
      existingIds,
      nextIds,
    });
    return;
  }

  await db.$transaction(
    nextIds.map((id, index) =>
      db.musical.update({
        where: { id },
        data: {
          sortOrder: index,
          updatedById: currentUser.id,
        },
      }),
    ),
  );

  revalidatePath("/musicals", "page");
  revalidatePath("/", "page");
  redirect("/musicals");
}

export async function deleteClipAction(formData: FormData) {
  await requirePermission(PERMISSIONS.clipDelete);

  const clipId = normalize(formData.get("clipId"));
  const currentSlug = normalize(formData.get("currentSlug"));

  if (!clipId) {
    redirect(`/musicals/${currentSlug ? encodeSlugSegment(currentSlug) : ""}`);
  }

  if (!currentSlug) {
    redirect("/musicals");
  }

  const clip = await db.clip.findUnique({
    where: {
      id: clipId,
    },
    select: {
      uploadedVideoUrl: true,
    },
  });

  await db.clip.delete({
    where: {
      id: clipId,
    },
  });

  if (clip?.uploadedVideoUrl?.startsWith(`${CLIP_UPLOAD_PUBLIC_PATH}/`)) {
    await deleteUploadedImage(clip.uploadedVideoUrl, CLIP_UPLOAD_PUBLIC_PATH);
  }

  void scheduleClipUploadOrphanCleanup("clip-delete-success");
  revalidateClipPagesAndRedirect(currentSlug);
}

export async function deleteMusicalAction(formData: FormData) {
  await requirePermission(PERMISSIONS.musicalDelete);

  const musicalId = normalize(formData.get("musicalId"));

  if (!musicalId) {
    redirect("/musicals");
  }

  const musical = await db.musical.findUnique({
    where: {
      id: musicalId,
    },
    select: {
      imagePath: true,
    },
  });

  await db.musical.delete({
    where: {
      id: musicalId,
    },
  });

  await deleteUploadedMusicalImage(musical?.imagePath);

  revalidatePath("/", "page");
  revalidatePath("/musicals", "page");

  redirect("/musicals");
}

export async function updateMusicalAction(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.musicalEdit);

  const musicalId = normalize(formData.get("musicalId"));
  const currentSlug = normalize(formData.get("currentSlug"));
  const orderedClipIdsRaw = normalize(formData.get("orderedClipIds"));
  const removeImage = formData.get("removeImage") === "1";
  const {
    title,
    description,
    yearRaw,
    posterDisplayMode,
    posterAspect,
    imageFile,
    isPublished,
    formValues,
  } = getMusicalFormData(formData);

  if (!musicalId) {
    redirect("/musicals");
  }

  if (!currentSlug) {
    redirect("/musicals");
  }

  const redirectFormValues = {
    ...formValues,
    orderedClipIds: orderedClipIdsRaw,
  };

  if (!title) {
    buildMusicalFormRedirect(
      `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
      "missing-title",
      redirectFormValues,
    );
  }

  const year = parseOptionalYear(yearRaw);
  if (yearRaw && year === null) {
    buildMusicalFormRedirect(
      `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
      "invalid-year",
      redirectFormValues,
    );
  }

  const existingMusical = await db.musical.findUnique({
    where: {
      id: musicalId,
    },
    select: {
      imagePath: true,
      slug: true,
    },
  });

  if (!existingMusical) {
    redirect("/musicals");
  }

  let orderedClipIds: string[] | null = null;
  if (orderedClipIdsRaw) {
    try {
      const parsed = JSON.parse(orderedClipIdsRaw) as unknown;
      if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string" && value.trim())) {
        buildMusicalFormRedirect(
          `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
          "clip-order-save-failed",
          redirectFormValues,
        );
      }
      orderedClipIds = parsed.map((value) => value.trim());
    } catch {
      buildMusicalFormRedirect(
        `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
        "clip-order-save-failed",
        redirectFormValues,
      );
    }
  }

  console.info("[musical-update] imageFile payload", {
    hasFile: Boolean(imageFile),
    name: imageFile?.name ?? null,
    size: imageFile?.size ?? null,
    type: imageFile?.type ?? null,
    removeImage,
  });
  const newImagePath = await saveMusicalImage(
    imageFile,
    `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
  );
  console.info("[musical-update] saveMusicalImage result", { newImagePath });

  let musicalSlug = existingMusical.slug;
  try {
    const musical = await db.$transaction(async (tx) => {
      if (orderedClipIds) {
        const existingClips = await tx.clip.findMany({
          where: {
            musicalId,
          },
          select: {
            id: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        const existingClipIds = existingClips.map((clip) => clip.id);

        if (
          existingClipIds.length !== orderedClipIds.length ||
          new Set(orderedClipIds).size !== orderedClipIds.length ||
          existingClipIds.some((clipId) => !orderedClipIds?.includes(clipId))
        ) {
          console.warn("[clip-reorder] invalid-payload", {
            userId: currentUser.id,
            musicalId,
            existingClipIds,
            nextClipIds: orderedClipIds,
          });
          throw new Error("clip-order-save-failed");
        }
      }

      const updatedMusical = await tx.musical.update({
        where: {
          id: musicalId,
        },
        data: {
          title,
          description: description || null,
          year,
          imagePath: removeImage ? null : newImagePath ?? existingMusical.imagePath,
          posterDisplayMode,
          posterAspect,
          isPublished,
          updatedById: currentUser.id,
        },
        select: {
          slug: true,
        },
      });

      if (orderedClipIds) {
        for (const [index, clipId] of orderedClipIds.entries()) {
          await tx.clip.update({
            where: {
              id: clipId,
            },
            data: {
              sortOrder: index,
              updatedById: currentUser.id,
            },
          });
        }
      }

      return updatedMusical;
    });

    musicalSlug = musical.slug;
  } catch (error) {
    if (error instanceof Error && error.message === "clip-order-save-failed") {
      buildMusicalFormRedirect(
        `/admin/musicals/${encodeSlugSegment(currentSlug)}/edit`,
        "clip-order-save-failed",
        formValues,
      );
    }
    throw error;
  }

  if (newImagePath && existingMusical.imagePath && existingMusical.imagePath !== newImagePath) {
    await deleteUploadedMusicalImage(existingMusical.imagePath);
  }

  if (removeImage && existingMusical.imagePath && !newImagePath) {
    await deleteUploadedMusicalImage(existingMusical.imagePath);
  }

  revalidatePath("/", "page");
  revalidatePath("/musicals", "page");
  revalidatePath(`/musicals/${musicalSlug}`, "page");
  if (currentSlug !== musicalSlug) {
    revalidatePath(`/musicals/${currentSlug}`, "page");
  }

  redirect(`/musicals/${encodeSlugSegment(musicalSlug)}?updated=1`);
}
