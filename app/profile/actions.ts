"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
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

export async function requestEditorAccessAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.profileEdit);
  const section = normalizeSection(normalize(formData.get("section")), "profile");

  if (user.role !== "user") {
    redirect(buildProfileRedirectUrl({ section }));
  }

  if (user.status === "pending") {
    redirectProfileWithSuccess("editor-request-pending", section);
  }

  if (user.status !== "active") {
    redirect(buildProfileRedirectUrl({ section }));
  }

  const requestMessage = normalize(formData.get("requestMessage"));

  await db.user.update({
    where: { id: user.id },
    data: {
      status: "pending",
      requestMessage: requestMessage || null,
    },
  });

  await notifyAdminsAboutEditorRequest({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    requestMessage: requestMessage || null,
  });

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/musicals");

  redirectProfileWithSuccess("editor-request-sent", section);
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
  const result = validateUsername(normalize(formData.get("username")));

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
