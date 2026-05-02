import { getEnv } from "../env";
import { GitcmsConfigError } from "../lib/errors";
import { GitHubStorageAdapter } from "./github";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import { SupabaseStorageAdapter } from "./supabase";
import type { StorageAdapter } from "./types";

let adapterPromise: Promise<StorageAdapter> | null = null;

/** Creates a configured storage adapter from environment variables. */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const env = getEnv();
  let adapter: StorageAdapter;

  if (env.GITCMS_STORAGE_BACKEND === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new GitcmsConfigError(
        "Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    adapter = new SupabaseStorageAdapter({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_MEDIA_BUCKET,
    });
  } else if (env.GITCMS_STORAGE_BACKEND === "s3") {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new GitcmsConfigError(
        "S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
      );
    }
    adapter = new S3StorageAdapter({
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      ...(env.S3_PUBLIC_URL_BASE ? { publicUrlBase: env.S3_PUBLIC_URL_BASE } : {}),
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  } else if (env.GITCMS_STORAGE_BACKEND === "github") {
    if (!env.GITCMS_GITHUB_MEDIA_REPO || !env.GITCMS_GITHUB_MEDIA_TOKEN) {
      throw new GitcmsConfigError(
        "GitHub storage requires GITCMS_GITHUB_MEDIA_REPO and GITCMS_GITHUB_MEDIA_TOKEN.",
      );
    }
    adapter = new GitHubStorageAdapter({
      repo: env.GITCMS_GITHUB_MEDIA_REPO,
      ...(env.GITCMS_GITHUB_MEDIA_BRANCH ? { branch: env.GITCMS_GITHUB_MEDIA_BRANCH } : {}),
      mediaPath: env.GITCMS_GITHUB_MEDIA_PATH,
      token: env.GITCMS_GITHUB_MEDIA_TOKEN,
      isPublic: env.GITCMS_GITHUB_MEDIA_PUBLIC,
      ...(env.GITCMS_GITHUB_MEDIA_PUBLIC_URL_BASE
        ? { publicUrlBase: env.GITCMS_GITHUB_MEDIA_PUBLIC_URL_BASE }
        : {}),
    });
  } else {
    adapter = new LocalStorageAdapter({
      root: env.LOCAL_STORAGE_ROOT,
      publicUrl: env.LOCAL_STORAGE_PUBLIC_URL,
    });
  }

  await adapter.init();
  return adapter;
}

/** Returns the process-wide storage adapter singleton. */
export function getStorageAdapter(): Promise<StorageAdapter> {
  adapterPromise ??= createStorageAdapter();
  return adapterPromise;
}

/** Resets the storage singleton for tests. */
export function resetStorageAdapterForTests(): void {
  adapterPromise = null;
}

export type { MediaItem, SignedUploadResult, StorageAdapter } from "./types";
