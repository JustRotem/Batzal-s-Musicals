"use client";

import { useRef } from "react";
import NewMusicalSubmitButton from "@/components/NewMusicalSubmitButton";
import { createMusicalAction } from "@/app/admin/musicals/actions";
import MusicalImageUploadField from "@/components/MusicalImageUploadField";
import MusicalDescriptionEditor from "@/components/MusicalDescriptionEditor";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type NewMusicalFormProps = {
  language?: AppLanguage;
  serverError?: string;
  initialValues?: {
    title: string;
    description: string;
    year: string;
    isPublished: boolean;
  };
};

export default function NewMusicalForm({
  language = "he",
  serverError,
  initialValues = {
    title: "",
    description: "",
    year: "",
    isPublished: false,
  },
}: NewMusicalFormProps) {
  const t = getTranslations(language).contentEditor.musicals;
  const imageFileRef = useRef<File | null>(null);
  const handleSubmit = async (formData: FormData) => {
    if (imageFileRef.current) {
      formData.set("imageFile", imageFileRef.current);
    }
    await createMusicalAction(formData);
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
      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.basicTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.basicTextNew}
          </p>
        </div>

        <div className="content-editor-grid content-editor-grid-compact">
          <div className="field">
            <label className="field-label" htmlFor="title">
              {t.titleLabel}
            </label>
            <input
              id="title"
              name="title"
              className="input"
              defaultValue={initialValues.title}
              placeholder={t.titlePlaceholder}
              required
              aria-invalid={serverError === "missing-title" ? true : undefined}
              aria-describedby={serverError === "missing-title" ? "title-error" : undefined}
            />
            {serverError === "missing-title" ? (
              <div
                id="title-error"
                style={{ color: "#ffb3b3", fontSize: 13, paddingInline: 4 }}
              >
                {t.titleRequired}
              </div>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="year">
              {t.yearLabel}
            </label>
            <input
              id="year"
              name="year"
              className="input"
              inputMode="numeric"
              defaultValue={initialValues.year}
              placeholder="2007"
              dir="ltr"
              style={{ textAlign: "left" }}
            />
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
            {t.mediaTextNew}
          </p>
        </div>

        <MusicalImageUploadField
          language={language}
          inputId="musical-image"
          name="imageFile"
          label={t.imageLabel}
          previewAlt={t.imagePreviewAltNew}
          allowRemoval={false}
          onFileChange={(file) => {
            imageFileRef.current = file;
          }}
        />
      </section>

      <section
        className="card content-editor-section"
        style={{ padding: 24 }}
      >
        <div className="content-editor-section-header">
          <h2 className="panel-title" style={{ marginBottom: 8 }}>
            {t.descriptionTitle}
          </h2>
          <p className="show-meta" style={{ marginTop: 0 }}>
            {t.descriptionTextNew}
          </p>
        </div>
        <MusicalDescriptionEditor
          language={language}
          inputId="description"
          name="description"
          label={t.descriptionLabel}
          initialValue={initialValues.description}
          placeholder={t.descriptionPlaceholderNew}
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
            {t.publishTextNew}
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
          <span className="toggle-label">{t.publishNow}</span>
        </label>

        <div className="button-row content-editor-actions" style={{ marginTop: 0 }}>
          <NewMusicalSubmitButton idleLabel={t.create} pendingLabel={t.creating} />
        </div>
      </section>
    </form>
  );
}
