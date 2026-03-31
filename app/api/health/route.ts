import { NextResponse } from "next/server";
import { DEFAULT_APP_TITLE } from "@/lib/app-config";

export async function GET() {
  return NextResponse.json({ ok: true, service: DEFAULT_APP_TITLE });
}