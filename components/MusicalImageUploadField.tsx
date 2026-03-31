"use client";

import {
  ChangeEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import MusicalArtwork from "@/components/MusicalArtwork";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

const CROPPED_OUTPUT_WIDTH = 1000;
const CROPPED_OUTPUT_HEIGHT = 1500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type CropPreset = "square" | "wide" | "tall";

type LoadedImage = {
  element: HTMLImageElement;
};

type MusicalImageUploadFieldProps = {
  language?: AppLanguage;
  inputId: string;
  name: string;
  label: string;
  currentImagePath?: string | null;
  currentThumbnailUrl?: string | null;
  currentPosterAspect?: CropPreset;
  previewAlt: string;
  allowRemoval?: boolean;
  onFileChange?: (file: File | null) => void;
};

function getClamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CROP_PRESETS: Record<
  CropPreset,
  { label: string; aspect: number; outputWidth: number; outputHeight: number }
> = {
  square: { label: "1:1", aspect: 1, outputWidth: 1200, outputHeight: 1200 },
  wide: { label: "16:9", aspect: 16 / 9, outputWidth: 1600, outputHeight: 900 },
  tall: {
    label: "2:3",
    aspect: 2 / 3,
    outputWidth: CROPPED_OUTPUT_WIDTH,
    outputHeight: CROPPED_OUTPUT_HEIGHT,
  },
};

async function loadImage(sourceUrl: string) {
  return new Promise<LoadedImage>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({
        element: image,
      });
    image.onerror = () => reject(new Error("Failed to load image for cropping"));
    image.src = sourceUrl;
  });
}

