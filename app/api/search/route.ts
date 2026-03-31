import { NextResponse } from "next/server";
import { searchContent } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = await searchContent(query, {
    musicalLimit: 8,
    clipLimit: 8,
  });

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
