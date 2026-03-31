import { notFound } from "next/navigation";
import NewClipForm from "@/components/NewClipForm";
import { updateClipAction } from "@/app/admin/musicals/actions";
import { requirePermission } from "@/lib/auth";
import { buildClipInitialValues } from "@/lib/clip-form";
import { db } from "@/lib/db";
import { formatMessage, getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeSlug } from "@/lib/slug";

type EditClipPageProps = {
  params: Promise<{
    slug: string;
    clipId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    title?: string;
    description?: string;
    sourceType?: string;
    youtubeVideoId?: string;
    uploadedVideoUrl?: string;
    startTime?: string;
    endTime?: string;
  }>;
};

const UPLOAD_ERROR_KEYS = new Set([
  "missing-upload-video",
  "invalid-upload-file-type",
  "upload-file-too-large",
  "invalid-upload-url",
]);

const getEditClipErrorState = (error: string | undefined, language: "he" | "en") => {
  const errors = getTranslations(language).contentEditor.clips.errors;
  const isUploadError = error ? UPLOAD_ERROR_KEYS.has(error) : false;

  return {
    errorMessage: error ? errors[error as keyof typeof errors] ?? null : null,
    isUploadError,
  };
};

export default async function EditClipPage(props: EditClipPageProps) {
  await requirePermission(PERMISSIONS.clipEdit);

  const language = await getCurrentLanguage();
  const t = getTranslations(language).contentEditor.clips;
  const { slug: rawSlug, clipId } = await props.params;
  const normalizedSlug = normalizeSlug(rawSlug);
  const slugCandidates = rawSlug === normalizedSlug ? [rawSlug] : [rawSlug, normalizedSlug];
  const searchParams = await props.searchParams;
  const { errorMessage, isUploadError } = getEditClipErrorState(searchParams?.error, language);

  const musical = await db.musical.findFirst({
    where: { slug: { in: slugCandidates } },
    select: {
      id: true,
      slug: true,
      title: true,
    },
  });

  if (!musical) {
    notFound();
  }

  const clip = await db.clip.findFirst({
    where: {
      id: clipId,
      musicalId: musical.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      sourceType: true,
      youtubeVideoId: true,
      uploadedVideoUrl: true,
      uploadedThumbnailUrl: true,
      startSeconds: true,
      endSeconds: true,
    },
  });

  if (!clip) {
    notFound();
  }

  const initialValues = buildClipInitialValues({
    title: searchParams?.title ?? clip.title,
    description: searchParams?.description ?? clip.description,
    sourceType: searchParams?.sourceType ?? clip.sourceType,
    youtubeVideoId: searchParams?.youtubeVideoId ?? clip.youtubeVideoId,
    uploadedVideoUrl: searchParams?.uploadedVideoUrl ?? clip.uploadedVideoUrl,
    uploadedThumbnailUrl: clip.uploadedThumbnailUrl ?? null,
    startTime: searchParams?.startTime,
    endTime: searchParams?.endTime,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
  });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <h1 className="viewer-title">{t.editPageTitle}</h1>
          <p className="viewer-text">{formatMessage(t.editPageText, { title: musical.title })}</p>

          {errorMessage && !isUploadError ? (
            <div className="auth-error">{errorMessage}</div>
          ) : null}
          <NewClipForm
            language={language}
            musical={musical}
            clipId={clip.id}
            initialValues={initialValues}
            action={updateClipAction}
            submitLabel={t.saveChanges}
            pendingLabel={t.savingChanges}
            descriptionText={formatMessage(t.editFormText, { title: musical.title })}
            cancelHref={`/musicals/${encodeURIComponent(musical.slug)}`}
            cancelLabel={t.cancelChanges}
            serverError={searchParams?.error}
          />
        </section>
      </div>
    </main>
  );
}