async function createCroppedFile(
  sourceFile: File,
  cropArea: CropArea,
  cropPreset: CropPreset,
  imageElement: HTMLImageElement,
) {
  const preset = CROP_PRESETS[cropPreset];
  const canvas = document.createElement("canvas");
  canvas.width = preset.outputWidth;
  canvas.height = preset.outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available");
  }

  context.fillStyle = "#08101f";
  context.fillRect(0, 0, preset.outputWidth, preset.outputHeight);
  context.drawImage(
    imageElement,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    preset.outputWidth,
    preset.outputHeight,
  );

  const mimeType =
    sourceFile.type === "image/png" || sourceFile.type === "image/webp"
      ? sourceFile.type
      : "image/jpeg";
  const extension =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, 0.92);
  });

  if (!blob) {
    throw new Error("Failed to create cropped image");
  }

  const originalName = sourceFile.name.replace(/\.[^.]+$/, "");

  return new File([blob], `${originalName}-cropped.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

const getImageUploadDerivedState = ({
  currentImagePath,
  currentThumbnailUrl,
  removeExistingImage,
  selectedFileUrl,
  croppedPreviewUrl,
  copy,
}: {
  currentImagePath?: string | null;
  currentThumbnailUrl?: string | null;
  removeExistingImage: boolean;
  selectedFileUrl: string | null;
  croppedPreviewUrl: string | null;
  copy: ReturnType<typeof getTranslations>["contentEditor"]["imageUpload"];
}) => {
  const currentImage = currentImagePath || currentThumbnailUrl || null;
  const savedImage = removeExistingImage ? null : currentImage;
  const hasUserSelectedImage = !!selectedFileUrl;
  const previewImagePath = hasUserSelectedImage
    ? croppedPreviewUrl || selectedFileUrl
    : null;
  const previewMode = "crop" as const;
  const hasSavedImage = !!savedImage;
  const showPreviewArea = hasSavedImage || hasUserSelectedImage || removeExistingImage;
  const savedImageHint = hasSavedImage ? copy.savedImageHint : copy.noSavedImageHint;
  const previewMetaText = hasUserSelectedImage && hasSavedImage
    ? copy.draftVsSaved
    : hasUserSelectedImage
      ? copy.livePreviewCrop
      : removeExistingImage
        ? copy.removalPending
        : copy.currentDisplay;

  return {
    currentImage,
    savedImage,
    hasUserSelectedImage,
    previewImagePath,
    previewMode,
    hasSavedImage,
    showPreviewArea,
    savedImageHint,
    previewMetaText,
  };
};

export default function MusicalImageUploadField({
  language = "he",
  inputId,
  name,
  label,
  currentImagePath,
  currentThumbnailUrl,
  currentPosterAspect,
  previewAlt,
  allowRemoval = true,
  onFileChange,
}: MusicalImageUploadFieldProps) {
  const copy = getTranslations(language).contentEditor.imageUpload;
  const savedBadge = language === "he" ? "נוכחי" : "Current";
  const draftBadge = language === "he" ? "טיוטה" : "Draft";
  const draftNote = language === "he" ? "לא נשמר עדיין" : "Not saved yet";
  const replaceImageLabel = language === "he" ? "החלף תמונה" : "Replace image";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const posterDisplayMode = "crop" as const;
  const defaultPreset = currentPosterAspect ?? "square";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [cropPreset, setCropPreset] = useState<CropPreset>(defaultPreset);
  const [dragging, setDragging] = useState(false);
  const lastCroppedAreaRef = useRef<CropArea | null>(null);
  const hasInitializedCropRef = useRef(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const {
    savedImage,
    hasUserSelectedImage,
    previewImagePath,
    previewMode,
    hasSavedImage,
    showPreviewArea,
    savedImageHint,
    previewMetaText,
  } = getImageUploadDerivedState({
    currentImagePath,
    currentThumbnailUrl,
    removeExistingImage,
    selectedFileUrl,
    croppedPreviewUrl,
    copy,
  });
  const canSaveCrop = Boolean(croppedAreaPixels ?? lastCroppedAreaRef.current);
  const posterAspectValue = hasUserSelectedImage ? cropPreset : currentPosterAspect ?? defaultPreset;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
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

  function clearSelectedMedia(resetRemoval = false) {
    setSelectedFile(null);
    onFileChange?.(null);
    setDragging(false);
    if (resetRemoval) {
      setRemoveExistingImage(false);
    }
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

  function openCropper(file: File, fileUrl: string) {
    setClientError(null);
    setDragging(false);
    hasInitializedCropRef.current = false;
    loadImage(fileUrl)
      .then((image) => {
        setLoadedImage(image);
        setCrop({ x: 0, y: 0 });
        setZoom(MIN_ZOOM);
        setCroppedAreaPixels(null);
        setCropPreset(defaultPreset);
        setSourceFile(file);
        setCropSourceUrl(fileUrl);
      })
      .catch(() => {
        setClientError(copy.openFailed);
        clearSelectedMedia();
      });
  }

  function closeCropper() {
    setCropSourceUrl(null);
    setSourceFile(null);
    setLoadedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setCroppedAreaPixels(null);
    setCropPreset(defaultPreset);
    setDragging(false);
    hasInitializedCropRef.current = false;

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
    setRemoveExistingImage(false);
    const objectUrl = URL.createObjectURL(file);

    applySelectedFile(file, objectUrl, null, true);
  }

  function handleRemoveCurrentImage() {
    setClientError(null);
    clearSelectedMedia();
    setRemoveExistingImage(true);
    onFileChange?.(null);
  }

  function handleRestoreCurrentImage() {
    setClientError(null);
    setRemoveExistingImage(false);
  }

  function applySelectedFile(
    file: File,
    previewUrl: string,
    nextCroppedPreviewUrl: string | null,
    openCropperNext: boolean,
  ) {
    setClientError(null);
    setRemoveExistingImage(false);
    setDragging(false);
    setSelectedFile(file);
    onFileChange?.(file);
    setSelectedFileUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });
    setCroppedPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return nextCroppedPreviewUrl;
    });

    if (openCropperNext) {
      openCropper(file, previewUrl);
    }
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

  function handleReplaceImage() {
    inputRef.current?.click();
  }

  async function handleCropSave() {
    if (!cropSourceUrl || !sourceFile || !loadedImage || !inputRef.current) {
      console.error("[MusicalImageUpload] Missing crop prerequisites", {
        cropSourceUrl,
        sourceFile,
        loadedImage,
        hasInput: Boolean(inputRef.current),
        croppedAreaPixels,
        lastCroppedArea: lastCroppedAreaRef.current,
      });
      return;
    }

    try {
      setClientError(null);

      const resolvedCropArea = croppedAreaPixels ?? lastCroppedAreaRef.current;

      if (!resolvedCropArea) {
        console.error("[MusicalImageUpload] Missing crop area on save", {
          croppedAreaPixels,
          lastCroppedArea: lastCroppedAreaRef.current,
          cropPreset,
          crop,
          zoom,
        });
        setClientError(copy.saveFailed);
        return;
      }

      const croppedFile = await createCroppedFile(
        sourceFile,
        resolvedCropArea,
        cropPreset,
        loadedImage.element,
      );
      console.log("[MusicalImageUpload] Cropped file created", {
        name: croppedFile.name,
        size: croppedFile.size,
        type: croppedFile.type,
      });
      const croppedPreview = URL.createObjectURL(croppedFile);
      applySelectedFile(croppedFile, croppedPreview, croppedPreview, false);
      setCropSourceUrl(null);
      setSourceFile(null);
      setLoadedImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(MIN_ZOOM);
      setCroppedAreaPixels(null);
      setDragging(false);
    } catch (error) {
      console.error("[MusicalImageUpload] Crop save failed", error);
      setClientError(copy.saveFailed);
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>

      <div className="image-upload-field">
        <label className="image-upload-trigger" htmlFor={inputId}>
          <span>{copy.chooseImage}</span>
          <span className="image-upload-trigger-meta">{copy.meta}</span>
        </label>

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="image-upload-input"
          onChange={handleChange}
        />
        <input type="hidden" name="posterDisplayMode" value={posterDisplayMode} />
        <input type="hidden" name="posterAspect" value={posterAspectValue} />
        <input type="hidden" name="removeImage" value={removeExistingImage ? "1" : ""} />

        <div className="show-meta" style={{ marginTop: 0 }}>
          {savedImageHint}
        </div>

        {clientError ? <div className="form-message error">{clientError}</div> : null}

        {allowRemoval && (hasSavedImage || hasUserSelectedImage || removeExistingImage) ? (
          <div className="image-upload-actions">
            {hasUserSelectedImage ? (
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => clearSelectedMedia()}
              >
                {copy.cancelNewImage}
              </button>
            ) : null}

            {hasSavedImage && !hasUserSelectedImage ? (
              <button
                type="button"
                className="button-danger button-small"
                onClick={handleRemoveCurrentImage}
              >
                {copy.removeSavedPoster}
              </button>
            ) : null}

            {removeExistingImage && !hasUserSelectedImage ? (
              <button
                type="button"
                className="button-secondary button-small"
                onClick={handleRestoreCurrentImage}
              >
                {copy.restoreSavedPoster}
              </button>
            ) : null}
          </div>
        ) : null}

        {showPreviewArea ? (
          <div className="image-upload-preview-wrap image-upload-preview-wrap-compare">
            {hasSavedImage ? (
              <div
                className="image-upload-preview-card image-upload-preview-card-saved"
              >
                <div className="image-upload-preview-header">
                  <div className="image-upload-preview-header-row">
                    <strong>{copy.savedPosterTitle}</strong>
                    <span
                      className="poster-mode-button image-upload-preview-badge image-upload-preview-badge-saved"
                    >
                      {savedBadge}
                    </span>
                  </div>
                  <span>{copy.savedPosterText}</span>
                </div>
                <div className="image-upload-preview-frame" data-mode={posterDisplayMode}>
                  <MusicalArtwork
                    imagePath={savedImage}
                    title={previewAlt}
                    posterAspect={currentPosterAspect ?? defaultPreset}
                    posterDisplayMode={posterDisplayMode}
                  />
                </div>
              </div>
            ) : null}

            {hasUserSelectedImage ? (
              <div
                className="image-upload-preview-card image-upload-preview-card-draft"
              >
                <div className="image-upload-preview-header">
                  <div className="image-upload-preview-header-row">
                    <strong>{copy.draftPosterTitle}</strong>
                    <span
                      className="poster-mode-button image-upload-preview-badge image-upload-preview-badge-draft"
                    >
                      {draftBadge}
                    </span>
                  </div>
                  <span>{copy.draftPosterCrop}</span>
                  <span className="image-upload-preview-note">{draftNote}</span>
                </div>
                <div className="image-upload-preview-frame" data-mode={previewMode}>
                  <MusicalArtwork
                    imagePath={previewImagePath}
                    title={previewAlt}
                    posterAspect={cropPreset}
                    posterDisplayMode={previewMode}
                  />
                </div>
              </div>
            ) : null}

            {removeExistingImage && !hasUserSelectedImage ? (
              <div className="image-upload-empty-state">
                <strong>{copy.removalTitle}</strong>
                <span>{copy.removalText}</span>
              </div>
            ) : null}

            <div className="show-meta" style={{ marginTop: 0 }}>
              {previewMetaText}
            </div>
          </div>
        ) : null}
      </div>

      {mounted && cropSourceUrl && loadedImage
        ? createPortal(
            <div className="crop-modal-overlay" onClick={closeCropper}>
              <div
                className="card crop-modal-card max-h-[90vh] flex flex-col"
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

                <div className="crop-modal-stage overflow-y-auto flex-1">
                  <div
                    className={`cropper-frame cropper-frame-preset ${dragging ? "is-dragging" : ""}`}
                    data-mode={posterDisplayMode}
                    style={{
                      aspectRatio: `${CROP_PRESETS[cropPreset].aspect}`,
                    }}
                    onWheel={handleWheel}
                  >
                    <Cropper
                      image={cropSourceUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={CROP_PRESETS[cropPreset].aspect}
                      cropShape="rect"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropAreaChange={(_, areaPixels) => {
                        lastCroppedAreaRef.current = areaPixels;
                        setCroppedAreaPixels(areaPixels);
                      }}
                      onCropComplete={(_, areaPixels) => {
                        lastCroppedAreaRef.current = areaPixels;
                        setCroppedAreaPixels(areaPixels);
                      }}
                      onMediaLoaded={() => setCrop((current) => ({ ...current }))}
                      onCropSizeChange={() => {
                        if (!hasInitializedCropRef.current) {
                          hasInitializedCropRef.current = true;
                          setCrop((current) => ({ ...current }));
                        }
                      }}
                      onInteractionStart={() => setDragging(true)}
                      onInteractionEnd={() => setDragging(false)}
                      objectFit="cover"
                    />
                  </div>
                </div>

                <div className="crop-modal-controls">
                  <div className="cropper-toolbar-card">
                    <div className="poster-mode-row poster-mode-row-preset" role="radiogroup" aria-label="Crop aspect">
                      {(Object.keys(CROP_PRESETS) as CropPreset[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`poster-mode-button ${cropPreset === preset ? "is-active" : ""}`}
                          onClick={() => {
                            setCropPreset(preset);
                            setCroppedAreaPixels(null);
                            setCrop({ x: 0, y: 0 });
                            setZoom(MIN_ZOOM);
                          }}
                        >
                          {CROP_PRESETS[preset].label}
                        </button>
                      ))}
                    </div>
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
                        {Math.round(zoom * 100)}%
                      </span>
                    </label>
                  </div>
                  <div className="crop-modal-helper">
                    {copy.cropHelper}
                  </div>
                  <div className="show-meta" style={{ marginTop: 0 }}>
                    {copy.cropModeText}
                  </div>
                </div>

                <div className="button-row crop-modal-actions sticky bottom-0 bg-[var(--card-bg)] pt-4">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={handleReplaceImage}
                  >
                    {replaceImageLabel}
                  </button>
                  <button type="button" className="button-secondary" onClick={closeCropper}>
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleCropSave}
                    disabled={!canSaveCrop}
                    aria-disabled={!canSaveCrop}
                  >
                    {copy.saveImage}
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
