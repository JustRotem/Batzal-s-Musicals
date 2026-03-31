import { open, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CLIP_UPLOAD_DIR } from "@/lib/clip-video-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return VIDEO_CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  const hasStart = rawStart !== "";
  const hasEnd = rawEnd !== "";

  if (!hasStart && !hasEnd) {
    return null;
  }

  let start = hasStart ? Number.parseInt(rawStart, 10) : NaN;
  let end = hasEnd ? Number.parseInt(rawEnd, 10) : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return null;
  }

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    if (!Number.isFinite(start) || start < 0) {
      return null;
    }

    if (Number.isNaN(end) || end >= fileSize) {
      end = fileSize - 1;
    }
  }

  if (!Number.isFinite(end) || end < start || start >= fileSize) {
    return null;
  }

  return { start, end };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await context.params;
  const safeFileName = path.basename(fileName);

  if (!safeFileName || safeFileName !== fileName) {
    return NextResponse.json({ error: "invalid-file-name" }, { status: 400 });
  }

  const filePath = path.join(CLIP_UPLOAD_DIR, safeFileName);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    const contentType = getContentType(safeFileName);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, fileStat.size);

      if (!range) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileStat.size}`,
          },
        });
      }

      const chunkSize = range.end - range.start + 1;
      const handle = await open(filePath, "r");

      try {
        const buffer = Buffer.allocUnsafe(chunkSize);
        await handle.read(buffer, 0, chunkSize, range.start);

        return new Response(buffer, {
          status: 206,
          headers: {
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`,
            "Content-Type": contentType,
          },
        });
      } finally {
        await handle.close();
      }
    }

    const fileHandle = await open(filePath, "r");

    try {
      const buffer = await fileHandle.readFile();

      return new Response(buffer, {
        headers: {
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(fileStat.size),
          "Content-Type": contentType,
        },
      });
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    console.error("[clip-video-file] failed", {
      fileName: safeFileName,
      reason: error instanceof Error ? error.message : "unknown-error",
    });
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
}
