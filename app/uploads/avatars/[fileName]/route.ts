import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { AVATAR_UPLOAD_DIR } from "@/lib/profile-avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return IMAGE_CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await context.params;
  const safeFileName = path.basename(fileName);

  if (!safeFileName || safeFileName !== fileName) {
    return NextResponse.json({ error: "invalid-file-name" }, { status: 400 });
  }

  const filePath = path.join(AVATAR_UPLOAD_DIR, safeFileName);

  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": getContentType(safeFileName),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
}
