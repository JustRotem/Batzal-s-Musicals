import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getClipUploadAuthSecret } from "@/lib/env";
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions";

type ClipUploadTokenPayload = {
  userId: string;
  exp: number;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getClipUploadAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createClipUploadToken(userId: string, expiresInSeconds = 10 * 60) {
  const payload: ClipUploadTokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySignature(encodedPayload: string, encodedSignature: string) {
  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export async function verifyClipUploadToken(token: string) {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  if (!verifySignature(encodedPayload, encodedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<ClipUploadTokenPayload>;

    if (!payload.userId || typeof payload.exp !== "number") {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerified: true,
      },
    });

    if (!user || !user.emailVerified || user.status === "blocked") {
      return null;
    }

    const canUploadClip = await hasAnyPermission(user, [
      PERMISSIONS.clipCreate,
      PERMISSIONS.clipEdit,
    ]);

    if (!canUploadClip) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
