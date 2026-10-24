import { sharedCookieOptions } from "@/lib/shared-cookie";
import { randomBytes, scryptSync, createHash } from "crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanitizeNextPath } from "@/lib/login-next";
import { getAppMode } from "@/lib/app-mode";
import { 
  hasPermission,
  hasAnyPermission,
  ADMIN_AREA_PERMISSIONS,
  MUSICAL_MANAGEMENT_PERMISSIONS,
  syncPermissionDefinitions,
} from "@/lib/permissions";
import {
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n";
import type { PermissionName } from "@prisma/client";

// The two sites keep separate sessions, so they must not share a cookie name (they share a host while developing locally).
export const SESSION_COOKIE_NAME =
  getAppMode() === "account" ? "batzal_account_session" : "my_musicals_session";
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
  theme: "light" | "dark" | null;
  status: "pending" | "active" | "blocked";
  role: "user" | "editor" | "admin" | "superadmin";
  // Shared by every Batzal site this browser is signed in to
  ssoGroup: string | null;
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

}

export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
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
  theme: string | null;
  status: "pending" | "active" | "blocked";
  role: "user" | "editor" | "admin" | "superadmin";
}): Omit<SafeUser, "ssoGroup"> {
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
    theme: user.theme === "light" || user.theme === "dark" ? user.theme : null,
    status: user.status,
    role: user.role,
  };
}

export async function createSession(userId: string, language?: string | null, ssoGroup?: string | null) {
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
      ssoGroup: ssoGroup ?? randomBytes(16).toString("hex"),
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
    cookieStore.set(LANGUAGE_COOKIE_NAME, normalizeLanguage(language), sharedCookieOptions());
  }
}

// Marks this browser's session as confirmed (the person just signed in with Google again) for a few minutes.
export async function markIdentityConfirmed(minutes: number) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) return;

  await db.session.updateMany({
    where: { tokenHash: hashSha256(rawToken) },
    data: { confirmedUntil: new Date(Date.now() + minutes * 60_000) },
  });
}

export async function isIdentityConfirmed() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) return false;

  const session = await db.session.findUnique({ where: { tokenHash: hashSha256(rawToken) }, select: { confirmedUntil: true } });

  return Boolean(session?.confirmedUntil && session.confirmedUntil > new Date());
}

export async function clearSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashSha256(rawToken);
    const session = await db.session.findUnique({ where: { tokenHash }, select: { ssoGroup: true } });

    // Signing out ends this browser's session on every Batzal site, not just this one.
    await db.session.deleteMany({
      where: session?.ssoGroup ? { ssoGroup: session.ssoGroup } : { tokenHash },
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

  // Sessions made before groups existed get one now, so they can be shared with the other sites.
  let ssoGroup = session.ssoGroup;

  if (!ssoGroup) {
    ssoGroup = randomBytes(16).toString("hex");
    await db.session.update({ where: { id: session.id }, data: { ssoGroup } });
  }

  return { ...buildSafeUser(session.user), ssoGroup };
}

export const getCurrentUser = cache(resolveCurrentUser);

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    const headerStore = await headers();
    const next = sanitizeNextPath(headerStore.get("x-bz-path"));

    redirect(next ? `/auth/login?error=unauthorized&next=${encodeURIComponent(next)}` : "/auth/login?error=unauthorized");
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
