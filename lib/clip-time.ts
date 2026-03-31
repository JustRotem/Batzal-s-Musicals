export function parseDurationToSeconds(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parts = trimmed.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  if (parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const numericParts = parts.map(Number);

  if (parts.length === 2) {
    const [minutes, seconds] = numericParts;
    if (seconds >= 60) {
      return null;
    }

    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numericParts;
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function formatSecondsAsDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) {
    return "";
  }

  const safeValue = Math.max(0, Math.floor(value + 0.000001));
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = safeValue % 60;

  if (hours > 0) {
    return [hours, minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")].join(":");
  }

  return [minutes, seconds.toString().padStart(2, "0")].join(":");
}
