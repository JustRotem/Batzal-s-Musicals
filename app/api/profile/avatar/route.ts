import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { ImageUploadError, isFileEntry } from "@/lib/image-upload";
import { PERMISSIONS } from "@/lib/permissions";
import { updateUserAvatar } from "@/lib/profile-avatar";

export async function POST(request: Request) {
  try {
    const user = await requirePermission(PERMISSIONS.profileEdit);
    const formData = await request.formData();
    const imageFileEntry = formData.get("avatarFile");
    const avatarFile = isFileEntry(imageFileEntry) ? imageFileEntry : null;

    const nextAvatarUrl = await updateUserAvatar({
      userId: user.id,
      avatarFile,
    });

    if (!nextAvatarUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing-avatar",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      avatarUrl: nextAvatarUrl,
      avatarVersion: Date.now().toString(),
    });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message:
            error.code === "invalid-image-type"
              ? "Only JPG, PNG, or WEBP files can be uploaded."
              : "The image size must be up to 3MB.",
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      if (error.message === "NEXT_REDIRECT") {
        throw error;
      }
    }

    console.error("[profile][avatar-upload] request failed", {
      reason: error instanceof Error ? error.message : "unknown-error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "avatar-upload-failed",
      },
      { status: 500 },
    );
  }
}
