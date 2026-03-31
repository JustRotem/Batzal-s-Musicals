"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { createClipAction } from "@/app/admin/musicals/actions";
import ClipPreviewTimingEditor from "@/components/ClipPreviewTimingEditor";
import NewMusicalSubmitButton from "@/components/NewMusicalSubmitButton";
import MusicalDescriptionEditor from "@/components/MusicalDescriptionEditor";
import { MAX_CLIP_VIDEO_FILE_SIZE_BYTES } from "@/lib/clip-video-config";
import { formatMessage, getTranslations, type AppLanguage } from "@/lib/i18n";

type ClipFormValues = {
  title: string;
  description: string;
  sourceType: "youtube" | "upload";
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  uploadedThumbnailUrl: string;
  startTime: string;
  endTime: string;
};

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const THUMBNAIL_ASPECT = 16 / 9;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for cropping"));
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

async function createCroppedThumbnailFile(
  file: File,
  cropArea: CropArea,
  loadedImage: HTMLImageElement,
): Promise<File> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create crop canvas");
  }

  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  ctx.drawImage(
    loadedImage,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) {
    throw new Error("Failed to create cropped thumbnail");
  }

  return new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}-thumb.jpg`, {
    type: "image/jpeg",
  });
}

type NewClipFormProps = {
  language?: AppLanguage;
  musical: {
    id: string;
    slug: string;
    title: string;
  };
  initialValues: ClipFormValues;
  clipId?: string;
  action?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  pendingLabel?: string;
  descriptionText?: string;
  cancelHref?: string;
  cancelLabel?: string;
  serverError?: string;
};

function getFieldErrorStyles(active: boolean) {
  return {
    "aria-invalid": active ? true : undefined,
    "aria-describedby": active ? "clip-form-error" : undefined,
  };
}

const getUploadDerivedState = ({
  clipId,
  initialValues,
  sourceType,
  youtubeVideoId,
  uploadedVideoUrl,
  uploadedVideoFileName,
  uploadStatus,
  uploadClientError,
  uploadError,
  uploadFileTypeError,
  uploadFileSizeError,
  serverErrorMessage,
  t,
}: {
  clipId?: string;
  initialValues: ClipFormValues;
  sourceType: ClipFormValues["sourceType"];
  youtubeVideoId: string;
  uploadedVideoUrl: string;
  uploadedVideoFileName: string | null;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadClientError: string | null;
  uploadError: boolean;
  uploadFileTypeError: boolean;
  uploadFileSizeError: boolean;
  serverErrorMessage: string | null;
  t: ReturnType<typeof getTranslations>["contentEditor"]["clips"];
}) => {
  const hasSavedSource =
    !!clipId &&
    ((initialValues.sourceType === "youtube" && !!initialValues.youtubeVideoId) ||
      (initialValues.sourceType === "upload" && !!initialValues.uploadedVideoUrl));
  const hasUnsavedSourceChanges =
    sourceType !== initialValues.sourceType ||
    youtubeVideoId !== initialValues.youtubeVideoId ||
    uploadedVideoUrl !== initialValues.uploadedVideoUrl ||
    !!uploadedVideoFileName;
  const sourcePreviewLabel =
    hasSavedSource && !hasUnsavedSourceChanges ? t.currentMediaLabel : t.draftPreviewLabel;
  const sourcePreviewNote = hasUnsavedSourceChanges ? t.unsavedMediaNote : t.currentMediaNote;
  const isUploadSource = sourceType === "upload";
  const hasSavedUploadedVideo = Boolean(
    isUploadSource &&
      uploadedVideoUrl &&
      !uploadedVideoUrl.startsWith("blob:"),
  );
  const hasResolvedUploadSuccess = uploadStatus === "success" || hasSavedUploadedVideo;
  const hasVisibleServerUploadError =
    !hasResolvedUploadSuccess && (uploadError || uploadFileTypeError || uploadFileSizeError);
  const hasStaleServerUploadError =
    (uploadError || uploadFileTypeError || uploadFileSizeError) && hasResolvedUploadSuccess;
  const visibleServerErrorMessage = hasStaleServerUploadError ? null : serverErrorMessage;
  const hasActiveUploadError = uploadStatus === "error" && !!uploadClientError;
  const isCreateDisabled =
    uploadStatus === "uploading" ||
    (isUploadSource && !hasSavedUploadedVideo) ||
    (hasActiveUploadError && !hasSavedUploadedVideo);

  return {
    hasSavedSource,
    hasUnsavedSourceChanges,
    sourcePreviewLabel,
    sourcePreviewNote,
    isUploadSource,
    hasSavedUploadedVideo,
    hasResolvedUploadSuccess,
    hasVisibleServerUploadError,
    hasStaleServerUploadError,
    visibleServerErrorMessage,
    hasActiveUploadError,
    isCreateDisabled,
  };
};

const getServerErrorState = (
  serverError: string | null | undefined,
  t: ReturnType<typeof getTranslations>["contentEditor"]["clips"],
) => {
  return {
    titleError: serverError === "missing-title",
    youtubeError: serverError === "missing-youtube-video",
    uploadError: serverError === "missing-upload-video",
    youtubeFormatError: serverError === "invalid-youtube-video",
    uploadFileTypeError: serverError === "invalid-upload-file-type",
    uploadFileSizeError: serverError === "upload-file-too-large",
    sourceError: serverError === "invalid-source",
    serverErrorMessage: serverError ? t.errors[serverError as keyof typeof t.errors] ?? null : null,
  };
};

const getUploadFieldMessage = ({
  clipId,
  initialValues,
  uploadStatus,
  uploadedVideoFileName,
  uploadedVideoFileSizeLabel,
  t,
}: {
  clipId?: string;
  initialValues: ClipFormValues;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadedVideoFileName: string | null;
  uploadedVideoFileSizeLabel: string | null;
  t: ReturnType<typeof getTranslations>["contentEditor"]["clips"];
}) => {
  if (uploadStatus === "uploading") {
    return t.uploadingFile;
  }

  if (uploadStatus === "success" && uploadedVideoFileName) {
    return `${uploadedVideoFileName} · ${t.uploadComplete}`;
  }

  if (uploadedVideoFileName && uploadedVideoFileSizeLabel) {
    return `${uploadedVideoFileName} · ${uploadedVideoFileSizeLabel}`;
  }

  if (uploadedVideoFileName) {
    return uploadedVideoFileName;
  }

  if (clipId && initialValues.sourceType === "upload" && initialValues.uploadedVideoUrl) {
    return t.savedUploadFile;
  }

  return t.noUploadFileSelected;
};

const getUploadErrorPresentation = ({
  hasVisibleServerUploadError,
  hasActiveUploadError,
  uploadClientError,
}: {
  hasVisibleServerUploadError: boolean;
  hasActiveUploadError: boolean;
  uploadClientError: string | null;
}) => {
  return {
    uploadFieldHasError: hasVisibleServerUploadError || hasActiveUploadError,
    uploadFieldErrorMessage: hasActiveUploadError ? uploadClientError : null,
  };
};

export default function NewClipForm({
  language = "he",
  musical,
  initialValues,
  clipId,
  action = createClipAction,
  submitLabel,
  pendingLabel,
  descriptionText,
  cancelHref,
  cancelLabel,
  serverError,
}: NewClipFormProps) {
  const t = getTranslations(language).contentEditor.clips;
  const [sourceType, setSourceType] = useState<ClipFormValues["sourceType"]>(
    initialValues.sourceType,
  );
  const [youtubeVideoId, setYouTubeVideoId] = useState(initialValues.youtubeVideoId);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(initialValues.uploadedVideoUrl);
  const [uploadedVideoPreviewUrl, setUploadedVideoPreviewUrl] = useState<string | null>(null);
  const [uploadedVideoFileName, setUploadedVideoFileName] = useState<string | null>(null);
  const [uploadedVideoFileSizeLabel, setUploadedVideoFileSizeLabel] = useState<string | null>(null);
  const [uploadedThumbnailPreviewUrl, setUploadedThumbnailPreviewUrl] = useState<string | null>(null);
  const [uploadedThumbnailFileName, setUploadedThumbnailFileName] = useState<string | null>(null);
  const [thumbnailCropSourceUrl, setThumbnailCropSourceUrl] = useState<string | null>(null);
  const [thumbnailCrop, setThumbnailCrop] = useState({ x: 0, y: 0 });
  const [thumbnailZoom, setThumbnailZoom] = useState(MIN_ZOOM);
  const [thumbnailCroppedArea, setThumbnailCroppedArea] = useState<CropArea | null>(null);
  const [thumbnailLoadedImage, setThumbnailLoadedImage] = useState<HTMLImageElement | null>(null);
  const thumbnailSourceFileRef = useRef<File | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadClientError, setUploadClientError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRequestIdRef = useRef(0);
  const uploadAbortControllerRef = useRef<XMLHttpRequest | null>(null);

  const {
    titleError,
    youtubeError,
    uploadError,
    youtubeFormatError,
    uploadFileTypeError,
    uploadFileSizeError,
    sourceError,
    serverErrorMessage,
  } = getServerErrorState(serverError, t);
  const resolvedSubmitLabel = submitLabel ?? t.create;
  const resolvedPendingLabel = pendingLabel ?? t.creating;
  const resolvedCancelLabel = cancelLabel ?? t.cancelChanges;
  const resolvedDescriptionText =
    descriptionText ?? formatMessage(t.basicText, { title: musical.title });
  const {
    hasSavedSource,
    hasUnsavedSourceChanges,
    sourcePreviewLabel,
    sourcePreviewNote,
    isUploadSource,
    hasSavedUploadedVideo,
    hasResolvedUploadSuccess,
    hasVisibleServerUploadError,
    hasStaleServerUploadError,
    visibleServerErrorMessage,
    hasActiveUploadError,
    isCreateDisabled,
  } = getUploadDerivedState({
    clipId,
    initialValues,
    sourceType,
    youtubeVideoId,
    uploadedVideoUrl,
    uploadedVideoFileName,
    uploadStatus,
    uploadClientError,
    uploadError,
    uploadFileTypeError,
    uploadFileSizeError,
    serverErrorMessage,
    t,
  });
  const resolvedUploadedVideoPreviewUrl = uploadedVideoPreviewUrl ?? uploadedVideoUrl;
  const createDisabledReasons = useMemo(() => {
    const reasons: string[] = [];

    if (uploadStatus === "uploading") {
      reasons.push("uploading");
    }

    if (isUploadSource && !hasSavedUploadedVideo) {
      reasons.push("missing-saved-uploaded-video");
    }

    if (hasActiveUploadError && !hasSavedUploadedVideo) {
      reasons.push("active-upload-error");
    }

    return reasons;
  }, [hasActiveUploadError, hasSavedUploadedVideo, isUploadSource, uploadStatus]);
  const uploadFieldMessage = useMemo(
    () =>
      getUploadFieldMessage({
        clipId,
        initialValues,
        uploadStatus,
        uploadedVideoFileName,
        uploadedVideoFileSizeLabel,
        t,
      }),
    [
      clipId,
      initialValues.sourceType,
      initialValues.uploadedVideoUrl,
      t,
      uploadStatus,
      uploadedVideoFileName,
      uploadedVideoFileSizeLabel,
    ],
  );
  const { uploadFieldHasError, uploadFieldErrorMessage } = getUploadErrorPresentation({
    hasVisibleServerUploadError,
    hasActiveUploadError,
    uploadClientError,
  });
  const thumbnailCropTitle = language === "he" ? "חיתוך תמונת תצוגה" : "Crop thumbnail";
  const thumbnailCropText =
    language === "he"
      ? "בחרו את האזור שישמש כתמונת התצוגה של הקליפ."
      : "Choose the area to use as the clip thumbnail.";
  const thumbnailZoomLabel = language === "he" ? "זום" : "Zoom";
  const thumbnailCropCancel = language === "he" ? "ביטול" : "Cancel";
  const thumbnailCropSave = language === "he" ? "שמור" : "Save";
  const canSaveThumbnailCrop = Boolean(thumbnailCroppedArea);

  useEffect(() => {
    return () => {
      uploadAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedVideoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedVideoPreviewUrl);
      }
    };
  }, [uploadedVideoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (uploadedThumbnailPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedThumbnailPreviewUrl);
      }
    };
  }, [uploadedThumbnailPreviewUrl]);

  useEffect(() => {
    if (!thumbnailCropSourceUrl) {
      return;
    }

    let isActive = true;
    void loadImage(thumbnailCropSourceUrl)
      .then((image) => {
        if (isActive) {
          setThumbnailLoadedImage(image);
        }
      })
      .catch(() => {
        if (isActive) {
          setThumbnailLoadedImage(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [thumbnailCropSourceUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailCropSourceUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailCropSourceUrl);
      }
    };
  }, [thumbnailCropSourceUrl]);

  useEffect(() => {
    if (!hasSavedUploadedVideo || uploadStatus === "uploading") {
      return;
    }

    if (uploadStatus !== "success") {
      setUploadStatus("success");
    }

    if (uploadClientError) {
      setUploadClientError(null);
    }
  }, [hasSavedUploadedVideo, uploadClientError, uploadStatus]);

  useEffect(() => {
    console.info("[clip-form] create-submit-state", {
      sourceType,
      uploadStatus,
      uploadedVideoUrl,
      hasSavedUploadedVideo,
      hasActiveUploadError,
      isCreateDisabled,
      createDisabledReasons,
    });
  }, [
    createDisabledReasons,
    hasActiveUploadError,
    hasSavedUploadedVideo,
    isCreateDisabled,
    sourceType,
    uploadStatus,
    uploadedVideoUrl,
  ]);

  function resetUploadedVideoSelection(nextUrl = initialValues.uploadedVideoUrl) {
    console.info("[clip-form] upload:reset", {
      nextUrl,
      hadPreview: !!uploadedVideoPreviewUrl,
      previousUploadStatus: uploadStatus,
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }

    uploadRequestIdRef.current += 1;
    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = null;
    setUploadStatus("idle");
    setUploadProgress(0);
    setUploadClientError(null);
    setUploadedVideoUrl(nextUrl);
    setUploadedVideoFileName(null);
    setUploadedVideoFileSizeLabel(null);
    setUploadedVideoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
  }

  function handleUploadedThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    thumbnailSourceFileRef.current = file;
    setUploadedThumbnailFileName(file?.name ?? null);
    setUploadedThumbnailPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    if (thumbnailCropSourceUrl) {
      URL.revokeObjectURL(thumbnailCropSourceUrl);
      setThumbnailCropSourceUrl(null);
    }
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setThumbnailCrop({ x: 0, y: 0 });
      setThumbnailZoom(MIN_ZOOM);
      setThumbnailCroppedArea(null);
      setThumbnailLoadedImage(null);
      setThumbnailCropSourceUrl(objectUrl);
    }
  }

  function closeThumbnailCropper(preserveSelection = false) {
    if (thumbnailCropSourceUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailCropSourceUrl);
    }
    setThumbnailCropSourceUrl(null);
    setThumbnailLoadedImage(null);
    setThumbnailCroppedArea(null);
    setThumbnailZoom(MIN_ZOOM);
    setThumbnailCrop({ x: 0, y: 0 });
    if (!preserveSelection) {
      thumbnailSourceFileRef.current = null;
      setUploadedThumbnailFileName(null);
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = "";
      }
    }
  }

  async function handleThumbnailCropSave() {
    if (!thumbnailCropSourceUrl || !thumbnailSourceFileRef.current || !thumbnailLoadedImage) {
      return;
    }
    const cropArea = thumbnailCroppedArea;
    if (!cropArea) {
      return;
    }

    const croppedFile = await createCroppedThumbnailFile(
      thumbnailSourceFileRef.current,
      cropArea,
      thumbnailLoadedImage,
    );
    const croppedPreviewUrl = URL.createObjectURL(croppedFile);
    thumbnailSourceFileRef.current = croppedFile;
    setUploadedThumbnailFileName(croppedFile.name);
    setUploadedThumbnailPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return croppedPreviewUrl;
    });

    if (thumbnailInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(croppedFile);
      thumbnailInputRef.current.files = dataTransfer.files;
    }

    closeThumbnailCropper(true);
  }

  async function uploadSelectedVideoFile(file: File) {
    console.info("[clip-form] upload:start", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || null,
    });
    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    uploadAbortControllerRef.current?.abort();
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadClientError(null);

    try {
      const tokenResponse = await fetch("/api/admin/clip-upload-token", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const tokenPayload = (await tokenResponse.json().catch(() => null)) as
        | { ok?: boolean; token?: string; uploadUrl?: string; error?: string }
        | null;

      console.info("[clip-form] upload:token-response", {
        requestId,
        status: tokenResponse.status,
        ok: tokenResponse.ok,
        payload: tokenPayload,
      });

      if (!tokenResponse.ok || !tokenPayload?.ok || !tokenPayload.token || !tokenPayload.uploadUrl) {
        setUploadStatus("error");
        setUploadClientError(t.errors["save-failed"]);
        return;
      }

      console.info("[clip-form] upload:using-origin", {
        requestId,
        uploadUrl: tokenPayload.uploadUrl,
      });

      const uploadUrl = tokenPayload.uploadUrl;
      if (!uploadUrl) {
        setUploadStatus("error");
        setUploadClientError(t.errors["save-failed"]);
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.set("videoFile", file);
      const response = await new Promise<{
        status: number;
        ok: boolean;
        payload: { ok?: boolean; videoUrl?: string; error?: string; message?: string } | null;
        aborted: boolean;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadAbortControllerRef.current = xhr;
        xhr.open("POST", uploadUrl, true);
        xhr.responseType = "json";
        xhr.setRequestHeader("Authorization", `Bearer ${tokenPayload.token}`);
        xhr.timeout = 10 * 60 * 1000;

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || requestId !== uploadRequestIdRef.current) {
            return;
          }
          const nextPercent = Math.max(
            0,
            Math.min(100, Math.round((event.loaded / event.total) * 100)),
          );
          setUploadProgress(nextPercent);
        };

        xhr.onload = () => {
          const payload =
            (xhr.response as { ok?: boolean; videoUrl?: string; error?: string; message?: string } | null) ??
            (() => {
              if (!xhr.responseText) {
                return null;
              }
              try {
                return JSON.parse(xhr.responseText) as {
                  ok?: boolean;
                  videoUrl?: string;
                  error?: string;
                  message?: string;
                };
              } catch {
                return null;
              }
            })();
          resolve({
            status: xhr.status,
            ok: xhr.status >= 200 && xhr.status < 300,
            payload,
            aborted: false,
          });
        };

        xhr.onerror = () => reject(new Error("upload-failed"));
        xhr.onabort = () => resolve({ status: 0, ok: false, payload: null, aborted: true });
        xhr.ontimeout = () => resolve({ status: 0, ok: false, payload: null, aborted: true });

        xhr.send(uploadFormData);
      });

      console.info("[clip-form] upload:response", {
        requestId,
        status: response.status,
        ok: response.ok,
        payload: response.payload,
      });

      if (requestId !== uploadRequestIdRef.current) {
        console.info("[clip-form] upload:stale-response-ignored", {
          requestId,
          currentRequestId: uploadRequestIdRef.current,
        });
        return;
      }

      if (response.aborted) {
        setUploadStatus("error");
        setUploadClientError(t.uploadTimedOut);
        return;
      }

      if (!response.ok || !response.payload?.ok || !response.payload.videoUrl) {
        console.error("[clip-upload] failed", {
          status: response.status,
          error: response.payload?.error ?? "unknown-error",
          message: response.payload?.message ?? null,
        });
        setUploadStatus("error");
        setUploadClientError(
          (response.payload?.error && t.errors[response.payload.error as keyof typeof t.errors]) ||
            t.errors["save-failed"],
        );
        return;
      }

      const nextVideoUrl = response.payload.videoUrl;
      console.info("[clip-form] upload:success", {
        requestId,
        nextVideoUrl,
      });
      setUploadProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (requestId !== uploadRequestIdRef.current) {
        return;
      }
      setUploadedVideoUrl(nextVideoUrl);
      setUploadClientError(null);
      setUploadedVideoPreviewUrl((current) => {
        if (current?.startsWith("blob:")) {
          return current;
        }

        return nextVideoUrl;
      });
      setUploadStatus("success");
    } catch {
      if (requestId === uploadRequestIdRef.current) {
        console.error("[clip-form] upload:error", {
          requestId,
          reason: "request-failed",
        });
        setUploadStatus("error");
        setUploadClientError(t.errors["save-failed"]);
      }
    } finally {
      if (requestId === uploadRequestIdRef.current) {
        console.info("[clip-form] upload:finally", {
          requestId,
          uploadStatusAfterRequest: uploadAbortControllerRef.current === null ? "aborted" : "completed-or-failed",
          hasSavedUploadedVideoPath: !!uploadedVideoUrl,
        });
        uploadAbortControllerRef.current = null;
      }
    }
  }

  function handleUploadedVideoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    console.info("[clip-form] upload:file-selected", {
      hasFile: !!file,
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
      fileType: file?.type ?? null,
    });

    if (file && file.size > MAX_CLIP_VIDEO_FILE_SIZE_BYTES) {
      console.warn("[clip-form] upload:file-too-large", {
        fileName: file.name,
        fileSize: file.size,
        maxBytes: MAX_CLIP_VIDEO_FILE_SIZE_BYTES,
      });
      setUploadStatus("error");
      setUploadProgress(0);
      setUploadClientError(t.errors["upload-file-too-large"]);
      setUploadedVideoUrl("");
      setUploadedVideoFileName(file.name);
      setUploadedVideoFileSizeLabel(
        `${(file.size / (1024 * 1024)).toFixed(file.size >= 10 * 1024 * 1024 ? 0 : 1)} MB`,
      );
      setUploadedVideoPreviewUrl((current) => {
        if (current?.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      return;
    }

    setUploadClientError(null);
    setUploadStatus(file ? "uploading" : "idle");
    setUploadProgress(0);
    setUploadedVideoUrl("");
    setUploadedVideoFileName(file?.name ?? null);
    setUploadedVideoFileSizeLabel(
      file ? `${(file.size / (1024 * 1024)).toFixed(file.size >= 10 * 1024 * 1024 ? 0 : 1)} MB` : null,
    );
    setUploadedVideoPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return file ? URL.createObjectURL(file) : null;
    });

    if (file) {
      void uploadSelectedVideoFile(file);
    } else {
      resetUploadedVideoSelection();
    }
  }

  function clearUploadedVideoFile() {
    console.info("[clip-form] upload:clear-clicked");
    resetUploadedVideoSelection();
  }

  function retryUploadedVideoFile() {
    const file = uploadInputRef.current?.files?.[0];
    if (!file) {
      return;
    }
    setUploadProgress(0);
    setUploadStatus("uploading");
    setUploadClientError(null);
    void uploadSelectedVideoFile(file);
  }

  const hasRetryUpload =
    uploadStatus === "error" && !!uploadInputRef.current?.files?.[0];

  return (
    <form
      action={action}
      encType="multipart/form-data"
      onSubmit={() => {
        console.info("[clip-form] submit", {
          sourceType,
          uploadStatus,
          uploadedVideoUrl,
          hasSavedUploadedVideo,
          hasActiveUploadError,
          isCreateDisabled,
          createDisabledReasons,
        });
      }}
      className="form-grid content-editor-form"
      dir={language === "he" ? "rtl" : "ltr"}
      style={{
        marginTop: 24,
        maxWidth: 760,
        marginInline: "auto",
        gap: 28,
      }}
    >
      <input type="hidden" name="musicalId" value={musical.id} />
      <input type="hidden" name="currentSlug" value={musical.slug} />
      {clipId ? <input type="hidden" name="clipId" value={clipId} /> : null}

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.basicTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {resolvedDescriptionText}
          </p>
        </div>

        <div className="content-editor-grid content-editor-grid-compact">
          <div className="field">
            <label className="field-label" htmlFor="clip-title">
              {t.titleLabel}
            </label>
            <input
              id="clip-title"
              name="title"
              className="input"
              defaultValue={initialValues.title}
              placeholder={t.titlePlaceholder}
              required
              {...getFieldErrorStyles(titleError)}
            />
          </div>
        </div>
      </section>

      <section className="card content-editor-section" style={{ padding: 24 }}>
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.mediaTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.mediaText}
          </p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="clip-source-type-youtube">
            {t.sourceLabel}
          </label>
          <input type="hidden" name="sourceType" value={sourceType} />
          <div className="source-toggle-group" role="radiogroup" aria-label={t.sourceLabel}>
            <button
              id="clip-source-type-youtube"
              type="button"
              role="radio"
              aria-checked={sourceType === "youtube"}
              className={`source-toggle-button ${sourceType === "youtube" ? "is-active" : ""}`}
              onClick={() => setSourceType("youtube")}
            >
              {t.sourceYoutube}
            </button>
            <button
              id="clip-source-type-upload"
              type="button"
              role="radio"
              aria-checked={sourceType === "upload"}
              className={`source-toggle-button ${sourceType === "upload" ? "is-active" : ""}`}
              onClick={() => setSourceType("upload")}
            >
              {t.sourceUpload}
            </button>
          </div>
        </div>

        {sourceType === "youtube" ? (
          <div className="field">
            <label className="field-label" htmlFor="clip-youtube-video-id">
              {t.youtubeLabel}
            </label>
            <input
              id="clip-youtube-video-id"
              name="youtubeVideoId"
              className="input"
              value={youtubeVideoId}
              onChange={(event) => setYouTubeVideoId(event.currentTarget.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              dir="ltr"
              style={{ textAlign: "left" }}
              required={sourceType === "youtube"}
              {...getFieldErrorStyles(youtubeError || youtubeFormatError)}
            />
            <div className="show-meta" style={{ marginTop: 0 }}>
              {t.youtubeHint}
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="clip-uploaded-video-file">
                {t.uploadFileLabel}
              </label>
            <div
              className={`media-upload-field ${
                uploadFieldHasError ? "has-error" : ""
              }`}
            >
              <input
                ref={uploadInputRef}
                id="clip-uploaded-video-file"
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v"
                className="media-upload-native-input"
                onChange={handleUploadedVideoFileChange}
                disabled={uploadStatus === "uploading"}
                {...getFieldErrorStyles(uploadFieldHasError)}
              />
              <div className="media-upload-shell">
                <div className="media-upload-copy">
                  <strong>{t.uploadFileCta}</strong>
                  <span>{uploadFieldMessage}</span>
                </div>
                <div className="media-upload-actions">
                  <label
                    htmlFor="clip-uploaded-video-file"
                    className="button-secondary button-small media-upload-button"
                    aria-disabled={uploadStatus === "uploading"}
                    style={uploadStatus === "uploading" ? { opacity: 0.6 } : undefined}
                  >
                    {uploadedVideoFileName ? t.replaceUploadFile : t.chooseUploadFile}
                  </label>
                  {uploadedVideoFileName ? (
                    <button
                      type="button"
                      className="button-secondary button-small"
                      onClick={clearUploadedVideoFile}
                    >
                      {t.clearUploadFile}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="show-meta" style={{ marginTop: 0 }}>
              {t.uploadFileHint}
            </div>
            {uploadStatus === "uploading" ? (
              <div className="form-message">
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  {t.uploadingFile}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 6,
                    borderRadius: 999,
                    background: "rgba(148, 163, 184, 0.3)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: "100%",
                      background: "rgba(34, 197, 94, 0.75)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
                <span>{uploadProgress}%</span>
              </div>
            ) : null}
            {uploadStatus === "success" ? (
              <div className="form-message success">{t.uploadSaved}</div>
            ) : null}
            {uploadFieldErrorMessage ? (
              <div className="field-error-text">{uploadFieldErrorMessage}</div>
            ) : null}
            {hasRetryUpload ? (
              <button
                type="button"
                className="button-secondary button-small"
                onClick={retryUploadedVideoFile}
              >
                {t.retryUpload}
              </button>
            ) : null}
            </div>

            <div className="field">
            <label className="field-label" htmlFor="clip-uploaded-thumbnail-file">
              {t.thumbnailLabel}
            </label>
            <div className="image-upload-field">
              <label className="image-upload-trigger" htmlFor="clip-uploaded-thumbnail-file">
                <strong>{t.thumbnailCta}</strong>
                <span className="image-upload-trigger-meta">
                  {uploadedThumbnailFileName || t.thumbnailHint}
                </span>
              </label>
              <input
                id="clip-uploaded-thumbnail-file"
                name="uploadedThumbnailFile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="image-upload-input"
                ref={thumbnailInputRef}
                onChange={handleUploadedThumbnailChange}
              />
            </div>
            {(uploadedThumbnailPreviewUrl || initialValues.uploadedThumbnailUrl) ? (
              <div className="image-upload-preview-wrap">
                <div className="image-upload-preview-frame" data-mode="crop">
                  <img
                    src={uploadedThumbnailPreviewUrl ?? initialValues.uploadedThumbnailUrl}
                    alt=""
                    aria-hidden="true"
                    className="image-upload-preview-image"
                  />
                </div>
              </div>
            ) : null}
            {thumbnailCropSourceUrl && thumbnailLoadedImage ? (
              <div className="crop-modal-overlay" onClick={() => closeThumbnailCropper(false)}>
                <div
                  className="card crop-modal-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="clip-thumbnail-crop-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="crop-modal-header">
                    <h2 id="clip-thumbnail-crop-title" className="panel-title">
                      {thumbnailCropTitle}
                    </h2>
                    <p className="show-meta" style={{ marginTop: 6 }}>
                      {thumbnailCropText}
                    </p>
                  </div>

                  <div className="crop-modal-stage">
                    <div className="cropper-frame cropper-frame-preset" style={{ aspectRatio: "16 / 9" }}>
                      <Cropper
                        image={thumbnailCropSourceUrl}
                        crop={thumbnailCrop}
                        zoom={thumbnailZoom}
                        aspect={THUMBNAIL_ASPECT}
                        cropShape="rect"
                        objectFit="cover"
                        onCropChange={setThumbnailCrop}
                        onCropComplete={(_, areaPixels) => setThumbnailCroppedArea(areaPixels)}
                      />
                    </div>
                  </div>

                  <div className="crop-modal-controls">
                    <div className="cropper-toolbar-card">
                      <label className="cropper-zoom-row" htmlFor="clip-thumbnail-zoom">
                        <span className="cropper-zoom-label">{thumbnailZoomLabel}</span>
                        <input
                          id="clip-thumbnail-zoom"
                          type="range"
                          min={MIN_ZOOM}
                          max={MAX_ZOOM}
                          step={0.05}
                          value={thumbnailZoom}
                          onChange={(event) => setThumbnailZoom(Number(event.target.value))}
                          className="cropper-zoom"
                        />
                        <span className="cropper-zoom-value">{thumbnailZoom.toFixed(2)}x</span>
                      </label>
                    </div>
                  </div>

                  <div className="button-row crop-modal-actions">
                    <button type="button" className="button-secondary" onClick={() => closeThumbnailCropper(false)}>
                      {thumbnailCropCancel}
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={handleThumbnailCropSave}
                      disabled={!canSaveThumbnailCrop}
                    >
                      {thumbnailCropSave}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          </>
        )}

        {sourceType === "upload" ? <input type="hidden" name="uploadedVideoUrl" value={uploadedVideoUrl} /> : null}

        <ClipPreviewTimingEditor
          language={language}
          sourceType={sourceType}
          youtubeVideoId={youtubeVideoId}
          uploadedVideoUrl={resolvedUploadedVideoPreviewUrl}
          uploadedThumbnailUrl={uploadedThumbnailPreviewUrl ?? initialValues.uploadedThumbnailUrl ?? null}
          initialStartTime={initialValues.startTime}
          initialEndTime={initialValues.endTime}
          sourcePreviewLabel={sourcePreviewLabel}
          sourcePreviewNote={sourcePreviewNote}
        />
      </section>

      <section className="card content-editor-section" style={{ padding: 24 }}>
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.descriptionTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.descriptionText}
          </p>
        </div>

        <MusicalDescriptionEditor
          language={language}
          inputId="clip-description"
          name="description"
          label={t.descriptionLabel}
          initialValue={initialValues.description}
          placeholder={t.descriptionPlaceholder}
        />

        {visibleServerErrorMessage ? (
          <div
            id="clip-form-error"
            style={{ color: "#ffb3b3", fontSize: 13, paddingInline: 4 }}
          >
            {visibleServerErrorMessage}
          </div>
        ) : null}
      </section>

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.saveTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.saveText}
          </p>
        </div>

        <div className="button-row content-editor-actions" style={{ marginTop: 0 }}>
          {cancelHref ? (
            <Link href={cancelHref} className="button-secondary">
              {resolvedCancelLabel}
            </Link>
          ) : null}
          <NewMusicalSubmitButton
            idleLabel={resolvedSubmitLabel}
            pendingLabel={resolvedPendingLabel}
            formEncType="multipart/form-data"
            disabled={isCreateDisabled}
          />
        </div>
      </section>
    </form>
  );
}
