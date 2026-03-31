"use client";

import {
  ChangeEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import UserAvatar from "@/components/UserAvatar";
import { buildAvatarUrl } from "@/lib/avatar";
import { type AppLanguage } from "@/lib/i18n";

const CROPPER_FRAME_SIZE = 280;
const CROPPED_OUTPUT_SIZE = 800;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type CropState = {
  zoom: number;
};

type LoadedImage = {
  width: number;
  height: number;
  element: HTMLImageElement;
};

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UserAvatarUploadFieldProps = {
  inputId: string;
  label: string;
  currentAvatarUrl?: string | null;
  currentAvatarVersion?: string | number | null;
  previewName: string;
  section?: "profile" | "security";
  language?: AppLanguage;
};

function getClamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function loadImage(sourceUrl: string) {
  return new Promise<LoadedImage>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        element: image,
      });
    image.onerror = () => reject(new Error("Failed to load avatar image"));
    image.src = sourceUrl;
  });
}

async function createCroppedFile(
  sourceFile: File,
  cropArea: CropArea,
  image: LoadedImage,
) {
  const canvas = document.createElement("canvas");
  canvas.width = CROPPED_OUTPUT_SIZE;
  canvas.height = CROPPED_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available");
  }

  context.fillStyle = "#08101f";
  context.fillRect(0, 0, CROPPED_OUTPUT_SIZE, CROPPED_OUTPUT_SIZE);
  context.drawImage(
    image.element,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    CROPPED_OUTPUT_SIZE,
    CROPPED_OUTPUT_SIZE,
  );

  const mimeType = "image/jpeg";
  const extension = "jpg";

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, 0.92);
  });

  if (!blob) {
    throw new Error("Failed to create avatar image");
  }

  const originalName = sourceFile.name.replace(/\.[^.]+$/, "");

  return new File([blob], `${originalName}-avatar.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

const getAvatarPreviewState = ({
  croppedPreviewUrl,
  selectedFileUrl,
  savedAvatarUrl,
  savedAvatarVersion,
  zoom,
}: {
  croppedPreviewUrl: string | null;
  selectedFileUrl: string | null;
  savedAvatarUrl: string | null;
  savedAvatarVersion: string | number | null;
  zoom: number;
}) => {
  const previewImagePath =
    croppedPreviewUrl ||
    selectedFileUrl ||
    buildAvatarUrl(savedAvatarUrl, savedAvatarVersion) ||
    null;
  const zoomPercentage = Math.round((zoom / MIN_ZOOM) * 100);

  return {
    previewImagePath,
    zoomPercentage,
  };
};

export default function UserAvatarUploadField({
  inputId,
  label,
  currentAvatarUrl,
  currentAvatarVersion,
  previewName,
  section = "profile",
  language = "he",
}: UserAvatarUploadFieldProps) {
  const copy =
    language === "he"
      ? {
          openFailed: "התמונה לא נפתחה לעריכה. אפשר לנסות קובץ אחר.",
          missingImage: "חסרה תמונה לשמירה. אפשר לבחור תמונה מחדש ולנסות שוב.",
          saveFailed: "החיתוך לא נשמר. אפשר לנסות שוב או לבחור תמונה אחרת.",
          invalidType: "אפשר להעלות רק קבצי JPG, PNG או WEBP.",
          imageTooLarge: "גודל התמונה חייב להיות עד 3MB.",
          uploadingAvatar: "מעלה תמונת פרופיל...",
          retryUpload: "נסו שוב להעלות",
          uploadTitle: "העלה או עדכן תמונת פרופיל",
          uploadText: "יחס 1:1, חיתוך עגול בתצוגה, עם זום וגרירה לפני שמירה.",
          uploadMeta: "JPG, PNG או WEBP עד 3MB",
          helper:
            "לחיצה על התמונה פותחת את ממשק החיתוך. אפשר לבחור אזור, לבצע זום ולראות תצוגה מקדימה מיידית.",
          cropTitle: "חיתוך תמונת פרופיל",
          cropText: "בחר את האזור שיישמר כתמונת פרופיל ביחס קבוע של 1:1.",
          cropAlt: "תצוגת חיתוך לתמונת פרופיל",
          zoom: "זום",
          cropHelper:
            "גלול כדי לבצע זום וגרור כדי למקם את התמונה. גם ב-100% אפשר עדיין להזיז אותה בתוך המסגרת.",
          cancel: "ביטול",
          saving: "שומר תמונה...",
          save: "שמור תמונה",
        }
      : {
          openFailed: "The image could not be opened for editing. Please try another file.",
          missingImage: "No image is available to save. Please choose an image again and try once more.",
          saveFailed: "The cropped image was not saved. Please try again or choose a different image.",
          invalidType: "Only JPG, PNG, or WEBP files can be uploaded.",
          imageTooLarge: "The image size must be up to 3MB.",
          uploadingAvatar: "Uploading profile image...",
          retryUpload: "Retry upload",
          uploadTitle: "Upload or update profile image",
          uploadText: "1:1 ratio, circular display crop, with zoom and drag before saving.",
          uploadMeta: "JPG, PNG, or WEBP up to 3MB",
          helper:
            "Clicking the image opens the crop tool. You can choose the area, zoom in, and preview the result right away.",
          cropTitle: "Crop profile image",
          cropText: "Choose the area that will be saved as the profile image in a fixed 1:1 ratio.",
          cropAlt: "Crop preview for the profile image",
          zoom: "Zoom",
          cropHelper:
            "Scroll to zoom and drag to position the image. Even at 100%, you can still move it within the frame.",
          cancel: "Cancel",
          saving: "Saving image...",
          save: "Save image",
        };

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(currentAvatarUrl ?? null);
  const [savedAvatarVersion, setSavedAvatarVersion] = useState<string | number | null>(
    currentAvatarVersion ?? null,
  );
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const uploadRequestIdRef = useRef(0);
  const uploadAbortRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      if (selectedFileUrl) {
        URL.revokeObjectURL(selectedFileUrl);
      }

      if (croppedPreviewUrl) {
        URL.revokeObjectURL(croppedPreviewUrl);
      }

      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl, croppedPreviewUrl, selectedFileUrl]);

  useEffect(() => {
    if (!cropSourceUrl) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCropper();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [cropSourceUrl]);

  function resetInputFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function clearSelectedMedia() {
    setDragging(false);
    setSelectedFileUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setCroppedPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    resetInputFile();
  }

  function retryAvatarUpload() {
    if (!sourceFile || !loadedImage || isSaving) {
      return;
    }
    setUploadProgress(0);
    setUploadStatus("uploading");
    setClientError(null);
    void handleCropSave();
  }

  function openCropper(file: File, fileUrl: string) {
    setClientError(null);
    setDragging(false);
    loadImage(fileUrl)
      .then((image) => {
        setLoadedImage(image);
        setCrop({ x: 0, y: 0 });
        setZoom(MIN_ZOOM);
        setCroppedAreaPixels(null);
        setSourceFile(file);
        setCropSourceUrl(fileUrl);
      })
      .catch(() => {
        setClientError(copy.openFailed);
        clearSelectedMedia();
      });
  }

  function closeCropper() {
    if (isSaving) {
      return;
    }

    setCropSourceUrl(null);
    setSourceFile(null);
    setLoadedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setCroppedAreaPixels(null);
    setDragging(false);

    if (!croppedPreviewUrl) {
      clearSelectedMedia();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    setClientError(null);
    const objectUrl = URL.createObjectURL(file);

    setDragging(false);
    setSelectedFileUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return objectUrl;
    });
    setCroppedPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });

    openCropper(file, objectUrl);
  }

  function handleZoomChange(value: number) {
    const nextZoom = getClamp(value, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? 0.14 : -0.14;
    handleZoomChange(zoom + zoomDelta);
  }

  async function handleCropSave() {
    if (!cropSourceUrl || !sourceFile || !loadedImage || !croppedAreaPixels) {
      setClientError(copy.missingImage);
      return;
    }

    try {
      setIsSaving(true);
      setUploadStatus("uploading");
      setUploadProgress(0);
      setClientError(null);
      const requestId = uploadRequestIdRef.current + 1;
      uploadRequestIdRef.current = requestId;
      const croppedFile = await createCroppedFile(sourceFile, croppedAreaPixels, loadedImage);
      const croppedPreview = URL.createObjectURL(croppedFile);
      const uploadFormData = new FormData();
      uploadFormData.set("avatarFile", croppedFile);
      const response = await new Promise<{
        status: number;
        ok: boolean;
        payload: { ok?: boolean; avatarUrl?: string; avatarVersion?: string; error?: string; message?: string } | null;
        aborted: boolean;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadAbortRef.current = xhr;
        xhr.open("POST", "/api/profile/avatar", true);
        xhr.responseType = "json";
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
            (xhr.response as {
              ok?: boolean;
              avatarUrl?: string;
              avatarVersion?: string;
              error?: string;
              message?: string;
            } | null) ??
            (() => {
              if (!xhr.responseText) {
                return null;
              }
              try {
                return JSON.parse(xhr.responseText) as {
                  ok?: boolean;
                  avatarUrl?: string;
                  avatarVersion?: string;
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

      if (requestId !== uploadRequestIdRef.current) {
        return;
      }

      if (response.aborted) {
        throw new Error(copy.saveFailed);
      }

      if (!response.ok || !response.payload?.ok || !response.payload.avatarUrl) {
        if (response.payload?.error === "invalid-image-type") {
          throw new Error(copy.invalidType);
        }

        if (response.payload?.error === "image-too-large") {
          throw new Error(copy.imageTooLarge);
        }

        throw new Error(copy.saveFailed);
      }

      setUploadProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (requestId !== uploadRequestIdRef.current) {
        return;
      }

      setCroppedPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return croppedPreview;
      });
      setSavedAvatarUrl(response.payload.avatarUrl);
      setSavedAvatarVersion(response.payload.avatarVersion ?? Date.now());
      setCropSourceUrl(null);
      setSourceFile(null);
      setLoadedImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(MIN_ZOOM);
      setCroppedAreaPixels(null);
      setDragging(false);
      resetInputFile();
      setUploadStatus("success");
      setIsSaving(false);
      router.replace(`/profile?section=${section}&success=avatar-updated`, { scroll: false });
      router.refresh();
    } catch (error) {
      console.error("[profile][avatar-crop] save failed", {
        reason: error instanceof Error ? error.message : "unknown-error",
      });
      setUploadStatus("error");
      setIsSaving(false);
      setClientError(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      uploadAbortRef.current = null;
    }
  }

  const { previewImagePath, zoomPercentage } = getAvatarPreviewState({
    croppedPreviewUrl,
    selectedFileUrl,
    savedAvatarUrl,
    savedAvatarVersion,
    zoom,
  });

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>

      <div className="image-upload-field avatar-upload-field">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="image-upload-input"
          onChange={handleChange}
          disabled={uploadStatus === "uploading"}
        />

        <label
          className="avatar-upload-trigger"
          htmlFor={inputId}
          style={uploadStatus === "uploading" ? { opacity: 0.6, pointerEvents: "none" } : undefined}
          aria-disabled={uploadStatus === "uploading"}
        >
          <div className="avatar-upload-preview">
            <UserAvatar
              name={previewName}
              avatarUrl={previewImagePath}
              size="xl"
              className="avatar-upload-preview-image"
            />
          </div>
          <div className="avatar-upload-copy">
            <strong>{copy.uploadTitle}</strong>
            <span>{copy.uploadText}</span>
            <span className="image-upload-trigger-meta">{copy.uploadMeta}</span>
          </div>
        </label>

        <div className="show-meta" style={{ marginTop: 0 }}>
          {copy.helper}
        </div>

        {!cropSourceUrl && clientError ? <div className="form-message error">{clientError}</div> : null}
      </div>

      {mounted && cropSourceUrl && loadedImage
        ? createPortal(
            <div className="crop-modal-overlay" onClick={closeCropper}>
              <div
                className="card crop-modal-card avatar-crop-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${inputId}-crop-title`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="crop-modal-header">
                  <div>
                    <h2 id={`${inputId}-crop-title`} className="panel-title">
                      {copy.cropTitle}
                    </h2>
                    <p className="show-meta" style={{ marginTop: 0 }}>
                      {copy.cropText}
                    </p>
                  </div>
                </div>

                <div className="crop-modal-stage">
                  <div
                    className={`cropper-frame avatar-cropper-frame ${dragging ? "is-dragging" : ""}`}
                    onWheel={handleWheel}
                  >
                    <Cropper
                      image={cropSourceUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                      onInteractionStart={() => setDragging(true)}
                      onInteractionEnd={() => setDragging(false)}
                      objectFit="cover"
                    />
                  </div>
                </div>

                <div className="crop-modal-controls">
                  {clientError ? <div className="form-message error">{clientError}</div> : null}
                  {uploadStatus === "uploading" ? (
                    <div className="form-message">
                      <div style={{ fontSize: 12, marginBottom: 6 }}>
                        {copy.uploadingAvatar}
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
                  <div className="cropper-toolbar-card">
                    <label className="cropper-zoom-row" htmlFor={`${inputId}-zoom`}>
                      <span className="cropper-zoom-label">{copy.zoom}</span>
                      <input
                        id={`${inputId}-zoom`}
                        type="range"
                        min={String(MIN_ZOOM)}
                        max={String(MAX_ZOOM)}
                        step="0.01"
                        value={zoom}
                        className="cropper-zoom"
                        onChange={(event) => handleZoomChange(Number(event.currentTarget.value))}
                      />
                      <span className="cropper-zoom-value">
                        {zoomPercentage}%
                      </span>
                    </label>
                  </div>
                  <div className="crop-modal-helper">
                    {copy.cropHelper}
                  </div>
                </div>

                <div className="button-row" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={closeCropper}
                    disabled={isSaving}
                  >
                    {copy.cancel}
                  </button>
                  {uploadStatus === "error" ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={retryAvatarUpload}
                      disabled={isSaving}
                    >
                      {copy.retryUpload}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleCropSave}
                    disabled={isSaving}
                  >
                    {isSaving ? copy.saving : copy.save}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
