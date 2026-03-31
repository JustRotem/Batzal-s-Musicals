import { sanitizeMusicalDescription } from "@/lib/musical-description";
import { isFileEntry } from "@/lib/image-upload";

const ALLOWED_POSTER_DISPLAY_MODES = new Set(["crop", "fit"]);
const ALLOWED_POSTER_ASPECTS = new Set(["square", "wide", "tall"]);

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePosterDisplayMode(value: FormDataEntryValue | null): "crop" | "fit" {
  const normalized = normalize(value);
  return ALLOWED_POSTER_DISPLAY_MODES.has(normalized) ? (normalized as "crop" | "fit") : "crop";
}

function normalizePosterAspect(value: FormDataEntryValue | null): "square" | "wide" | "tall" {
  const normalized = normalize(value);
  return ALLOWED_POSTER_ASPECTS.has(normalized)
    ? (normalized as "square" | "wide" | "tall")
    : "square";
}

export function parseOptionalYear(value: string): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1800 || parsed > 3000) {
    return null;
  }

  return parsed;
}

export const getMusicalFormData = (formData: FormData) => {
  const title = normalize(formData.get("title"));
  const description = sanitizeMusicalDescription(formData.get("description")?.toString());
  const yearRaw = normalize(formData.get("year"));
  const posterDisplayMode = normalizePosterDisplayMode(formData.get("posterDisplayMode"));
  const posterAspect = normalizePosterAspect(formData.get("posterAspect"));
  const imageFileEntry = formData.get("imageFile");
  const imageFile = isFileEntry(imageFileEntry) ? imageFileEntry : null;
  console.info("[musical-form] imageFile entry", {
    hasEntry: Boolean(imageFileEntry),
    isFile: isFileEntry(imageFileEntry),
    name: isFileEntry(imageFileEntry) ? imageFileEntry.name : null,
    size: isFileEntry(imageFileEntry) ? imageFileEntry.size : null,
    type: isFileEntry(imageFileEntry) ? imageFileEntry.type : null,
  });
  const isPublished = formData.get("isPublished") === "on";
  const formValues = {
    title,
    description,
    year: yearRaw,
    posterAspect,
    isPublished,
  };

  return {
    title,
    description,
    yearRaw,
    posterDisplayMode,
    posterAspect,
    imageFile,
    isPublished,
    formValues,
  };
};
