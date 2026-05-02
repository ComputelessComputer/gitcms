import { Readable } from "node:stream";

import { readAdminSessionFromCookieHeader } from "../../auth/session";
import { AdminUnauthorizedError, GitcmsValidationError } from "../../lib/errors";
import { getStorageAdapter } from "../../storage";

/** Streams media bytes through an authenticated HTTP response. */
export async function handleMediaDownload(request: Request): Promise<Response> {
  const session = await readAdminSessionFromCookieHeader(request.headers.get("cookie") ?? "");
  if (!session) {
    throw new AdminUnauthorizedError();
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    throw new GitcmsValidationError("Missing required path query parameter.");
  }

  const adapter = await getStorageAdapter();
  const result = await adapter.stream(path);
  return new Response(Readable.toWeb(result.stream) as unknown as BodyInit, {
    headers: {
      "cache-control": "private, max-age=60",
      "content-length": result.size.toString(),
      "content-type": result.contentType,
    },
  });
}
