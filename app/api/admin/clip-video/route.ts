import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyClipUploadToken } from "@/lib/clip-upload-auth";
import {
  ClipVideoUploadError,
  getVideoExtensionFromFile,
  saveUploadedClipVideo,
} from "@/lib/clip-video-upload";
import { scheduleClipUploadOrphanCleanup } from "@/lib/clip-video-orphan-cleanup";
import { getClipUploadAllowedOrigin } from "@/lib/env";
import { isFileEntry } from "@/lib/image-upload";
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = getClipUploadAllowedOrigin();

  if (!origin || origin !== allowedOrigin) {
    return {} as Record<string, string>;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function getAuthorizedUploadUser(request: Request) {
  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    const token = authorizationHeader.slice("Bearer ".length).trim();

    if (!token) {
      return null;
    }

    return verifyClipUploadToken(token);
  }

  return getCurrentUser();
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  const currentUser = await getAuthorizedUploadUser(request);
  const corsHeaders = buildCorsHeaders(request);

  console.info("[clip-video-upload] request:start", {
    userId: currentUser?.id ?? null,
  });

  if (!currentUser) {
    console.warn("[clip-video-upload] request:unauthorized");
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const canUploadClip = await hasAnyPermission(currentUser, [
    PERMISSIONS.clipCreate,
    PERMISSIONS.clipEdit,
  ]);

  if (!canUploadClip) {
    console.warn("[clip-video-upload] request:forbidden", {
      userId: currentUser.id,
    });
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("videoFile");
    const videoFile = isFileEntry(fileEntry) ? fileEntry : null;
    const detectedExtension = videoFile ? getVideoExtensionFromFile(videoFile) : null;

    console.info("[clip-video-upload] request:file", {
      userId: currentUser.id,
      hasFile: !!videoFile,
      fileName: videoFile?.name ?? null,
      fileSize: videoFile?.size ?? null,
      fileType: videoFile?.type ?? null,
      detectedExtension,
    });

    if (!videoFile || videoFile.size === 0) {
      console.warn("[clip-video-upload] request:missing-file", {
        userId: currentUser.id,
      });
      return NextResponse.json(
        { ok: false, error: "missing-upload-video", message: "No video file was attached." },
        { status: 400, headers: corsHeaders },
      );
    }

    const videoUrl = await saveUploadedClipVideo(videoFile);

    if (!videoUrl) {
      console.warn("[clip-video-upload] request:save-returned-empty", {
        userId: currentUser.id,
        fileName: videoFile.name,
      });
      return NextResponse.json(
        { ok: false, error: "missing-upload-video", message: "The uploaded file could not be saved." },
        { status: 400, headers: corsHeaders },
      );
    }

    console.info("[clip-video-upload] request:success", {
      userId: currentUser.id,
      fileName: videoFile.name,
      fileSize: videoFile.size,
      videoUrl,
    });

    void scheduleClipUploadOrphanCleanup("upload-success");

    const responsePayload = { ok: true, videoUrl, size: videoFile.size, fileName: videoFile.name };
    console.info("[clip-video-upload] response:success", responsePayload);
    return NextResponse.json(responsePayload, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof ClipVideoUploadError) {
      const responsePayload = { ok: false, error: error.code, message: error.message };
      console.warn("[clip-video-upload] request:validation-failed", {
        userId: currentUser.id,
        code: error.code,
        message: error.message,
      });
      console.warn("[clip-video-upload] response:validation-failed", responsePayload);
      return NextResponse.json(responsePayload, { status: 400, headers: corsHeaders });
    }

    console.error("[clip-video-upload] failed", {
      userId: currentUser.id,
      reason: error instanceof Error ? error.message : "unknown-error",
      stack: error instanceof Error ? error.stack : null,
    });

    const responsePayload = {
      ok: false,
      error: "save-failed",
      message: "The upload endpoint failed before returning a saved clip path.",
    };
    console.error("[clip-video-upload] response:failure", responsePayload);
    return NextResponse.json(responsePayload, { status: 500, headers: corsHeaders });
  }
}
