import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Readable } from "node:stream";

import { GitcmsStorageError } from "../lib/errors";
import { joinMediaPath, mimeFromPath, normalizeMediaPath, splitMediaPath } from "./path";
import type { MediaItem, SignedUploadResult, StorageAdapter } from "./types";

interface SupabaseStorageEntry {
  name: string;
  id?: string | null;
  metadata?: {
    mimetype?: string;
    size?: number;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupabaseStorageAdapterOptions {
  /** Supabase project URL. */
  url: string;
  /** Supabase service role key. */
  serviceRoleKey: string;
  /** Supabase Storage bucket name. */
  bucket: string;
  /** Optional injected client for tests. */
  client?: SupabaseClient;
}

/** Supabase Storage implementation of the StorageAdapter contract. */
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly client: SupabaseClient;
  private readonly bucketName: string;

  /** Creates a Supabase-backed storage adapter. */
  constructor(options: SupabaseStorageAdapterOptions) {
    this.client =
      options.client ??
      createClient(options.url, options.serviceRoleKey, {
        auth: { persistSession: false },
      });
    this.bucketName = options.bucket;
  }

  /** Validates that the configured bucket exists. */
  async init(): Promise<void> {
    const { data, error } = await this.client.storage.getBucket(this.bucketName);
    if (error || !data) {
      throw new GitcmsStorageError(
        error?.message ?? `Supabase bucket not found: ${this.bucketName}`,
      );
    }
  }

  /** Lists media from a Supabase Storage folder. */
  async list(folder: string, opts: { recursive?: boolean } = {}): Promise<MediaItem[]> {
    const normalizedFolder = normalizeMediaPath(folder);
    if (!opts.recursive) {
      return this.listOneFolder(normalizedFolder);
    }

    const results: MediaItem[] = [];
    const pending = [normalizedFolder];

    while (pending.length > 0) {
      const current = pending.shift() ?? "";
      const items = await this.listOneFolder(current);
      for (const item of items) {
        if (item.mimeType === "application/x-directory") {
          pending.push(item.path);
        } else {
          results.push(item);
        }
      }
    }

    return results;
  }

  /** Creates a signed Supabase upload URL. */
  async createSignedUpload(params: {
    filename: string;
    folder?: string;
    contentType: string;
    upsert?: boolean;
  }): Promise<SignedUploadResult> {
    const storagePath = joinMediaPath(params.folder, params.filename);
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUploadUrl(storagePath, { upsert: params.upsert ?? false });

    if (error || !data?.signedUrl) {
      throw new GitcmsStorageError(error?.message ?? "Failed to create Supabase signed upload URL");
    }

    return {
      uploadUrl: data.signedUrl,
      method: "PUT",
      headers: { "content-type": params.contentType },
      storagePath,
      libraryPath: storagePath,
    };
  }

  /** Moves a Supabase Storage object and returns its new media metadata. */
  async move(fromPath: string, toPath: string): Promise<MediaItem> {
    const from = normalizeMediaPath(fromPath);
    const to = normalizeMediaPath(toPath);
    const { error } = await this.client.storage.from(this.bucketName).move(from, to);
    if (error) {
      throw new GitcmsStorageError(error.message);
    }
    return this.describePath(to);
  }

  /** Deletes a Supabase Storage object. */
  async delete(path: string): Promise<boolean> {
    const normalized = normalizeMediaPath(path);
    const { data, error } = await this.client.storage.from(this.bucketName).remove([normalized]);
    if (error) {
      throw new GitcmsStorageError(error.message);
    }
    return (data?.length ?? 0) > 0;
  }

  /** Creates a folder marker in Supabase Storage. */
  async createFolder(path: string): Promise<void> {
    const markerPath = `${normalizeMediaPath(path)}/.gitcms-folder`;
    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(markerPath, new Blob([""]), { contentType: "application/x-directory", upsert: true });
    if (error) {
      throw new GitcmsStorageError(error.message);
    }
  }

  /** Downloads an object and exposes it as a Node readable stream. */
  async stream(path: string): Promise<{ stream: Readable; contentType: string; size: number }> {
    const normalized = normalizeMediaPath(path);
    const { data, error } = await this.client.storage.from(this.bucketName).download(normalized);
    if (error || !data) {
      throw new GitcmsStorageError(error?.message ?? `Failed to download ${normalized}`);
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      stream: Readable.from(buffer),
      contentType: data.type || mimeFromPath(normalized),
      size: buffer.byteLength,
    };
  }

  /** Returns Supabase's public URL for an object. */
  getPublicUrl(path: string): string {
    const { data } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(normalizeMediaPath(path));
    return data.publicUrl;
  }

  private async listOneFolder(folder: string): Promise<MediaItem[]> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .list(folder || undefined, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      throw new GitcmsStorageError(error.message);
    }

    return ((data ?? []) as SupabaseStorageEntry[])
      .filter((entry) => entry.name !== ".gitcms-folder")
      .map((entry) => this.fromStorageEntry(folder, entry));
  }

  private fromStorageEntry(folder: string, entry: SupabaseStorageEntry): MediaItem {
    const itemPath = normalizeMediaPath(folder ? `${folder}/${entry.name}` : entry.name);
    const isFolder = entry.id === null;
    const now = new Date().toISOString();
    return {
      path: itemPath,
      ...splitMediaPath(itemPath),
      mimeType: isFolder
        ? "application/x-directory"
        : (entry.metadata?.mimetype ?? mimeFromPath(itemPath)),
      size: entry.metadata?.size ?? 0,
      publicUrl: isFolder ? "" : this.getPublicUrl(itemPath),
      createdAt: entry.created_at ?? now,
      updatedAt: entry.updated_at ?? now,
    };
  }

  private async describePath(path: string): Promise<MediaItem> {
    const { folder, name } = splitMediaPath(path);
    const items = await this.listOneFolder(folder);
    return (
      items.find((item) => item.name === name) ?? {
        path,
        name,
        folder,
        mimeType: mimeFromPath(path),
        size: 0,
        publicUrl: this.getPublicUrl(path),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }
}
