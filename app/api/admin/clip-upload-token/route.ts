import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClipUploadToken } from "@/lib/clip-upload-auth";
import { getClipUploadApiUrl } from "@/lib/env";
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  const currentUser = await requireUser();
  const canUploadClip = await hasAnyPermission(currentUser, [
    PERMISSIONS.clipCreate,
    PERMISSIONS.clipEdit,
  ]);

  if (!canUploadClip) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const uploadUrl = getClipUploadApiUrl();

  console.info("[clip-upload-token] issue", {
    userId: currentUser.id,
    uploadUrl,
  });

  return NextResponse.json({
    ok: true,
    token: createClipUploadToken(currentUser.id),
    uploadUrl,
  });
}
