import { NextResponse } from "next/server";
import { getSsoPublicKeyPem } from "@/lib/sso";

export const dynamic = "force-dynamic";

// Public key the other Batzal sites use to verify single sign-on tokens.
export async function GET() {
  const pem = getSsoPublicKeyPem();

  if (!pem) {
    return new NextResponse("Single sign-on is not configured", { status: 404 });
  }

  return new NextResponse(pem, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
