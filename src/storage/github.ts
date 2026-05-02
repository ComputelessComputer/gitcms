import { Octokit } from "@octokit/rest";
import { Readable } from "node:stream";

import { GitcmsConfigError, GitcmsStorageError, GitcmsValidationError } from "../lib/errors";
import { joinMediaPath, mimeFromPath, normalizeMediaPath, splitMediaPath } from "./path";
import type { MediaItem, SignedUploadResult, StorageAdapter } from "./types";

const FOLDER_MARKER = ".gitcms-folder";
/** Hard cap. GitHub Contents API rejects files >100 MB, but base64 inflation makes
 *  ~25 MB the practical sweet spot before requests get unreliable. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Number of optimistic-concurrency retries when two writers race on the same file. */
const SHA_RETRIES = 3;

export interface GitHubStorageAdapterOptions {
  /** Repo to write media into, in `owner/repo` form. Defaults to the content repo. */
  repo: string;
  /** Branch to commit media to. Defaults to the repo default branch. */
  branch?: string;
  /** Path within the repo where media lives, e.g. `public/uploads`. */
  mediaPath: string;
  /** GitHub access token used for media writes. Service token recommended. */
  token: string;
  /** Whether the repo is public — controls whether we serve via raw.* or proxy. */
  isPublic: boolean;
  /** Optional CDN base URL (e.g. jsdelivr or cloudflare in front of raw.githubusercontent.com). */
  publicUrlBase?: string;
  /** Optional injected client for tests. */
  client?: Octokit;
}

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  download_url: string | null;
}

/** Storage adapter that commits media directly into a GitHub repository.
 *
 *  Trade-offs vs S3 / Supabase:
 *    - 25 MB hard cap per file (Contents API constraint).
 *    - No CDN. Public repos serve via raw.githubusercontent.com (rate-limited).
 *      Put Cloudflare or jsDelivr in front for production.
 *    - Every upload, move, and delete creates a git commit. History grows fast.
 *    - Suitable for personal blogs and docs sites; not for user-uploaded content. */
export class GitHubStorageAdapter implements StorageAdapter {
  private readonly client: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly mediaPath: string;
  private readonly isPublic: boolean;
  private readonly publicUrlBase: string | undefined;
  private branch: string;
  private branchResolved: boolean;

  /** Creates a GitHub-backed storage adapter. */
  constructor(options: GitHubStorageAdapterOptions) {
    if (!options.token) {
      throw new GitcmsConfigError("GitHub storage requires a token.");
    }
    const [owner, repo] = options.repo.split("/");
    if (!owner || !repo) {
      throw new GitcmsConfigError(`Invalid GitHub repository: ${options.repo}`);
    }
    this.owner = owner;
    this.repo = repo;
    this.mediaPath = normalizeMediaPath(options.mediaPath || "public/uploads");
    this.isPublic = options.isPublic;
    this.publicUrlBase = options.publicUrlBase;
    this.branch = options.branch ?? "";
    this.branchResolved = Boolean(options.branch);
    this.client =
      options.client ??
      new Octokit({
        auth: options.token,
        userAgent: "gitcms/0.0.1",
      });
  }

  /** Validates the token can access the repo and resolves the default branch. */
  async init(): Promise<void> {
    try {
      const { data } = await this.client.repos.get({ owner: this.owner, repo: this.repo });
      if (!this.branchResolved) {
        this.branch = data.default_branch;
        this.branchResolved = true;
      }
    } catch (error) {
      throw new GitcmsStorageError(
        `Failed to access GitHub repo ${this.owner}/${this.repo}: ${(error as Error).message}`,
      );
    }
  }

