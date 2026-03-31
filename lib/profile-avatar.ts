import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { deleteUploadedImage, saveUploadedImage } from "@/lib/image-upload";

export const AVATAR_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const AVATAR_UPLOAD_PUBLIC_PATH = "/uploads/avatars";

export async function updateUserAvatar(params: {
  userId: string;
  avatarFile: File | null;
}) {
  const nextAvatarUrl = await saveUploadedImage({
    file: params.avatarFile,
    uploadDir: AVATAR_UPLOAD_DIR,
    publicPathPrefix: AVATAR_UPLOAD_PUBLIC_PATH,
  });

  if (!nextAvatarUrl) {
    return null;
  }

  const existingUser = await db.user.findUnique({
    where: { id: params.userId },
    select: {
      avatarUrl: true,
    },
  });

  await db.user.update({
    where: { id: params.userId },
    data: {
      avatarUrl: nextAvatarUrl,
    },
  });

  if (existingUser?.avatarUrl && existingUser.avatarUrl !== nextAvatarUrl) {
    await deleteUploadedImage(existingUser.avatarUrl, AVATAR_UPLOAD_PUBLIC_PATH);
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile", "page");

  return nextAvatarUrl;
}
