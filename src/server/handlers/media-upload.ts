import { readAdminSessionFromCookieHeader } from "../../auth/session";
import {
  AdminUnauthorizedError,
  GitcmsStorageError,
  GitcmsValidationError,
} from "../../lib/errors";
import { getStorageAdapter } from "../../storage";
import { GitHubStorageAdapter } from "../../storage/github";

const MAX_BODY_BYTES = 25 * 1024 * 1024;

/** Accepts a binary upload from the browser and commits it via the configured
 *  storage adapter. Currently only used by the GitHub storage backend, since
 *  S3 and Supabase return signed URLs the browser can PUT to directly. */
export async function handleMediaUpload(request: Request): Promise<Response> {
  const session = await readAdminSessionFromCookieHeader(request.headers.get("cookie") ?? "");
  if (!session) {
    throw new AdminUnauthorizedError();
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const contentType = url.searchParams.get("contentType") ?? "application/octet-stream";
  const upsert = url.searchParams.get("upsert") === "1";
  if (!path) {
    throw new GitcmsValidationError("Missing required path query parameter.");
  }

  const adapter = await getStorageAdapter();
  if (!(adapter instanceof GitHubStorageAdapter)) {
    throw new GitcmsStorageError(
      "Server-proxied uploads are only supported with the GitHub storage backend.",
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    throw new GitcmsValidationError(
      `Upload exceeds the ${Math.floor(MAX_BODY_BYTES / (1024 * 1024))} MB limit for GitHub storage.`,
    );
  }

  const item = await adapter.commitUpload({
    libraryPath: path,
    bytes: Buffer.from(body),
    contentType,
    upsert,
  });

  return new Response(JSON.stringify({ item }), {
    headers: { "content-type": "application/json" },
  });
}
