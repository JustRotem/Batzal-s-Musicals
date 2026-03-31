import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import LazyClipPlayer from "@/components/LazyClipPlayer";
import DeleteMusicalModal from "@/components/DeleteMusicalModal";
import DeleteClipModal from "@/components/DeleteClipModal";
import MusicalArtwork from "@/components/MusicalArtwork";
import ScrollToTopOnLoad from "@/components/ScrollToTopOnLoad";
import ClipCommentsSection from "@/components/ClipCommentsSection";
import { getCurrentUser } from "@/lib/auth";
import {
  canManageMusicalContent,
  getPermissionFlags,
  PERMISSIONS,
} from "@/lib/permissions";
import {
  deleteClipAction,
  deleteMusicalAction,
} from "@/app/admin/musicals/actions";
import { sanitizeRichTextContent } from "@/lib/musical-description";
import { normalizeSlug } from "@/lib/slug";
import { buildClipCommentViews } from "@/lib/clip-comments";
import { formatIsraeliDate } from "@/lib/date-format";
import { getCurrentLanguage } from "@/lib/i18n-server";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    updated?: string;
  }>;
};

function getMusicalPageCopy(locale: "he" | "en") {
  if (locale === "en") {
    return {
      backToAll: "Back To All Musicals",
      clipsCount: (count: number) => `${count} clip${count === 1 ? "" : "s"}`,
      createdBy: "Created by",
      updatedBy: "Last updated by",
      unknownUser: "Unknown",
      createdAt: "Created on",
      updatedAt: "Updated on",
      addClip: "Add Clip",
      editMusical: "Edit Musical",
      clipsTitle: "Clips in this musical",
      clipsText: "All available clips are collected here in the order set for this musical.",
      noClipsTitle: "No clips yet",
      noClipsAdmin: "You can add the first clip from the admin area.",
      noClipsPublic: "Clips will appear here as soon as they are added to the musical.",
      editClip: "Edit Clip",
      play: "Play",
      pause: "Pause",
    };
  }

  return {
    backToAll: "חזרה לכל המחזות",
    clipsCount: (count: number) => `${count} קטעים`,
    createdBy: "נוצר על ידי",
    updatedBy: "עודכן לאחרונה על ידי",
    unknownUser: "לא ידוע",
    createdAt: "נוצר בתאריך",
    updatedAt: "עודכן בתאריך",
    addClip: "הוסף קליפ",
    editMusical: "ערוך מחזה",
    clipsTitle: "קטעים במחזה",
    clipsText: "כל הקטעים הזמינים לצפייה מרוכזים כאן לפי הסדר שהוגדר למחזה.",
    noClipsTitle: "אין עדיין קטעים",
    noClipsAdmin: "אפשר להוסיף קטע ראשון מאזור הניהול.",
    noClipsPublic: "כאן יופיעו קטעים ברגע שיתווספו למחזה.",
    editClip: "ערוך קליפ",
    play: "נגן",
    pause: "עצור",
  };
}

