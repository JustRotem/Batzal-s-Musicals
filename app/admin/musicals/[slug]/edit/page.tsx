import { notFound } from "next/navigation";
import EditMusicalForm from "@/components/EditMusicalForm";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTranslations } from "@/lib/i18n";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeSlug } from "@/lib/slug";

type EditMusicalPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    title?: string;
    description?: string;
    year?: string;
    isPublished?: string;
    orderedClipIds?: string;
  }>;
};

function getErrorMessage(error: string | undefined, language: "he" | "en") {
  const t = getTranslations(language).contentEditor.musicals;

  switch (error) {
    case "missing-title":
      return t.titleRequired;
    case "invalid-year":
      return t.yearInvalid;
    case "invalid-image-type":
      return t.invalidImageType;
    case "image-too-large":
      return t.imageTooLarge;
    case "clip-order-save-failed":
      return t.clipOrderSaveFailed;
    default:
      return null;
  }
}

export default async function EditMusicalPage(props: EditMusicalPageProps) {
  await requirePermission(PERMISSIONS.musicalEdit);

  const language = await getCurrentLanguage();
  const t = getTranslations(language).contentEditor.musicals;
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
      description: true,
      year: true,
      imagePath: true,
      posterDisplayMode: true,
      posterAspect: true,
      thumbnailUrl: true,
      isPublished: true,
      clips: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          sourceType: true,
        },
      },
    },
  });

  if (!musical) {
    notFound();
  }

  const orderedClipIds = searchParams?.orderedClipIds
    ? (() => {
        try {
          const parsed = JSON.parse(searchParams.orderedClipIds) as unknown;
          return Array.isArray(parsed) && parsed.every((value) => typeof value === "string") ? parsed : null;
        } catch {
          return null;
        }
      })()
    : null;

  const orderedClips =
    orderedClipIds &&
    orderedClipIds.length === musical.clips.length &&
    new Set(orderedClipIds).size === orderedClipIds.length &&
    musical.clips.every((clip) => orderedClipIds.includes(clip.id))
      ? orderedClipIds
          .map((clipId) => musical.clips.find((clip) => clip.id === clipId))
          .filter((clip): clip is (typeof musical.clips)[number] => !!clip)
      : musical.clips;

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <h1 className="viewer-title">{t.editPageTitle}</h1>
          <p className="viewer-text">{t.editPageText}</p>

          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
          <EditMusicalForm
            language={language}
            musical={{
              ...musical,
              clips: orderedClips,
            }}
            serverError={searchParams?.error}
            initialValues={{
              title: searchParams?.title ?? musical.title,
              description: searchParams?.description ?? musical.description ?? "",
              year: searchParams?.year ?? (musical.year?.toString() ?? ""),
              isPublished:
                searchParams?.isPublished === undefined
                  ? musical.isPublished
                  : searchParams.isPublished === "1",
            }}
          />
        </section>
      </div>
    </main>
  );
}
