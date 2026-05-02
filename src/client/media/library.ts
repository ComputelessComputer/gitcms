import type { MediaItem } from "../../storage";

export type { MediaItem };

/** Returns true when a media item is an image that can be embedded in markdown. */
export function isImageMedia(item: MediaItem): boolean {
  return item.mimeType.startsWith("image/");
}

/** Returns the parent folder of a media path. */
export function getMediaFolder(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

/** Returns a destination media path for moving a file into a folder. */
export function movePathIntoFolder(filePath: string, folder: string): string {
  const name = filePath.split("/").filter(Boolean).at(-1) ?? filePath;
  return folder ? `${folder}/${name}` : name;
}
