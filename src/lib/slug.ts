/** Converts a human title or path segment into a stable URL slug. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Creates a file-safe markdown filename from a title or path fragment. */
export function toMarkdownFilename(value: string, extension: "md" | "mdx" = "md"): string {
  const slug = slugify(value) || "untitled";
  return `${slug}.${extension}`;
}

/** Normalizes slash-separated virtual paths without allowing parent traversal. */
export function normalizeVirtualPath(value: string): string {
  return value
    .split("/")
    .map((part) => slugify(part))
    .filter(Boolean)
    .join("/");
}

/** Returns the folder portion of a slash-separated path. */
export function getFolder(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

/** Returns the final filename segment of a slash-separated path. */
export function getName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? "";
}
