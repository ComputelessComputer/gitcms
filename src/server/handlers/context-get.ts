import { getEnv } from "../../env";
import { AdminUnauthorizedError } from "../../lib/errors";
import { loadAuthorContext } from "../../context";
import { getRuntimeConfig } from "../runtime-config";
import { getAuthAdapter, getMembersProvider, getGitHubTokenForIdentity } from "../../auth";

interface JsonHeaders {
  "content-type": "application/json";
  [k: string]: string;
}

const JSON_HEADERS: JsonHeaders = { "content-type": "application/json" };

/** Handles `GET /api/context?collection=<id>&branch=<ref>`.
 *
 *  Two access modes, gated by `GITCMS_CONTEXT_PUBLIC` (default `true`):
 *
 *  1. Public — anyone can read the writing brief. The server uses the
 *     configured GitHub service token to fetch the files. Falls back to
 *     authenticated mode if no service token is set.
 *  2. Authenticated — admin/member only, uses the caller's session token.
 *
 *  The brief is plain markdown the operator wrote into `content/.gitcms/`
 *  and is intended to be public-by-default; flip the flag if you treat it
 *  as proprietary. */
export async function handleContextGet(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const collectionId = url.searchParams.get("collection") ?? undefined;
    const branch = url.searchParams.get("branch") ?? undefined;

    const env = getEnv();
    const config = await getRuntimeConfig();

    const accessToken = env.GITCMS_CONTEXT_PUBLIC
      ? await resolvePublicToken(request)
      : await resolveAuthenticatedToken(request);

    const result = await loadAuthorContext(accessToken, config, {
      collectionId,
      branch,
    });

    return new Response(JSON.stringify(result), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return jsonError(401, error.message);
    }
    const message = error instanceof Error ? error.message : "internal error";
    return jsonError(500, message);
  }
}

/** Public mode: prefer the service token (works for anonymous callers).
 *  If no service token is configured, fall back to authenticated mode so
 *  the endpoint still works for signed-in admins. */
async function resolvePublicToken(request: Request): Promise<string> {
  const env = getEnv();
  if (env.GITCMS_GITHUB_SERVICE_TOKEN) {
    return env.GITCMS_GITHUB_SERVICE_TOKEN;
  }
  return resolveAuthenticatedToken(request);
}

/** Authenticated mode: read identity via the configured AuthAdapter, then
 *  resolve the GitHub token from the configured token source. */
async function resolveAuthenticatedToken(request: Request): Promise<string> {
  const adapter = getAuthAdapter();
  const identity = await adapter.resolveIdentity(request);
  if (!identity) {
    throw new AdminUnauthorizedError("Sign in to read the author context.");
  }
  const member = await getMembersProvider().resolve(identity);
  if (!member) {
    throw new AdminUnauthorizedError("Identity is not an allowed gitcms member.");
  }
  return getGitHubTokenForIdentity(identity);
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}
