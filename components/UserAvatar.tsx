import { buildAvatarUrl } from "@/lib/avatar";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  avatarVersion?: string | number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function UserAvatar({
  name,
  avatarUrl,
  avatarVersion,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const resolvedAvatarUrl = buildAvatarUrl(avatarUrl, avatarVersion);

  if (resolvedAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedAvatarUrl}
        alt={name}
        className={`user-avatar user-avatar-${size} ${className}`.trim()}
      />
    );
  }

  return (
    <span className={`user-avatar user-avatar-${size} user-avatar-fallback ${className}`.trim()}>
      {getInitials(name)}
    </span>
  );
}
