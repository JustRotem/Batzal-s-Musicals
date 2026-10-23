"use server";

import { notifyAdmins } from "@/lib/notifications";
import { getAdminUrl } from "@/lib/app-mode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, requireUser } from "@/lib/auth";
import { ImageUploadError, isFileEntry } from "@/lib/image-upload";
import { updateUserAvatar } from "@/lib/profile-avatar";
import { PERMISSIONS } from "@/lib/permissions";
import { validateUsername } from "@/lib/username";
import { notifyAdminsAboutEditorRequest } from "@/lib/editor-request-notifications";

type ProfileSection = "profile" | "permissions" | "security";

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSection(
  section: string | null | undefined,
  fallback: ProfileSection,
): ProfileSection {
  if (section === "permissions") {
    return "permissions";
  }

  return section === "security" ? "security" : fallback;
}

function buildProfileRedirectUrl({
  section,
  success,
  error,
}: {
  section: ProfileSection;
  success?: string;
  error?: string;
}) {
  const params = new URLSearchParams();
  params.set("section", section);

  if (success) {
    params.set("success", success);
  }

  if (error) {
    params.set("error", error);
  }

  return `/profile?${params.toString()}`;
}

function redirectProfileWithError(error: string, section: ProfileSection): never {
  redirect(buildProfileRedirectUrl({ section, error }));
}

function redirectProfileWithSuccess(success: string, section: ProfileSection): never {
  redirect(buildProfileRedirectUrl({ section, success }));
}

// Asking for editing access happens from a window in the header, on any Batzal page of this site.
export async function submitEditorRequestAction(
  message: string,
): Promise<{ status: "sent" | "pending" | "unavailable" }> {
  const user = await getCurrentUser();

  if (!user || user.role !== "user" || user.status === "blocked") {
    return { status: "unavailable" };
  }

  if (user.status === "pending") {
    return { status: "pending" };
  }

  const requestMessage = message.trim().slice(0, 1000);

  await db.user.update({
    where: { id: user.id },
    data: {
      status: "pending",
      requestMessage: requestMessage || null,
    },
  });

  await notifyAdmins({
    kind: "editor-request",
    titleHe: "בקשת גישת עריכה חדשה",
    titleEn: "New editing access request",
    bodyHe: `${user.username} מבקש גישת עריכה.`,
    bodyEn: `${user.username} asked for editing access.`,
    href: `${getAdminUrl()}`,
  });

  await notifyAdminsAboutEditorRequest({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    requestMessage: requestMessage || null,
  });

  revalidatePath("/", "layout");

  return { status: "sent" };
}

export async function updateAvatarAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "profile");
  const imageFileEntry = formData.get("avatarFile");
  const imageFile = isFileEntry(imageFileEntry) ? imageFileEntry : null;

  let nextAvatarUrl: string | null = null;

  try {
    nextAvatarUrl = await updateUserAvatar({
      userId: user.id,
      avatarFile: imageFile,
    });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      redirectProfileWithError(error.code, section);
    }

    throw error;
  }

  if (!nextAvatarUrl) {
    redirectProfileWithError("missing-avatar", section);
  }
  redirectProfileWithSuccess("avatar-updated", section);
}

export async function updateUsernameAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "profile");
  const result = validateUsername(normalize(formData.get("displayHandle")));

  if (!result.ok) {
    redirectProfileWithError(result.error, section);
  }

  if (result.value !== user.username) {
    const taken = await db.user.findFirst({
      where: {
        id: { not: user.id },
        username: { equals: result.value, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (taken) {
      redirectProfileWithError("username-exists", section);
    }

    await db.user.update({
      where: { id: user.id },
      data: { username: result.value },
    });

    revalidatePath("/", "layout");
  }

  redirectProfileWithSuccess("username-updated", section);
}
