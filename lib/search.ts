import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRichTextPlainText } from "@/lib/musical-description";
import { canManageMusicalContent } from "@/lib/permissions";

export type SearchMusicalResult = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  imagePath: string | null;
  posterDisplayMode: "crop" | "fit";
  posterAspect: "square" | "wide" | "tall";
  thumbnailUrl: string | null;
  emoji: string | null;
  snippet: string;
};

export type SearchClipResult = {
  id: string;
  title: string;
  snippet: string;
  sourceType: "youtube" | "upload";
  musical: {
    slug: string;
    title: string;
    year: number | null;
    imagePath?: string | null;
    posterDisplayMode?: "crop" | "fit";
    posterAspect?: "square" | "wide" | "tall";
    thumbnailUrl?: string | null;
  };
};

export type SearchContentResult = {
  query: string;
  type: "all" | "musicals" | "clips";
  year: number | null;
  musicals: SearchMusicalResult[];
  clips: SearchClipResult[];
};

export type SearchContentFilters = {
  type?: "all" | "musicals" | "clips";
  year?: string | null;
  musicalLimit?: number;
  clipLimit?: number;
};

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchQuery(value: string | null | undefined) {
  return normalizeSearchText(value);
}

function buildSnippet(text: string, query: string, fallbackText: string) {
  const source = text.replace(/\s+/g, " ").trim();

  if (!source) {
    return fallbackText;
  }

  const normalizedSource = source.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const matchIndex = normalizedSource.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return source.length > 160 ? `${source.slice(0, 157).trim()}...` : source;
  }

  const start = Math.max(0, matchIndex - 54);
  const end = Math.min(source.length, matchIndex + normalizedQuery.length + 86);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function getYearMatch(rawQuery: string) {
  const parsedYear = Number(rawQuery);
  return Number.isInteger(parsedYear) ? parsedYear : null;
}

function buildMusicalWhere(args: {
  query: string;
  canViewUnpublished: boolean;
  year: number | null;
}): Prisma.MusicalWhereInput {
  const yearMatch = getYearMatch(args.query);

  return {
    ...(args.canViewUnpublished ? {} : { isPublished: true }),
    ...(args.year ? { year: args.year } : {}),
    OR: [
      {
        title: {
          contains: args.query,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: args.query,
          mode: "insensitive",
        },
      },
      ...(yearMatch
        ? [
            {
              year: yearMatch,
            },
          ]
        : []),
    ],
  };
}

function buildClipWhere(args: {
  query: string;
  canViewUnpublished: boolean;
  year: number | null;
}): Prisma.ClipWhereInput {
  const musicalVisibility = args.canViewUnpublished ? {} : { isPublished: true };
  const musicalFilter = args.year ? { ...musicalVisibility, year: args.year } : musicalVisibility;

  return {
    ...(args.year || !args.canViewUnpublished
      ? {
          musical: musicalFilter,
        }
      : {}),
    OR: [
      {
        title: {
          contains: args.query,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: args.query,
          mode: "insensitive",
        },
      },
      {
        musical: {
          ...musicalVisibility,
          title: {
            contains: args.query,
            mode: "insensitive",
          },
        },
      },
    ],
  };
}

function scoreMusicalMatch(args: {
  title: string;
  descriptionText: string;
  year: number | null;
  query: string;
}) {
  const normalizedQuery = normalizeSearchQuery(args.query);
  const normalizedTitle = normalizeSearchText(args.title);
  const normalizedDescription = normalizeSearchText(args.descriptionText);
  const normalizedYear = args.year ? String(args.year) : "";

  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 140;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 100;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 72;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    score += 24;
  }

  if (normalizedYear === normalizedQuery) {
    score += 12;
  }

  return score;
}

function scoreClipMatch(args: {
  title: string;
  descriptionText: string;
  musicalTitle: string;
  query: string;
}) {
  const normalizedQuery = normalizeSearchQuery(args.query);
  const normalizedTitle = normalizeSearchText(args.title);
  const normalizedDescription = normalizeSearchText(args.descriptionText);
  const normalizedMusicalTitle = normalizeSearchText(args.musicalTitle);

  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 140;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 96;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 68;
  }

  if (normalizedMusicalTitle.startsWith(normalizedQuery)) {
    score += 28;
  } else if (normalizedMusicalTitle.includes(normalizedQuery)) {
    score += 18;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    score += 20;
  }

  return score;
}

