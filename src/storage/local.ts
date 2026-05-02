import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import { GitcmsStorageError } from "../lib/errors";
import { mimeFromPath, normalizeMediaPath, splitMediaPath } from "./path";
import type { MediaItem, SignedUploadResult, StorageAdapter } from "./types";

export interface LocalStorageAdapterOptions {
  /** Root folder where media objects are stored. */
  root: string;
  /** Public URL prefix used by getPublicUrl. */
  publicUrl: string;
}

/** Filesystem storage adapter intended for local development. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly publicUrl: string;

  /** Creates a local filesystem adapter. */
  constructor(options: LocalStorageAdapterOptions) {
    this.root = path.resolve(options.root);
    this.publicUrl = options.publicUrl;
  }

  /** Ensures the storage root exists. */
  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  /** Lists files from the local storage root. */
  async list(folder: string, opts: { recursive?: boolean } = {}): Promise<MediaItem[]> {
    const normalized = normalizeMediaPath(folder);
    const fullPath = this.resolvePath(normalized);
    const entries = await readdir(fullPath, { withFileTypes: true }).catch(() => []);
    const results: MediaItem[] = [];

    for (const entry of entries) {
      const childPath = normalized ? `${normalized}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (opts.recursive) {
          results.push(...(await this.list(childPath, opts)));
        } else {
          results.push(this.folderItem(childPath));
        }
      } else {
        results.push(await this.describePath(childPath));
      }
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Returns a local upload URL placeholder for adapters that proxy uploads separately. */
  async createSignedUpload(): Promise<SignedUploadResult> {
    throw new GitcmsStorageError(
      "Local browser uploads require a proxy endpoint and are not enabled in v0.0.1.",
    );
  }

  /** Moves a local file. */
  async move(fromPath: string, toPath: string): Promise<MediaItem> {
    const from = normalizeMediaPath(fromPath);
    const to = normalizeMediaPath(toPath);
    await mkdir(path.dirname(this.resolvePath(to)), { recursive: true });
    await rename(this.resolvePath(from), this.resolvePath(to));
    return this.describePath(to);
  }

  /** Deletes a local file. */
  async delete(path: string): Promise<boolean> {
    await rm(this.resolvePath(normalizeMediaPath(path)), { force: true });
    return true;
  }

  /** Creates a local folder. */
  async createFolder(path: string): Promise<void> {
    const normalized = normalizeMediaPath(path);
    await mkdir(this.resolvePath(normalized), { recursive: true });
    await writeFile(this.resolvePath(`${normalized}/.gitcms-folder`), "");
  }

  /** Streams a local file. */
  async stream(path: string): Promise<{ stream: Readable; contentType: string; size: number }> {
    const normalized = normalizeMediaPath(path);
    const metadata = await stat(this.resolvePath(normalized));
    return {
      stream: createReadStream(this.resolvePath(normalized)),
      contentType: mimeFromPath(normalized),
      size: metadata.size,
    };
  }

  /** Returns a public URL for a local object. */
  getPublicUrl(path: string): string {
    const normalized = normalizeMediaPath(path);
    const separator = this.publicUrl.includes("?") ? "" : "/";
    return `${this.publicUrl.replace(/\/$/, "")}${separator}${encodeURIComponent(normalized)}`;
  }

  private resolvePath(mediaPath: string): string {
    const resolved = path.resolve(this.root, mediaPath);
    if (!resolved.startsWith(this.root)) {
      throw new GitcmsStorageError("Path escapes local storage root.");
    }
    return resolved;
  }

  private async describePath(mediaPath: string): Promise<MediaItem> {
    const metadata = await stat(this.resolvePath(mediaPath));
    return {
      path: mediaPath,
      ...splitMediaPath(mediaPath),
      mimeType: mimeFromPath(mediaPath),
      size: metadata.size,
      publicUrl: this.getPublicUrl(mediaPath),
      createdAt: metadata.birthtime.toISOString(),
      updatedAt: metadata.mtime.toISOString(),
    };
  }

  private folderItem(mediaPath: string): MediaItem {
    const now = new Date().toISOString();
    return {
      path: mediaPath,
      ...splitMediaPath(mediaPath),
      mimeType: "application/x-directory",
      size: 0,
      publicUrl: "",
      createdAt: now,
      updatedAt: now,
    };
  }
}
