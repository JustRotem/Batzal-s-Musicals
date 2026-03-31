import { notFound } from "next/navigation";
import Link from "next/link";
import NewClipForm from "@/components/NewClipForm";
import { requirePermission } from "@/lib/auth";
import { buildClipInitialValues } from "@/lib/clip-form";
import { db } from "@/lib/db";
import { formatMessage, getTranslations } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeSlug } from "@/lib/slug";

type NewClipPageProps = {
  params: Promise<{
    slug: string;
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

function getErrorMessage(error: string | undefined, language: "he" | "en") {
  const errors = getTranslations(language).contentEditor.clips.errors;
  return error ? errors[error as keyof typeof errors] ?? null : null;
}

function isUploadError(error: string | undefined) {
  return (
    error === "missing-upload-video" ||
    error === "invalid-upload-file-type" ||
    error === "upload-file-too-large" ||
    error === "invalid-upload-url"
  );
}

export default async function NewClipPage(props: NewClipPageProps) {
  await requirePermission(PERMISSIONS.clipCreate);

  const language = await getCurrentLanguage();
  const t = getTranslations(language).contentEditor.clips;
  const { slug: rawSlug } = await props.params;
  const normalizedSlug = normalizeSlug(rawSlug);
  const slugCandidates = rawSlug === normalizedSlug ? [rawSlug] : [rawSlug, normalizedSlug];
  const searchParams = await props.searchParams;
  const errorMessage = getErrorMessage(searchParams?.error, language);

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

  const initialValues = buildClipInitialValues({
    title: searchParams?.title,
    description: searchParams?.description,
    sourceType: searchParams?.sourceType,
    youtubeVideoId: searchParams?.youtubeVideoId,
    uploadedVideoUrl: searchParams?.uploadedVideoUrl,
    startTime: searchParams?.startTime,
    endTime: searchParams?.endTime,
  });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <div className="content-page-header">
            <div>
              <h1 className="viewer-title">{t.newPageTitle}</h1>
              <p className="viewer-text">{formatMessage(t.newPageText, { title: musical.title })}</p>
            </div>
            <Link
              href={`/musicals/${encodeURIComponent(musical.slug)}`}
              className="button-secondary content-page-back-button"
            >
              {language === "en" ? "Back To Musical" : "חזרה למחזה"}
            </Link>
          </div>

          {errorMessage && !isUploadError(searchParams?.error) ? (
            <div className="auth-error">{errorMessage}</div>
          ) : null}
          <NewClipForm
            language={language}
            musical={musical}
            initialValues={initialValues}
            serverError={searchParams?.error}
          />
        </section>
      </div>
    </main>
  );
}