  /** Lists media in a folder by walking the repo's git tree. */
  async list(folder: string, opts: { recursive?: boolean } = {}): Promise<MediaItem[]> {
    const subpath = normalizeMediaPath(folder);
    const repoPath = this.repoPath(subpath);

    let entries: GitHubFile[];
    try {
      const response = await this.client.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: repoPath,
        ref: this.branch,
      });
      entries = Array.isArray(response.data)
        ? (response.data as unknown as GitHubFile[])
        : [];
    } catch (error) {
      if (isStatus(error, 404)) return [];
      throw new GitcmsStorageError(`Failed to list ${repoPath}: ${(error as Error).message}`);
    }

    const items: MediaItem[] = [];
    for (const entry of entries) {
      if (entry.name === FOLDER_MARKER) continue;
      const childPath = subpath ? `${subpath}/${entry.name}` : entry.name;
      if (entry.type === "dir") {
        if (opts.recursive) {
          items.push(...(await this.list(childPath, opts)));
        } else {
          items.push(this.folderItem(childPath));
        }
      } else if (entry.type === "file") {
        items.push(this.fileItem(childPath, entry.size));
      }
    }
    return items.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Returns a server-proxied upload URL. The browser PUTs the binary to gitcms,
   *  which then commits to GitHub via Octokit. */
  async createSignedUpload(params: {
    filename: string;
    folder?: string;
    contentType: string;
    upsert?: boolean;
  }): Promise<SignedUploadResult> {
    const libraryPath = joinMediaPath(params.folder, params.filename);
    if (!libraryPath) {
      throw new GitcmsValidationError("Filename is required.");
    }
    const search = new URLSearchParams({
      path: libraryPath,
      contentType: params.contentType,
      upsert: params.upsert ? "1" : "0",
    });
    return {
      uploadUrl: `/api/media/upload?${search.toString()}`,
      method: "PUT",
      headers: { "content-type": params.contentType },
      storagePath: libraryPath,
      libraryPath,
    };
  }

  /** Uploads a file's bytes by committing them to the repo. */
  async commitUpload(params: {
    libraryPath: string;
    bytes: Buffer;
    contentType: string;
    upsert: boolean;
  }): Promise<MediaItem> {
    if (params.bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new GitcmsValidationError(
        `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB GitHub upload limit. Use S3-compatible storage for larger media.`,
      );
    }
    const libraryPath = normalizeMediaPath(params.libraryPath);
    const repoPath = this.repoPath(libraryPath);
    const content = params.bytes.toString("base64");

    let lastError: unknown;
    for (let attempt = 0; attempt < SHA_RETRIES; attempt++) {
      const sha = await this.getFileSha(repoPath);
      if (sha && !params.upsert) {
        throw new GitcmsValidationError(`File already exists at ${libraryPath}.`);
      }
      try {
        await this.client.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: repoPath,
          message: sha ? `media: update ${libraryPath}` : `media: add ${libraryPath}`,
          content,
          branch: this.branch,
          ...(sha ? { sha } : {}),
        });
        return this.fileItem(libraryPath, params.bytes.byteLength);
      } catch (error) {
        // 409 = sha mismatch (concurrent write); retry with the fresh sha.
        if (isStatus(error, 409) || isStatus(error, 422)) {
          lastError = error;
          continue;
        }
        throw new GitcmsStorageError(`Failed to upload ${libraryPath}: ${(error as Error).message}`);
      }
    }
    throw new GitcmsStorageError(
      `Failed to upload ${libraryPath} after ${SHA_RETRIES} retries: ${(lastError as Error)?.message ?? "unknown error"}`,
    );
  }

  /** Renames a file by committing a copy then deleting the source. */
  async move(fromPath: string, toPath: string): Promise<MediaItem> {
    const from = normalizeMediaPath(fromPath);
    const to = normalizeMediaPath(toPath);
    const fromRepoPath = this.repoPath(from);
    const toRepoPath = this.repoPath(to);

    const fromSha = await this.getFileSha(fromRepoPath);
    if (!fromSha) {
      throw new GitcmsStorageError(`Source not found: ${from}`);
    }
    const blob = await this.fetchBlob(fromRepoPath);
    await this.client.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: toRepoPath,
      message: `media: rename ${from} -> ${to}`,
      content: blob.contentBase64,
      branch: this.branch,
    });
    await this.client.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path: fromRepoPath,
      message: `media: delete ${from} (renamed to ${to})`,
      sha: fromSha,
      branch: this.branch,
    });
    return this.fileItem(to, blob.size);
  }

  /** Deletes a file from the repo via a delete commit. */
  async delete(path: string): Promise<boolean> {
    const normalized = normalizeMediaPath(path);
    const repoPath = this.repoPath(normalized);
    const sha = await this.getFileSha(repoPath);
    if (!sha) return false;
    try {
      await this.client.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path: repoPath,
        message: `media: delete ${normalized}`,
        sha,
        branch: this.branch,
      });
      return true;
    } catch (error) {
      if (isStatus(error, 404)) return false;
      throw new GitcmsStorageError(`Failed to delete ${normalized}: ${(error as Error).message}`);
    }
  }

  /** Creates an empty folder by committing a `.gitcms-folder` marker. */
  async createFolder(path: string): Promise<void> {
    const normalized = normalizeMediaPath(path);
    if (!normalized) return;
    const repoPath = this.repoPath(`${normalized}/${FOLDER_MARKER}`);
    if (await this.getFileSha(repoPath)) return;
    await this.client.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: repoPath,
      message: `media: create folder ${normalized}`,
      content: Buffer.from("").toString("base64"),
      branch: this.branch,
    });
  }

  /** Streams a file's bytes. For private repos this is the only readable surface;
   *  for public repos the browser typically hits raw.githubusercontent.com directly. */
  async stream(
    path: string,
  ): Promise<{ stream: Readable; contentType: string; size: number }> {
    const normalized = normalizeMediaPath(path);
    const repoPath = this.repoPath(normalized);
    const blob = await this.fetchBlob(repoPath);
    return {
      stream: Readable.from(blob.bytes),
      contentType: mimeFromPath(normalized),
      size: blob.size,
    };
  }

  /** Returns a public URL. Public repos use raw.githubusercontent.com (or a CDN
   *  base if configured). Private repos route through the gitcms server proxy. */
  getPublicUrl(path: string): string {
    const normalized = normalizeMediaPath(path);
    if (!this.isPublic) {
      return `/api/media/download?path=${encodeURIComponent(normalized)}`;
    }
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/$/, "")}/${encodeRepoPath(this.repoPath(normalized))}`;
    }
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${encodeURIComponent(this.branch)}/${encodeRepoPath(this.repoPath(normalized))}`;
  }

  private repoPath(subpath: string): string {
    const tail = normalizeMediaPath(subpath);
    return tail ? `${this.mediaPath}/${tail}` : this.mediaPath;
  }

  private async getFileSha(repoPath: string): Promise<string | null> {
    try {
      const { data } = await this.client.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: repoPath,
        ref: this.branch,
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      return data.sha;
    } catch (error) {
      if (isStatus(error, 404)) return null;
      throw error;
    }
  }

  private async fetchBlob(
    repoPath: string,
  ): Promise<{ bytes: Buffer; contentBase64: string; size: number }> {
    const { data } = await this.client.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path: repoPath,
      ref: this.branch,
    });
    if (Array.isArray(data) || data.type !== "file") {
      throw new GitcmsStorageError(`Not a file: ${repoPath}`);
    }
    if (!data.content || data.encoding !== "base64") {
      // Files >1 MB come back with empty content; fall back to the blob endpoint.
      const blob = await this.client.git.getBlob({
        owner: this.owner,
        repo: this.repo,
        file_sha: data.sha,
      });
      const bytes = Buffer.from(blob.data.content, "base64");
      return { bytes, contentBase64: blob.data.content, size: bytes.byteLength };
    }
    const cleaned = data.content.replace(/\n/g, "");
    const bytes = Buffer.from(cleaned, "base64");
    return { bytes, contentBase64: cleaned, size: bytes.byteLength };
  }

  private fileItem(libraryPath: string, size: number): MediaItem {
    const now = new Date().toISOString();
    return {
      path: libraryPath,
      ...splitMediaPath(libraryPath),
      mimeType: mimeFromPath(libraryPath),
      size,
      publicUrl: this.getPublicUrl(libraryPath),
      createdAt: now,
      updatedAt: now,
    };
  }

  private folderItem(libraryPath: string): MediaItem {
    const now = new Date().toISOString();
    return {
      path: libraryPath,
      ...splitMediaPath(libraryPath),
      mimeType: "application/x-directory",
      size: 0,
      publicUrl: "",
      createdAt: now,
      updatedAt: now,
    };
  }
}

function isStatus(error: unknown, status: number): boolean {
  return Boolean(
    error && typeof error === "object" && "status" in error && (error as { status: number }).status === status,
  );
}

function encodeRepoPath(repoPath: string): string {
  return repoPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
