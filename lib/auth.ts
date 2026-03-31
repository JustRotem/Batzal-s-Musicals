import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { 
  hasPermission,
  hasAnyPermission,
  ADMIN_AREA_PERMISSIONS,
  MUSICAL_MANAGEMENT_PERMISSIONS,
  syncPermissionDefinitions,
} from "@/lib/permissions";
import { LANGUAGE_SESSION_COOKIE_NAME, normalizeLanguage } from "@/lib/i18n";
import type { PermissionName } from "@prisma/client";

export const SESSION_COOKIE_NAME = "my_musicals_session";
const SESSION_DURATION_DAYS = 30;
const PASSWORD_SALT_LENGTH = 16;
const SESSION_TOKEN_BYTES = 32;

type SafeUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  avatarVersion: string;
  language: string;
  status: "pending" | "active" | "blocked";
  role: "user" | "editor" | "admin" | "superadmin";
};

function hashSha256(value: string): string {
  const hash = createHash("sha256");
  hash.update(value);
  return hash.digest("hex");
}

function clearSessionCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  cookieStore.set(LANGUAGE_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedKey] = storedHash.split(":");

  if (!salt || !expectedKey) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedKey, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}

function buildSafeUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  updatedAt: Date;
  language: string;
  status: "pending" | "active" | "blocked";
  role: "user" | "editor" | "admin" | "superadmin";
}): SafeUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    avatarVersion: user.updatedAt.toISOString(),
    language: user.language,
    status: user.status,
    role: user.role,
  };
}

export async function createSession(userId: string, language?: string | null) {
  const rawToken = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
  const tokenHash = hashSha256(rawToken);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const headerStore = await headers();
  const cookieStore = await cookies();

  await db.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      userAgent: headerStore.get("user-agent") ?? undefined,
      ipAddress:
        headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    },
  });

  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  if (typeof language === "string" && language.trim()) {
    const safeLanguage = normalizeLanguage(language);
    cookieStore.set(LANGUAGE_SESSION_COOKIE_NAME, safeLanguage, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  }
}

export async function rotateSession(userId: string) {
  await db.session.deleteMany({
    where: {
      userId,
    },
  });

  await createSession(userId);
}

export async function clearSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashSha256(rawToken);

    await db.session.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  clearSessionCookies(cookieStore);
}

async function resolveCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashSha256(rawToken);
  const now = new Date();

  const session = await db.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= now) {
    await db.session.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

    if (session.user.status === "blocked" || !session.user.emailVerified) {
      await db.session.delete({
        where: {
          id: session.id,
        },
      });

      return null;
    }

  return buildSafeUser(session.user);
}

export const getCurrentUser = cache(resolveCurrentUser);

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?error=unauthorized");
  }

  return user;
}

export async function requireAdmin() {
  return requireAnyPermission(ADMIN_AREA_PERMISSIONS);
}

export async function requireMusicalManager() {
  const user = await requireUser();

  if (!(await hasAnyPermission(user, MUSICAL_MANAGEMENT_PERMISSIONS))) {
    redirect("/auth/forbidden");
  }

  return user;
}

export async function requirePermission(permission: PermissionName) {
  const user = await requireUser();

  if (!(await hasPermission(user, permission))) {
    redirect("/auth/forbidden");
  }

  return user;
}

export async function requireAnyPermission(permissions: readonly PermissionName[]) {
  const user = await requireUser();

  const results = await Promise.all(
    permissions.map((permission) => hasPermission(user, permission)),
  );

  if (!results.some(Boolean)) {
    redirect("/auth/forbidden");
  }

  return user;
}
