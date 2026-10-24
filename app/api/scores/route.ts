import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import { getAllowedOrigins } from "@/lib/sso";

export const dynamic = "force-dynamic";

// Rankings of the small games on the Batzal home page. Anyone may look; only signed-in people have a place in the ranking.
// Runner: a longer run is better.
const GAMES = {
  runner: { best: "max", min: 1, max: 100000 },
} as const;
type Game = keyof typeof GAMES;

const isGame = (value: unknown): value is Game => typeof value === "string" && Object.prototype.hasOwnProperty.call(GAMES, value);

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (!origin) return null;
  if (origin === new URL(getAppUrl()).origin) return origin;

  return getAllowedOrigins().includes(origin) ? origin : null;
}

function reply(request: Request, body: unknown, status = 200) {
  const origin = allowedOrigin(request);
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export async function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);

  if (!origin) return new NextResponse(null, { status: 403 });

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

async function standings(game: Game, userId: string | null) {
  const order = GAMES[game].best === "max" ? "desc" : "asc";
  const top = await db.gameScore.findMany({
    where: { game },
    orderBy: [{ score: order }, { updatedAt: "asc" }],
    take: 10,
    select: { score: true, userId: true, user: { select: { username: true } } },
  });
  const mine = userId ? await db.gameScore.findUnique({ where: { userId_game: { userId, game } }, select: { score: true } }) : null;

  return {
    game,
    best: GAMES[game].best,
    top: top.map((row) => ({ username: row.user.username, score: row.score, me: row.userId === userId })),
    mine: mine?.score ?? null,
  };
}

export async function GET(request: Request) {
  const game = new URL(request.url).searchParams.get("game");

  if (!isGame(game)) return reply(request, { error: "invalid" }, 400);

  const user = await getCurrentUser();

  return reply(request, { signedIn: Boolean(user), ...(await standings(game, user?.id ?? null)) });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") && !allowedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user || user.status !== "active") return reply(request, { error: "unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as { game?: unknown; score?: unknown } | null;
  const game = body?.game;
  const score = body?.score;

  if (!isGame(game) || typeof score !== "number" || !Number.isInteger(score) || score < GAMES[game].min || score > GAMES[game].max) {
    return reply(request, { error: "invalid" }, 400);
  }

  const current = await db.gameScore.findUnique({ where: { userId_game: { userId: user.id, game } }, select: { score: true } });
  const better = !current || (GAMES[game].best === "max" ? score > current.score : score < current.score);

  if (better) {
    await db.gameScore.upsert({
      where: { userId_game: { userId: user.id, game } },
      create: { userId: user.id, game, score },
      update: { score },
    });
  }

  return reply(request, { signedIn: true, improved: better, ...(await standings(game, user.id)) });
}