export async function searchContent(
  rawQuery: string,
  filters: SearchContentFilters = {},
): Promise<SearchContentResult> {
  const query = normalizeSearchQuery(rawQuery);
  const type = filters.type ?? "all";
  const parsedYear = filters.year?.trim() ? Number(filters.year.trim()) : null;
  const year = Number.isInteger(parsedYear) ? parsedYear : null;
  const musicalLimit = Math.max(1, Math.min(filters.musicalLimit ?? 12, 20));
  const clipLimit = Math.max(1, Math.min(filters.clipLimit ?? 12, 20));

  if (!query) {
    return {
      query: "",
      type,
      year,
      musicals: [],
      clips: [],
    };
  }

  const currentUser = await getCurrentUser();
  const canViewUnpublished = await canManageMusicalContent(currentUser);

  const [musicals, clips] = await Promise.all([
    type === "clips"
      ? Promise.resolve([])
      : db.musical.findMany({
          where: buildMusicalWhere({ query, canViewUnpublished, year }),
          select: {
            id: true,
            slug: true,
            title: true,
            year: true,
            description: true,
            imagePath: true,
            posterDisplayMode: true,
            posterAspect: true,
            thumbnailUrl: true,
            emoji: true,
            updatedAt: true,
          },
          take: musicalLimit * 3,
          orderBy: [{ updatedAt: "desc" }],
        }),
    type === "musicals"
      ? Promise.resolve([])
      : db.clip.findMany({
          where: buildClipWhere({ query, canViewUnpublished, year }),
          select: {
            id: true,
            title: true,
            description: true,
            sourceType: true,
            updatedAt: true,
            musical: {
              select: {
                slug: true,
                title: true,
                year: true,
                imagePath: true,
                posterDisplayMode: true,
                posterAspect: true,
                thumbnailUrl: true,
              },
            },
          },
          take: clipLimit * 3,
          orderBy: [{ updatedAt: "desc" }],
        }),
  ]);

  const matchedMusicals = musicals
    .map((musical) => {
      const descriptionText = getRichTextPlainText(musical.description);
      const yearSnippet = musical.year ? `שנה: ${musical.year}` : "";
      const fallbackSnippet = yearSnippet || "מחזה זמין לצפייה במערכת.";
      const snippetSource =
        descriptionText || [musical.title, yearSnippet].filter(Boolean).join(" • ");

      return {
        id: musical.id,
        slug: musical.slug,
        title: musical.title,
        year: musical.year,
        imagePath: musical.imagePath,
        posterDisplayMode: musical.posterDisplayMode,
        posterAspect: musical.posterAspect,
        thumbnailUrl: musical.thumbnailUrl,
        emoji: musical.emoji,
        snippet: buildSnippet(snippetSource, query, fallbackSnippet),
        _score: scoreMusicalMatch({
          title: musical.title,
          descriptionText,
          year: musical.year,
          query,
        }),
        _updatedAt: musical.updatedAt.getTime(),
      };
    })
    .sort((left, right) => right._score - left._score || right._updatedAt - left._updatedAt)
    .slice(0, musicalLimit)
    .map(({ _score: _discardScore, _updatedAt: _discardUpdatedAt, ...musical }) => musical);

  const matchedClips = clips
    .map((clip) => {
      const descriptionText = getRichTextPlainText(clip.description);
      const fallbackSnippet = `קטע מתוך ${clip.musical.title}`;
      const snippetSource = descriptionText || clip.title;

      return {
        id: clip.id,
        title: clip.title,
        snippet: buildSnippet(snippetSource, query, fallbackSnippet),
        sourceType: clip.sourceType,
        musical: {
          slug: clip.musical.slug,
          title: clip.musical.title,
          year: clip.musical.year,
          imagePath: clip.musical.imagePath,
          posterDisplayMode: clip.musical.posterDisplayMode,
          thumbnailUrl: clip.musical.thumbnailUrl,
        },
        _score: scoreClipMatch({
          title: clip.title,
          descriptionText,
          musicalTitle: clip.musical.title,
          query,
        }),
        _updatedAt: clip.updatedAt.getTime(),
      };
    })
    .sort((left, right) => right._score - left._score || right._updatedAt - left._updatedAt)
    .slice(0, clipLimit)
    .map(({ _score: _discardScore, _updatedAt: _discardUpdatedAt, ...clip }) => clip);

  return {
    query,
    type,
    year,
    musicals: matchedMusicals,
    clips: matchedClips,
  };
}