export default async function MusicalPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const slug = normalizeSlug(rawSlug);
  const slugCandidates = rawSlug === slug ? [slug] : [rawSlug, slug];

  const currentUser = await getCurrentUser();
  const locale = await getCurrentLanguage();
  const copy = getMusicalPageCopy(locale);
  const canViewUnpublished = await canManageMusicalContent(currentUser);
  const permissionFlags = await getPermissionFlags(currentUser, [
    PERMISSIONS.clipCreate,
    PERMISSIONS.clipEdit,
    PERMISSIONS.clipDelete,
    PERMISSIONS.musicalEdit,
    PERMISSIONS.musicalDelete,
  ] as const);

  const musical = await db.musical.findFirst({
    where: { slug: { in: slugCandidates } },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  if (!musical) {
    notFound();
  }

  if (!musical.isPublished && !canViewUnpublished) {
    notFound();
  }

  const encodedMusicalSlug = encodeURIComponent(musical.slug);
  const clips = await db.clip.findMany({
    where: { musicalId: musical.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      comments: {
        where: {
          status: "visible",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
  const commentIds = clips.flatMap((clip) => clip.comments.map((comment) => comment.id));
  const reportedCommentIds =
    currentUser && commentIds.length > 0
      ? await db.commentReport.findMany({
          where: {
            commentId: {
              in: commentIds,
            },
            reporterUserId: currentUser.id,
            status: "open",
          },
          select: {
            commentId: true,
          },
        })
      : [];
  const renderedDescription = sanitizeRichTextContent(musical.description);

  return (
    <main className="page-shell" id="musical-page-top">
      {resolvedSearchParams?.updated === "1" ? <ScrollToTopOnLoad /> : null}
      <div className="orb one" />
      <div className="orb two" />

      <div
        className="container"
        style={{
          maxWidth: 960,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <section className="card" style={{ padding: "40px 40px 36px" }}>
          <Link href="/musicals" className="musical-back-link">
            {copy.backToAll}
          </Link>

          <div className="hero-grid musical-hero-grid">
            <div className="musical-hero-content">
              <div className="musical-hero-block">
                <h1 className="hero-title musical-hero-title" dir="auto">
                  {musical.title}
                </h1>

                <div className="tag-row musical-hero-tags">
                  {musical.year ? <div className="tag">📅 {musical.year}</div> : null}
                  <div className="tag">🎞 {copy.clipsCount(clips.length)}</div>
                </div>
              </div>

              {canViewUnpublished ? (
                <div className="admin-meta musical-hero-meta">
                  <span>{copy.createdBy}: {musical.createdBy?.username ?? copy.unknownUser}</span>
                  <span>
                    {copy.updatedBy}: {musical.updatedBy?.username ?? copy.unknownUser}
                  </span>
                  <span>
                    {copy.createdAt}: {formatIsraeliDate(musical.createdAt)}
                  </span>
                  <span>
                    {copy.updatedAt}: {formatIsraeliDate(musical.updatedAt)}
                  </span>
                </div>
              ) : null}

              {renderedDescription ? (
                <div
                  className="hero-text rich-text-content musical-hero-description"
                  dir="auto"
                  dangerouslySetInnerHTML={{ __html: renderedDescription }}
                />
              ) : null}

              {permissionFlags.clip_create ||
              permissionFlags.musical_edit ||
              permissionFlags.musical_delete ? (
                <div className="button-row musical-hero-actions" style={{ marginTop: 0 }}>
                  {permissionFlags.clip_create ? (
                    <Link
                      href={`/admin/musicals/${encodedMusicalSlug}/clips/new`}
                      className="button-primary"
                    >
                      {copy.addClip}
                    </Link>
                  ) : null}
                  {permissionFlags.musical_edit ? (
                    <Link
                      href={`/admin/musicals/${encodedMusicalSlug}/edit`}
                      className="button-secondary"
                    >
                      {copy.editMusical}
                    </Link>
                  ) : null}
                  {permissionFlags.musical_delete ? (
                    <DeleteMusicalModal
                      action={deleteMusicalAction}
                      musicalId={musical.id}
                      musicalTitle={musical.title}
                      language={locale}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="musical-hero-artwork">
              <MusicalArtwork
                imagePath={musical.imagePath}
                posterDisplayMode={musical.posterDisplayMode}
                posterAspect={musical.posterAspect}
                title={musical.title}
                thumbnailUrl={musical.thumbnailUrl}
                emoji={musical.emoji}
                size="hero"
              />
            </div>
          </div>
        </section>

        <section className="card musical-clips-section" style={{ padding: "32px 40px" }}>
          <div className="musical-clips-header">
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              {copy.clipsTitle}
            </h2>
            <p className="show-meta musical-clips-subtitle">
              {copy.clipsText}
            </p>
          </div>

          <div className="list">
            {clips.length === 0 ? (
              <div className="clip-box clip-empty-state">
                <div className="show-name">{copy.noClipsTitle}</div>
                {canViewUnpublished ? (
                  <div className="show-meta">{copy.noClipsAdmin}</div>
                ) : (
                  <div className="show-meta">{copy.noClipsPublic}</div>
                )}
              </div>
            ) : (
              clips.map((clip) => {
                const renderedClipDescription = sanitizeRichTextContent(clip.description);
                const commentViews = buildClipCommentViews(clip.comments, locale);
                const titleText = clip.title ?? "";
                const hasHebrew = /[\u0590-\u05FF]/.test(titleText);
                const hasLatin = /[A-Za-z]/.test(titleText);
                const titleDir = hasHebrew ? "rtl" : hasLatin ? "ltr" : locale === "he" ? "rtl" : "ltr";

                return (
                  <div key={clip.id} id={`clip-${clip.id}`} className="clip-box musical-clip-card">
                    <div className="musical-clip-heading">
                      <div className="show-name musical-clip-title" dir={titleDir}>
                        {titleText}
                      </div>
                    </div>

                    {renderedClipDescription ? (
                      <div
                        className="show-meta rich-text-content musical-clip-description"
                        dir="auto"
                        dangerouslySetInnerHTML={{ __html: renderedClipDescription }}
                      />
                    ) : null}

                    <div className="musical-clip-player">
                      <LazyClipPlayer
                        language={locale}
                        title={clip.title}
                        sourceType={clip.sourceType}
                        youtubeVideoId={clip.youtubeVideoId}
                        uploadedVideoUrl={clip.uploadedVideoUrl}
                        uploadedThumbnailUrl={clip.uploadedThumbnailUrl}
                        start={clip.startSeconds}
                        end={clip.endSeconds}
                        fallbackText={
                          locale === "en"
                            ? "Your browser does not support video playback."
                            : "הדפדפן שלך לא תומך בניגון וידאו."
                        }
                      />
                    </div>

                    <ClipCommentsSection
                      clipId={clip.id}
                      musicalSlug={musical.slug}
                      language={locale}
                      currentUser={
                        currentUser
                          ? {
                              id: currentUser.id,
                              username: currentUser.username,
                              avatarUrl: currentUser.avatarUrl,
                              language: currentUser.language,
                              role: currentUser.role,
                            }
                          : null
                      }
                      initialComments={commentViews}
                      reportedCommentIds={reportedCommentIds.map((report) => report.commentId)}
                    />

                    {permissionFlags.clip_edit || permissionFlags.clip_delete ? (
                      <div className="button-row musical-clip-actions" style={{ marginTop: 0 }}>
                        {permissionFlags.clip_edit ? (
                          <Link
                            href={`/admin/musicals/${encodedMusicalSlug}/clips/${clip.id}/edit`}
                            className="button-secondary"
                          >
                            {copy.editClip}
                          </Link>
                        ) : null}
                        {permissionFlags.clip_delete ? (
                          <DeleteClipModal
                            action={deleteClipAction}
                            clipId={clip.id}
                            clipTitle={clip.title}
                            currentSlug={musical.slug}
                            language={locale}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
