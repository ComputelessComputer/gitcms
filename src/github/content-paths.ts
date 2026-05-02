import type { CollectionDescriptor, ContentConfig } from "../config";
import { slugify } from "../lib/slug";

/** Normalizes a repository path without allowing parent traversal. */
export function normalizeRepoPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

/** Builds the repository path for a collection root. */
export function collectionRepoPath(content: ContentConfig, collection: CollectionDescriptor): string {
  return normalizeRepoPath([content.path, collection.path].filter(Boolean).join("/"));
}

/** Returns the markdown extension for a collection. */
export function collectionExtension(collection: CollectionDescriptor): "md" | "mdx" {
  return collection.bodyFormat === "mdx" ? "mdx" : "md";
}

/** Builds the repository path for a content file slug. */
export function contentFileRepoPath(
  content: ContentConfig,
  collection: CollectionDescriptor,
  slug: string,
): string {
  const extension = collectionExtension(collection);
  const safeSlug = slugify(slug) || "untitled";
  return normalizeRepoPath(`${collectionRepoPath(content, collection)}/${safeSlug}.${extension}`);
}

/** Extracts a slug from a repository content path. */
export function slugFromRepoPath(path: string): string {
  const name = path.split("/").at(-1) ?? "";
  return name.replace(/\.(md|mdx)$/i, "");
}

/** Builds a working branch name for a content slug. */
export function contentWorkingBranch(prefix: string, slug: string): string {
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${normalizedPrefix}${slugify(slug) || "untitled"}`;
}
