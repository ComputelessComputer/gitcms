import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

import { GitcmsStorageError } from "../lib/errors";
import { joinMediaPath, mimeFromPath, normalizeMediaPath, splitMediaPath } from "./path";
import type { MediaItem, SignedUploadResult, StorageAdapter } from "./types";

const FOLDER_MARKER = ".gitcms-folder";

export interface S3StorageAdapterOptions {
  /** S3-compatible endpoint. */
  endpoint?: string;
  /** S3-compatible region. */
  region: string;
  /** Bucket name. */
  bucket: string;
  /** Access key ID. */
  accessKeyId: string;
  /** Secret access key. */
  secretAccessKey: string;
  /** Optional CDN/public URL base. */
  publicUrlBase?: string;
  /** Whether to force path-style addressing. */
  forcePathStyle?: boolean;
  /** Optional injected client for tests. */
  client?: S3Client;
}

/** S3-compatible implementation for S3, R2, B2, MinIO, and Spaces. */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly publicUrlBase?: string;
  private readonly forcePathStyle: boolean;

  /** Creates an S3-compatible storage adapter. */
  constructor(options: S3StorageAdapterOptions) {
    this.bucket = options.bucket;
    this.region = options.region;
    this.endpoint = options.endpoint;
    this.publicUrlBase = options.publicUrlBase;
    this.forcePathStyle = options.forcePathStyle ?? false;

    const config: S3ClientConfig = {
      region: options.region,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    };
    if (options.endpoint) {
      config.endpoint = options.endpoint;
    }

    this.client = options.client ?? new S3Client(config);
  }

  /** Validates access to the configured bucket. */
  async init(): Promise<void> {
    await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      }),
    );
  }

  /** Lists media from an S3-compatible bucket. */
  async list(folder: string, opts: { recursive?: boolean } = {}): Promise<MediaItem[]> {
    const prefix = this.prefixForFolder(folder);
    const items: MediaItem[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: opts.recursive ? undefined : "/",
          ContinuationToken: continuationToken,
        }),
      );

      for (const commonPrefix of response.CommonPrefixes ?? []) {
        const folderPath = normalizeMediaPath(commonPrefix.Prefix ?? "");
        if (!folderPath) continue;
        items.push(this.folderItem(folderPath));
      }

      for (const object of response.Contents ?? []) {
        const key = normalizeMediaPath(object.Key ?? "");
        if (!key || key.endsWith(`/${FOLDER_MARKER}`)) continue;
        items.push({
          path: key,
          ...splitMediaPath(key),
          mimeType: object.Key ? mimeFromPath(object.Key) : "application/octet-stream",
          size: object.Size ?? 0,
          publicUrl: this.getPublicUrl(key),
          createdAt: (object.LastModified ?? new Date()).toISOString(),
          updatedAt: (object.LastModified ?? new Date()).toISOString(),
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return items.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Creates a signed PUT URL for direct browser upload. */
  async createSignedUpload(params: {
    filename: string;
    folder?: string;
    contentType: string;
    upsert?: boolean;
  }): Promise<SignedUploadResult> {
    const storagePath = joinMediaPath(params.folder, params.filename);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 60 * 10 });
    return {
      uploadUrl,
      method: "PUT",
      headers: { "content-type": params.contentType },
      storagePath,
      libraryPath: storagePath,
    };
  }

  /** Moves an object by copying it to the new key and deleting the old key. */
  async move(fromPath: string, toPath: string): Promise<MediaItem> {
    const from = normalizeMediaPath(fromPath);
    const to = normalizeMediaPath(toPath);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
        Key: to,
      }),
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: from }));
    return this.describePath(to);
  }

  /** Deletes an object from the bucket. */
  async delete(path: string): Promise<boolean> {
    const key = normalizeMediaPath(path);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (isS3Status(error, 404)) {
        return false;
      }
      throw error;
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return true;
  }

  /** Creates an empty folder marker. */
  async createFolder(path: string): Promise<void> {
    const key = `${normalizeMediaPath(path)}/${FOLDER_MARKER}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: "",
        ContentType: "application/x-directory",
      }),
    );
  }

  /** Streams an object from S3-compatible storage. */
  async stream(path: string): Promise<{ stream: Readable; contentType: string; size: number }> {
    const key = normalizeMediaPath(path);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new GitcmsStorageError(`S3 object has no body: ${key}`);
    }
    return {
      stream: toReadable(response.Body),
      contentType: response.ContentType ?? mimeFromPath(key),
      size: response.ContentLength ?? 0,
    };
  }

  /** Returns a public URL for an object. */
  getPublicUrl(path: string): string {
    const key = normalizeMediaPath(path).split("/").map(encodeURIComponent).join("/");
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/$/, "")}/${key}`;
    }
    if (this.endpoint && this.forcePathStyle) {
      return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`;
    }
    if (this.endpoint) {
      const endpoint = new URL(this.endpoint);
      return `${endpoint.protocol}//${this.bucket}.${endpoint.host}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private prefixForFolder(folder: string): string {
    const normalized = normalizeMediaPath(folder);
    return normalized ? `${normalized}/` : "";
  }

  private folderItem(folderPath: string): MediaItem {
    const normalized = normalizeMediaPath(folderPath);
    const now = new Date().toISOString();
    return {
      path: normalized,
      ...splitMediaPath(normalized),
      mimeType: "application/x-directory",
      size: 0,
      publicUrl: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  private async describePath(path: string): Promise<MediaItem> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    return {
      path,
      ...splitMediaPath(path),
      mimeType: response.ContentType ?? mimeFromPath(path),
      size: response.ContentLength ?? 0,
      publicUrl: this.getPublicUrl(path),
      createdAt: (response.LastModified ?? new Date()).toISOString(),
      updatedAt: (response.LastModified ?? new Date()).toISOString(),
    };
  }
}

function toReadable(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream);
  }

  if (typeof body === "object" && body !== null && Symbol.asyncIterator in body) {
    return Readable.from(body as AsyncIterable<Uint8Array>);
  }

  throw new GitcmsStorageError("Unsupported S3 response stream type.");
}

function isS3Status(error: unknown, status: number): boolean {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) {
    return false;
  }
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode === status;
}
