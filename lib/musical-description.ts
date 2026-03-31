import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
];

const ALLOWED_ATTRIBUTES = {
  p: ["dir", "style"],
  h2: ["dir", "style"],
  h3: ["dir", "style"],
  ul: ["dir", "style"],
  ol: ["dir", "style"],
  li: ["dir", "style"],
};

const ALLOWED_STYLES = {
  "*": {
    "text-align": [/^left$/, /^center$/, /^right$/],
  },
};

const ALLOWED_SCHEMES: string[] = [];

function hasHtmlMarkup(value: string) {
  return /<[^>]+>/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function convertPlainTextToRichText(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function sanitizeRichTextContent(value: string | null | undefined) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const html = hasHtmlMarkup(normalized)
    ? normalized
    : convertPlainTextToRichText(normalized);

  const sanitized = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ALLOWED_SCHEMES,
    parser: {
      lowerCaseAttributeNames: true,
    },
  }).trim();

  return sanitized || null;
}

export function getDescriptionEditorContent(value: string | null | undefined) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return "";
  }

  return hasHtmlMarkup(normalized)
    ? sanitizeRichTextContent(normalized) ?? ""
    : convertPlainTextToRichText(normalized);
}

export function getRichTextPlainText(value: string | null | undefined) {
  const sanitized = sanitizeRichTextContent(value);

  if (!sanitized) {
    return "";
  }

  return sanitizeHtml(sanitized, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

export const sanitizeMusicalDescription = sanitizeRichTextContent;
export const getMusicalDescriptionText = getRichTextPlainText;
