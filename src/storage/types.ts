import type { Readable } from "node:stream";

export interface MediaItem {
  /** Library path: virtual hierarchical path users see (e.g. "blog/2024/cover.jpg"). */
  path: string;
  /** Filename only (e.g. "cover.jpg"). */
  name: string;
  /** Folder portion of the path (e.g. "blog/2024"). */
  folder: string;
  /** MIME type, e.g. "image/jpeg". */
  mimeType: string;
  /** Bytes. */
  size: number;
  /** Public URL for direct browser access (CDN URL or signed URL with long TTL). */
  publicUrl: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export interface SignedUploadResult {
  /** URL the browser PUTs the binary to. */
  uploadUrl: string;
  /** HTTP method to use (usually PUT). */
  method: "PUT" | "POST";
  /** Headers the browser must send with the upload. */
  headers: Record<string, string>;
  /** Storage-internal path the file will live at after upload completes. */
  storagePath: string;
  /** The final library path (what users see). May equal storagePath, or be virtualized. */
  libraryPath: string;
}

export interface StorageAdapter {
  /** Lifecycle hook called once at boot. May validate credentials or ensure buckets. */
  init(): Promise<void>;

  /** List all media in a folder, non-recursive by default. */
  list(folder: string, opts?: { recursive?: boolean }): Promise<MediaItem[]>;

  /** Generate a signed URL the browser uses to upload directly to storage. */
  createSignedUpload(params: {
    filename: string;
    folder?: string;
    contentType: string;
    upsert?: boolean;
  }): Promise<SignedUploadResult>;

  /** Move or rename a file within the same backend. */
  move(fromPath: string, toPath: string): Promise<MediaItem>;

  /** Delete a file. Returns true if deleted, false if it did not exist. */
  delete(path: string): Promise<boolean>;

  /** Create an empty folder marker where the backend needs one. */
  createFolder(path: string): Promise<void>;

  /** Stream the raw bytes of a file for /api/media/download. */
  stream(path: string): Promise<{ stream: Readable; contentType: string; size: number }>;

  /** Get a fresh public URL for a path. */
  getPublicUrl(path: string): string;
}
