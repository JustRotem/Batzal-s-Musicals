type HighlightedTextProps = {
  text: string;
  query: string;
  className?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightedText({
  text,
  query,
  className,
}: HighlightedTextProps) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return <span className={className}>{text}</span>;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "giu");
  const parts = text.split(matcher);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.localeCompare(normalizedQuery, undefined, { sensitivity: "accent" }) === 0 ||
        part.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() ? (
          <mark key={`${part}-${index}`} className="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}
