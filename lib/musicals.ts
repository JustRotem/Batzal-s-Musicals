import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageMusicalContent } from "@/lib/permissions";

async function buildVisibleMusicalsWhere(
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
  where?: Prisma.MusicalWhereInput,
): Promise<Prisma.MusicalWhereInput | undefined> {
  const canViewAllMusicals = await canManageMusicalContent(currentUser);

  if (canViewAllMusicals) {
    return where;
  }

  if (!where) {
    return { isPublished: true };
  }

  return {
    AND: [where, { isPublished: true }],
  };
}

export async function findVisibleMusicals<T extends Prisma.MusicalFindManyArgs>(
  args: Prisma.SelectSubset<T, Prisma.MusicalFindManyArgs> = {} as Prisma.SelectSubset<
    T,
    Prisma.MusicalFindManyArgs
  >,
): Promise<Prisma.MusicalGetPayload<T>[]> {
  const currentUser = await getCurrentUser();
  const queryArgs = (args ?? {}) as Prisma.MusicalFindManyArgs;
  const where = await buildVisibleMusicalsWhere(currentUser, queryArgs.where);

  return db.musical.findMany({
    ...queryArgs,
    where,
  }) as Promise<Prisma.MusicalGetPayload<T>[]>;
}
