import path from "node:path";

import { getFolder, getName } from "../lib/slug";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

/** Normalizes media library paths without allowing parent traversal. */
export function normalizeMediaPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

/** Builds a storage path from an optional folder and filename. */
export function joinMediaPath(folder: string | undefined, filename: string): string {
  const safeFolder = normalizeMediaPath(folder ?? "");
  const safeName = normalizeMediaPath(filename).split("/").at(-1) ?? "upload";
  return safeFolder ? `${safeFolder}/${safeName}` : safeName;
}

/** Returns the best-effort MIME type for a media path. */
export function mimeFromPath(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/** Returns MediaItem folder/name fields from a media path. */
export function splitMediaPath(filePath: string): { folder: string; name: string } {
  const normalized = normalizeMediaPath(filePath);
  return { folder: getFolder(normalized), name: getName(normalized) };
}
