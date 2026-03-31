type MusicalArtworkProps = {
  imagePath?: string | null;
  posterDisplayMode?: "crop" | "fit";
  posterAspect?: "square" | "wide" | "tall";
  title: string;
  thumbnailUrl?: string | null;
  emoji?: string | null;
  size?: "card" | "hero";
};

function getArtworkMonogram(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return title.trim().slice(0, 2).toUpperCase();
}

export default function MusicalArtwork({
  imagePath,
  posterDisplayMode = "crop",
  posterAspect,
  title,
  thumbnailUrl,
  size = "card",
}: MusicalArtworkProps) {
  const className = size === "hero" ? "musical-artwork musical-artwork-hero" : "musical-artwork";
  const monogram = getArtworkMonogram(title);
  const imageSrc = imagePath || thumbnailUrl;
  const isFitMode = posterDisplayMode === "fit";
  const aspectRatio =
    posterAspect === "wide"
      ? "16 / 9"
      : posterAspect === "square"
        ? "1 / 1"
        : posterAspect === "tall"
          ? "2 / 3"
          : null;

  return (
    <div
      className={className}
      aria-label={`פוסטר עבור ${title}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {imageSrc ? (
        isFitMode ? (
          <div className="musical-artwork-fit">
            <img
              src={imageSrc}
              alt=""
              aria-hidden="true"
              className="musical-artwork-fit-bg"
            />
            <div className="musical-artwork-fit-overlay" />
            <img
              src={imageSrc}
              alt={`תמונת המחזה ${title}`}
              className="musical-artwork-image musical-artwork-image-fit"
            />
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={`תמונת המחזה ${title}`}
            className="musical-artwork-image"
          />
        )
      ) : (
        <div className="musical-artwork-placeholder musical-artwork-placeholder-simple" aria-hidden="true">
          <div className="musical-artwork-mark">{monogram}</div>
        </div>
      )}
    </div>
  );
}
