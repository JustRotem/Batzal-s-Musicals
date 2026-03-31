"use client";

import { useRef } from "react";
import Link from "next/link";
import NewMusicalSubmitButton from "@/components/NewMusicalSubmitButton";
import { updateMusicalAction } from "@/app/admin/musicals/actions";
import ClipOrderManager from "@/components/ClipOrderManager";
import MusicalImageUploadField from "@/components/MusicalImageUploadField";
import MusicalDescriptionEditor from "@/components/MusicalDescriptionEditor";
import { formatMessage, getTranslations, type AppLanguage } from "@/lib/i18n";

type EditMusicalFormProps = {
  language?: AppLanguage;
  musical: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    year: number | null;
    imagePath: string | null;
    posterDisplayMode: "crop" | "fit";
    posterAspect: "square" | "wide" | "tall";
    thumbnailUrl: string | null;
    isPublished: boolean;
    clips: Array<{
      id: string;
      title: string;
      sourceType: "youtube" | "upload";
    }>;
  };
  serverError?: string;
  initialValues?: {
    title: string;
    description: string;
    year: string;
    isPublished: boolean;
  };
};

export default function EditMusicalForm({
  language = "he",
  musical,
  serverError,
  initialValues = {
    title: musical.title,
    description: musical.description ?? "",
    year: musical.year?.toString() ?? "",
    isPublished: musical.isPublished,
  },
}: EditMusicalFormProps) {
  const t = getTranslations(language).contentEditor.musicals;
  const imageFileRef = useRef<File | null>(null);
  const handleSubmit = async (formData: FormData) => {
    if (imageFileRef.current) {
      formData.set("imageFile", imageFileRef.current);
    }
    await updateMusicalAction(formData);
  };

  return (
    <form
      action={handleSubmit}
      encType="multipart/form-data"
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

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.basicTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.basicTextEdit}
          </p>
        </div>

        <div className="content-editor-grid content-editor-grid-compact">
          <div className="field">
            <label className="field-label" htmlFor="edit-title">
              {t.titleLabel}
            </label>
            <input
              id="edit-title"
              name="title"
              className="input"
              defaultValue={initialValues.title}
              placeholder={t.titlePlaceholder}
              required
              aria-invalid={serverError === "missing-title" ? true : undefined}
              aria-describedby={serverError === "missing-title" ? "edit-title-error" : undefined}
            />
            {serverError === "missing-title" ? (
              <div
                id="edit-title-error"
                style={{ color: "#ffb3b3", fontSize: 13, paddingInline: 4 }}
              >
                {t.titleRequired}
              </div>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="edit-year">
              {t.yearLabel}
            </label>
            <input
              id="edit-year"
              name="year"
              className="input"
              inputMode="numeric"
              defaultValue={initialValues.year}
              placeholder="2007"
              dir="ltr"
              style={{ textAlign: "left" }}
              aria-invalid={serverError === "invalid-year" ? true : undefined}
              aria-describedby={serverError === "invalid-year" ? "edit-year-error" : undefined}
            />
            {serverError === "invalid-year" ? (
              <div
                id="edit-year-error"
                style={{ color: "#ffb3b3", fontSize: 13, paddingInline: 4 }}
              >
                {t.yearInvalid}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.mediaTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.mediaTextEdit}
          </p>
        </div>

        <MusicalImageUploadField
          language={language}
          inputId="edit-musical-image"
          name="imageFile"
          label={t.imageLabel}
          currentImagePath={musical.imagePath}
          currentThumbnailUrl={musical.thumbnailUrl}
          currentPosterAspect={musical.posterAspect}
          previewAlt={formatMessage(t.imagePreviewAltEdit, { title: musical.title })}
          onFileChange={(file) => {
            imageFileRef.current = file;
          }}
        />
      </section>

      <ClipOrderManager language={language} clips={musical.clips} />

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.descriptionTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.descriptionTextEdit}
          </p>
        </div>
        <MusicalDescriptionEditor
          language={language}
          inputId="edit-description"
          name="description"
          label={t.descriptionLabel}
          initialValue={initialValues.description}
          placeholder={t.descriptionPlaceholderEdit}
        />
      </section>

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.publishTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.publishTextEdit}
          </p>
        </div>
        <label className="toggle-field">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialValues.isPublished}
            className="toggle-input sr-only"
          />
          <span className="toggle-control" aria-hidden="true">
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">{t.keepPublished}</span>
        </label>

        <div className="button-row content-editor-actions" style={{ marginTop: 0 }}>
          <NewMusicalSubmitButton
            idleLabel={t.saveChanges}
            pendingLabel={t.savingChanges}
          />
          <Link href={`/musicals/${encodeURIComponent(musical.slug)}`} className="button-secondary">
            {t.cancelChanges}
          </Link>
        </div>
      </section>
    </form>
  );
}
